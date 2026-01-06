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

async function createCapsule(
  userId: string,
  viewLimit = 0,
  lat = 37.5665,
  lng = 126.978,
) {
  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, content, latitude, longitude, view_limit, view_count, is_locked, open_at)
    VALUES ($1, $2, 'test capsule', 'test content', $3, $4, $5, 0, true, NOW() + interval '1 day')
    `,
    [capsuleId, userId, lat, lng, viewLimit],
  );
  return capsuleId;
}

async function createFriendship(userIdA: string, userIdB: string) {
  const friendshipId = crypto.randomUUID();
  // user_id < friend_id 정책에 따라 정렬
  const [smallerId, largerId] =
    userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];

  await client.query(
    `
    INSERT INTO friendships (id, user_id, friend_id, status)
    VALUES ($1, $2, $3, 'CONNECTED')
    ON CONFLICT (user_id, friend_id) DO NOTHING
    `,
    [friendshipId, smallerId, largerId],
  );
}

async function cleanupFriendships(userIdA: string, userIdB: string) {
  await client.query(
    `
    DELETE FROM friendships
    WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
    `,
    [userIdA, userIdB],
  );
}

test('GET /api/auth/me 200: 기본 정보 조회 (캡슐/친구 없음)', async () => {
  const user = await createUser('토끼유저', 'rabbit@example.com');

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  if (res.status() !== 200) {
    console.error('GET /auth/me error', res.status(), await res.text());
  }
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data).toBeDefined();
  expect(body.data.nickname).toBe('토끼유저');
  expect(body.data.email).toBe('rabbit@example.com');
  expect(body.data.profileImageUrl).toBeNull();
  expect(body.data.summary).toBeDefined();
  expect(body.data.summary.capsuleCount).toBe(0);
  expect(body.data.summary.easterEggCount).toBe(0);
  expect(body.data.summary.friendCount).toBe(0);

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: 캡슐 통계 포함', async () => {
  const user = await createUser('캡슐유저', 'capsule@example.com');

  // 일반 캡슐 2개 생성 (viewLimit = 0)
  await createCapsule(user.id, 0);
  await createCapsule(user.id, 0);

  // 이스터에그 3개 생성 (viewLimit > 0)
  await createCapsule(user.id, 5);
  await createCapsule(user.id, 10);
  await createCapsule(user.id, 1);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.nickname).toBe('캡슐유저');
  expect(body.data.email).toBe('capsule@example.com');
  expect(body.data.summary.capsuleCount).toBe(5); // 전체 캡슐 개수
  expect(body.data.summary.easterEggCount).toBe(3); // viewLimit > 0인 캡슐
  expect(body.data.summary.friendCount).toBe(0);

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: 친구 통계 포함', async () => {
  const user1 = await createUser('친구많은유저', 'social@example.com');
  const user2 = await createUser('친구1');
  const user3 = await createUser('친구2');
  const user4 = await createUser('친구3');

  // CONNECTED 상태의 친구 3명 추가
  await createFriendship(user1.id, user2.id);
  await createFriendship(user1.id, user3.id);
  await createFriendship(user1.id, user4.id);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.nickname).toBe('친구많은유저');
  expect(body.data.summary.capsuleCount).toBe(0);
  expect(body.data.summary.easterEggCount).toBe(0);
  expect(body.data.summary.friendCount).toBe(3);

  await cleanupFriendships(user1.id, user2.id);
  await cleanupFriendships(user1.id, user3.id);
  await cleanupFriendships(user1.id, user4.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
  await cleanupUser(user4.id);
});

test('GET /api/auth/me 200: 모든 통계 포함 (캡슐 + 친구)', async () => {
  const user = await createUser('풀스택유저', 'fullstack@example.com');
  const friend1 = await createUser('친구A');
  const friend2 = await createUser('친구B');

  // 캡슐 생성
  await createCapsule(user.id, 0);
  await createCapsule(user.id, 0);
  await createCapsule(user.id, 5);

  // 친구 추가
  await createFriendship(user.id, friend1.id);
  await createFriendship(user.id, friend2.id);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.nickname).toBe('풀스택유저');
  expect(body.data.email).toBe('fullstack@example.com');
  expect(body.data.summary.capsuleCount).toBe(3);
  expect(body.data.summary.easterEggCount).toBe(1);
  expect(body.data.summary.friendCount).toBe(2);

  await cleanupFriendships(user.id, friend1.id);
  await cleanupFriendships(user.id, friend2.id);
  await cleanupUser(user.id);
  await cleanupUser(friend1.id);
  await cleanupUser(friend2.id);
});

test('GET /api/auth/me 401: 토큰 없이 요청', async () => {
  const res = await api.get('/api/auth/me');

  expect(res.status()).toBe(401);
});

test('GET /api/auth/me 401: 잘못된 토큰', async () => {
  const invalidToken = 'invalid-token-string';

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${invalidToken}` },
  });

  expect(res.status()).toBe(401);
});

test('GET /api/auth/me 401: 만료된 토큰', async () => {
  const user = await createUser('만료유저');

  // 만료된 토큰 생성 (과거 시간)
  const expiredToken = jwt.sign(
    { sub: user.id, nickname: user.nickname, tokenVersion: 0 },
    JWT_SECRET,
    {
      expiresIn: '-1h', // 1시간 전에 만료
    },
  );

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});

test('GET /api/auth/me 401: 존재하지 않는 사용자', async () => {
  const fakeUserId = crypto.randomUUID();
  const fakeToken = jwt.sign(
    { sub: fakeUserId, nickname: 'fake-user', tokenVersion: 0 },
    JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${fakeToken}` },
  });

  expect(res.status()).toBe(401);
});

test('GET /api/auth/me 401: token_version 불일치', async () => {
  const user = await createUser('버전불일치유저');

  // 사용자의 token_version을 1로 변경 (로그아웃 시뮬레이션)
  await client.query('UPDATE users SET token_version = 1 WHERE id = $1', [
    user.id,
  ]);

  // 기존 토큰 (tokenVersion: 0)으로 요청
  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: 삭제된 캡슐은 카운트에서 제외', async () => {
  const user = await createUser('삭제테스트유저');

  // 캡슐 3개 생성
  const capsule1 = await createCapsule(user.id, 0);
  const capsule2 = await createCapsule(user.id, 5);
  await createCapsule(user.id, 10);

  // 캡슐 2개 소프트 삭제
  await client.query(
    'UPDATE capsules SET deleted_at = NOW() WHERE id IN ($1, $2)',
    [capsule1, capsule2],
  );

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.summary.capsuleCount).toBe(1); // 삭제되지 않은 캡슐만
  expect(body.data.summary.easterEggCount).toBe(1); // 삭제되지 않은 이스터에그만

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: PENDING 상태 친구는 카운트에서 제외', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');
  const user3 = await createUser('유저3');

  // CONNECTED 친구 1명
  await createFriendship(user1.id, user2.id);

  // PENDING 친구 1명
  const [smallerId, largerId] =
    user1.id < user3.id ? [user1.id, user3.id] : [user3.id, user1.id];
  await client.query(
    `
    INSERT INTO friendships (id, user_id, friend_id, status)
    VALUES ($1, $2, $3, 'PENDING')
    `,
    [crypto.randomUUID(), smallerId, largerId],
  );

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.summary.friendCount).toBe(1); // CONNECTED 상태만 카운트

  await cleanupFriendships(user1.id, user2.id);
  await cleanupFriendships(user1.id, user3.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

test('GET /api/auth/me 200: email null인 경우', async () => {
  const user = await createUser('이메일없는유저', null);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.nickname).toBe('이메일없는유저');
  expect(body.data.email).toBeNull();
  expect(body.data.profileImageUrl).toBeNull();

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: profileImg 있는 경우', async () => {
  const user = await createUser('프로필유저', 'profile@example.com');

  // 프로필 이미지 설정
  const profileImgUrl = 'https://example.com/profiles/test-user.png';
  await client.query('UPDATE users SET profile_img = $1 WHERE id = $2', [
    profileImgUrl,
    user.id,
  ]);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.profileImageUrl).toBe(profileImgUrl);

  await cleanupUser(user.id);
});
