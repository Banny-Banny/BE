/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Load test env first, then fall back to default .env
dotenv.config({ path: '.env.test' });
dotenv.config();

const DB_CONFIG = {
  host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 5432),
  user: process.env.TEST_DB_USERNAME ?? process.env.DB_USERNAME ?? '',
  password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
  database:
    process.env.TEST_DB_DATABASE ??
    process.env.DB_DATABASE ??
    'banny_banny_test',
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

let api: APIRequestContext;
let client: Client;

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await client.end();
  await api.dispose();
});

async function createUser(nickname = 'test-user', email: string | null = null) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, email, provider, egg_slots, token_version)
    VALUES ($1, $2, $3, $4, 'LOCAL', 3, 0)
    `,
    [id, nickname, phone, email],
  );
  const token = jwt.sign({ sub: id, nickname, tokenVersion: 0 }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token, nickname, email };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function getOnboardingStatus(userId: string): Promise<{
  is_friend_consent_agreed: boolean;
  is_location_consent_agreed: boolean;
  onboarding_completed_at: Date | null;
}> {
  const result = await client.query(
    `
    SELECT 
      is_friend_consent_agreed,
      is_location_consent_agreed,
      onboarding_completed_at
    FROM users
    WHERE id = $1
    `,
    [userId],
  );
  return result.rows[0] as {
    is_friend_consent_agreed: boolean;
    is_location_consent_agreed: boolean;
    onboarding_completed_at: Date | null;
  };
}

// ============================================
// 온보딩 완료 API 테스트
// ============================================

test('POST /api/onboarding/complete 200: 온보딩 완료 성공 (친구 동의 O, 위치 동의 O)', async () => {
  const user = await createUser('온보딩테스트유저', 'onboard@example.com');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });

  if (res.status() !== 200) {
    console.error('onboarding error', res.status(), await res.text());
  }
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);

  // DB에서 온보딩 정보 확인
  const dbStatus = await getOnboardingStatus(user.id);
  expect(dbStatus.is_friend_consent_agreed).toBe(true);
  expect(dbStatus.is_location_consent_agreed).toBe(true);
  expect(dbStatus.onboarding_completed_at).not.toBeNull();

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 온보딩 완료 성공 (친구 동의 X, 위치 동의 O)', async () => {
  const user = await createUser('친구거부유저');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: false,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);

  // DB 확인
  const dbStatus = await getOnboardingStatus(user.id);
  expect(dbStatus.is_friend_consent_agreed).toBe(false);
  expect(dbStatus.is_location_consent_agreed).toBe(true);
  expect(dbStatus.onboarding_completed_at).not.toBeNull();

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 온보딩 완료 성공 (친구 동의 O, 위치 동의 X)', async () => {
  const user = await createUser('위치거부유저');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: true,
      location_consent: false,
    },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);

  // DB 확인
  const dbStatus = await getOnboardingStatus(user.id);
  expect(dbStatus.is_friend_consent_agreed).toBe(true);
  expect(dbStatus.is_location_consent_agreed).toBe(false);
  expect(dbStatus.onboarding_completed_at).not.toBeNull();

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 온보딩 완료 성공 (모두 거부)', async () => {
  const user = await createUser('모두거부유저');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: false,
      location_consent: false,
    },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);

  // DB 확인
  const dbStatus = await getOnboardingStatus(user.id);
  expect(dbStatus.is_friend_consent_agreed).toBe(false);
  expect(dbStatus.is_location_consent_agreed).toBe(false);
  expect(dbStatus.onboarding_completed_at).not.toBeNull();

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 중복 호출 시 정보 업데이트 (Upsert)', async () => {
  const user = await createUser('중복호출유저');

  // 첫 번째 온보딩 완료 (모두 거부)
  const res1 = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: false,
      location_consent: false,
    },
  });
  expect(res1.status()).toBe(200);

  const dbStatus1 = await getOnboardingStatus(user.id);
  const firstCompletedAt = dbStatus1.onboarding_completed_at;
  expect(dbStatus1.is_friend_consent_agreed).toBe(false);
  expect(dbStatus1.is_location_consent_agreed).toBe(false);
  expect(firstCompletedAt).not.toBeNull();

  // 잠시 대기 (시간 차이를 확인하기 위해)
  await new Promise((resolve) => setTimeout(resolve, 100));

  // 두 번째 온보딩 완료 (모두 동의)
  const res2 = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });
  expect(res2.status()).toBe(200);

  const dbStatus2 = await getOnboardingStatus(user.id);
  // 동의 정보는 업데이트됨
  expect(dbStatus2.is_friend_consent_agreed).toBe(true);
  expect(dbStatus2.is_location_consent_agreed).toBe(true);
  // 완료 시점은 첫 번째와 동일 (변경되지 않음)
  expect(dbStatus2.onboarding_completed_at).toEqual(firstCompletedAt);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 400: 필수 필드 누락 (friend_consent 없음)', async () => {
  const user = await createUser('필드누락유저1');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      location_consent: true,
      // friend_consent 누락
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 400: 필수 필드 누락 (location_consent 없음)', async () => {
  const user = await createUser('필드누락유저2');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: true,
      // location_consent 누락
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 타입 자동 변환 (friend_consent 문자열→boolean)', async () => {
  const user = await createUser('타입변환유저1');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: 'true', // 문자열 → boolean으로 자동 변환
      location_consent: true,
    },
  });

  expect(res.status()).toBe(200); // NestJS ValidationPipe가 자동 변환
  const body = await res.json();
  expect(body.success).toBe(true);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 타입 자동 변환 (location_consent 문자열→boolean)', async () => {
  const user = await createUser('타입변환유저2');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: true,
      location_consent: 'false', // 문자열 → boolean으로 자동 변환
    },
  });

  expect(res.status()).toBe(200); // NestJS ValidationPipe가 자동 변환
  const body = await res.json();
  expect(body.success).toBe(true);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 401: 인증 없이 요청', async () => {
  const res = await api.post('/api/onboarding/complete', {
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(401);
});

test('POST /api/onboarding/complete 401: 잘못된 토큰', async () => {
  const invalidToken = 'invalid-token-string';

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${invalidToken}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(401);
});

test('POST /api/onboarding/complete 401: 만료된 토큰', async () => {
  const user = await createUser('만료토큰유저');

  // 만료된 토큰 생성
  const expiredToken = jwt.sign(
    { sub: user.id, nickname: user.nickname, tokenVersion: 0 },
    JWT_SECRET,
    {
      expiresIn: '-1h', // 1시간 전에 만료
    },
  );

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${expiredToken}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 401: 존재하지 않는 사용자', async () => {
  const fakeUserId = crypto.randomUUID();
  const fakeToken = jwt.sign(
    { sub: fakeUserId, nickname: 'fake-user', tokenVersion: 0 },
    JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${fakeToken}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(401);
});

test('POST /api/onboarding/complete 200: 빈 body로 요청 시 기본값 처리 불가 (400)', async () => {
  const user = await createUser('빈바디유저');

  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {},
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('POST /api/onboarding/complete 200: 여러 사용자의 온보딩 완료', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');
  const user3 = await createUser('유저3');

  // 각 사용자가 온보딩 완료
  const res1 = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user1.token}` },
    data: {
      friend_consent: true,
      location_consent: true,
    },
  });
  expect(res1.status()).toBe(200);

  const res2 = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user2.token}` },
    data: {
      friend_consent: false,
      location_consent: true,
    },
  });
  expect(res2.status()).toBe(200);

  const res3 = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user3.token}` },
    data: {
      friend_consent: true,
      location_consent: false,
    },
  });
  expect(res3.status()).toBe(200);

  // 각 사용자의 온보딩 정보 확인
  const dbStatus1 = await getOnboardingStatus(user1.id);
  expect(dbStatus1.is_friend_consent_agreed).toBe(true);
  expect(dbStatus1.is_location_consent_agreed).toBe(true);

  const dbStatus2 = await getOnboardingStatus(user2.id);
  expect(dbStatus2.is_friend_consent_agreed).toBe(false);
  expect(dbStatus2.is_location_consent_agreed).toBe(true);

  const dbStatus3 = await getOnboardingStatus(user3.id);
  expect(dbStatus3.is_friend_consent_agreed).toBe(true);
  expect(dbStatus3.is_location_consent_agreed).toBe(false);

  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

test('POST /api/onboarding/complete 200: 기존 온보딩 정보가 있는 사용자 (마이그레이션 시나리오)', async () => {
  const user = await createUser('마이그레이션유저');

  // 기존 온보딩 정보 설정 (마이그레이션 전 데이터 시뮬레이션)
  await client.query(
    `
    UPDATE users
    SET 
      is_friend_consent_agreed = true,
      is_location_consent_agreed = false,
      onboarding_completed_at = NOW() - interval '7 days'
    WHERE id = $1
    `,
    [user.id],
  );

  // 온보딩 정보 업데이트
  const res = await api.post('/api/onboarding/complete', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      friend_consent: false,
      location_consent: true,
    },
  });

  expect(res.status()).toBe(200);

  const dbStatus = await getOnboardingStatus(user.id);
  // 동의 정보는 업데이트됨
  expect(dbStatus.is_friend_consent_agreed).toBe(false);
  expect(dbStatus.is_location_consent_agreed).toBe(true);
  // 완료 시점은 7일 전 그대로 유지
  expect(dbStatus.onboarding_completed_at).not.toBeNull();

  await cleanupUser(user.id);
});
