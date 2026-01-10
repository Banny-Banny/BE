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

async function createProduct(name = 'test-product', price = 1000) {
  const productId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO products (id, name, price, product_type, is_active)
    VALUES ($1, $2, $3, 'TIME_CAPSULE', true)
    `,
    [productId, name, price],
  );
  return productId;
}

async function cleanupProduct(id: string) {
  await client.query('DELETE FROM products WHERE id = $1', [id]);
}

async function createCapsule(
  userId: string,
  productId: string | null = null,
  lat = 37.5665,
  lng = 126.978,
) {
  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, product_id, title, content, latitude, longitude, view_limit, view_count, is_locked, open_at)
    VALUES ($1, $2, $3, 'test capsule', 'test content', $4, $5, 0, 0, true, NOW() + interval '1 day')
    `,
    [capsuleId, userId, productId, lat, lng],
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
  expect(body.data.summary.timeCapsuleCount).toBe(0);
  expect(body.data.summary.easterEggCount).toBe(0);
  expect(body.data.summary.friendCount).toBe(0);

  await cleanupUser(user.id);
});

test('GET /api/auth/me 200: 캡슐 통계 포함', async () => {
  const user = await createUser('캡슐유저', 'capsule@example.com');

  // 타임캡슐 2개 생성 (product_id가 있음)
  const productId1 = await createProduct('타임캡슐1', 1000);
  const productId2 = await createProduct('타임캡슐2', 2000);
  await createCapsule(user.id, productId1);
  await createCapsule(user.id, productId2);

  // 이스터에그 3개 생성 (product_id가 없음)
  await createCapsule(user.id, null);
  await createCapsule(user.id, null);
  await createCapsule(user.id, null);

  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.nickname).toBe('캡슐유저');
  expect(body.data.email).toBe('capsule@example.com');
  expect(body.data.summary.timeCapsuleCount).toBe(2); // product_id가 있는 캡슐
  expect(body.data.summary.easterEggCount).toBe(3); // product_id가 없는 캡슐
  expect(body.data.summary.friendCount).toBe(0);

  await cleanupProduct(productId1);
  await cleanupProduct(productId2);
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
  expect(body.data.summary.timeCapsuleCount).toBe(0);
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

  // 타임캡슐 2개 생성 (product_id가 있음)
  const productId = await createProduct('타임캡슐', 1500);
  await createCapsule(user.id, productId);
  await createCapsule(user.id, productId);

  // 이스터에그 1개 생성 (product_id가 없음)
  await createCapsule(user.id, null);

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
  expect(body.data.summary.timeCapsuleCount).toBe(2); // product_id가 있는 캡슐
  expect(body.data.summary.easterEggCount).toBe(1);
  expect(body.data.summary.friendCount).toBe(2);

  await cleanupProduct(productId);
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

  // 타임캡슐 1개, 이스터에그 2개 생성
  const productId = await createProduct('삭제테스트상품', 1000);
  const capsule1 = await createCapsule(user.id, productId); // 타임캡슐
  const capsule2 = await createCapsule(user.id, null); // 이스터에그
  await createCapsule(user.id, null); // 이스터에그

  // 타임캡슐 1개, 이스터에그 1개 소프트 삭제
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
  expect(body.data.summary.timeCapsuleCount).toBe(0); // product_id가 있는 캡슐이 삭제됨
  expect(body.data.summary.easterEggCount).toBe(1); // 삭제되지 않은 이스터에그만

  await cleanupProduct(productId);
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

// ============================================
// 자체 회원가입/로그인 테스트
// ============================================

test('POST /api/auth/local/signup 201: 회원가입 성공', async () => {
  const uniquePhone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;
  const uniqueNick = `테스트유저${Date.now()}`;

  const res = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: uniqueNick,
      password: 'Test1234!',
      email: `test${Date.now()}@example.com`,
    },
  });

  if (res.status() !== 201) {
    console.error('signup error', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.accessToken).toBeDefined();
  expect(body.user).toBeDefined();
  expect(body.user.nickname).toBe(uniqueNick);
  expect(body.user.isNewUser).toBe(true);

  // DB에서 사용자 확인
  const dbUser = await client.query(
    'SELECT * FROM users WHERE phone_number = $1',
    [uniquePhone],
  );
  expect(dbUser.rows.length).toBe(1);
  expect(dbUser.rows[0].provider).toBe('LOCAL');

  await client.query('DELETE FROM users WHERE phone_number = $1', [
    uniquePhone,
  ]);
});

test('POST /api/auth/local/signup 409: 중복된 전화번호', async () => {
  const uniquePhone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;

  // 첫 번째 회원가입
  const res1 = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: '유저1',
      password: 'Test1234!',
    },
  });
  expect(res1.status()).toBe(201);

  // 같은 전화번호로 두 번째 회원가입 시도
  const res2 = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: '유저2',
      password: 'Test1234!',
    },
  });
  expect(res2.status()).toBe(409);

  await client.query('DELETE FROM users WHERE phone_number = $1', [
    uniquePhone,
  ]);
});

test('POST /api/auth/local/signup 400: 잘못된 비밀번호 형식', async () => {
  const uniquePhone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;

  const res = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: '테스트유저',
      password: '1234', // 너무 짧은 비밀번호
    },
  });

  expect(res.status()).toBe(400);
});

test('POST /api/auth/local/signup 400: 필수 필드 누락', async () => {
  const res = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: '01012345678',
      // nickname 누락
      password: 'Test1234!',
    },
  });

  expect(res.status()).toBe(400);
});

test('POST /api/auth/local/login 201: 로그인 성공 (전화번호)', async () => {
  const uniquePhone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;
  const password = 'Test1234!';

  // 먼저 회원가입
  const signupRes = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: '로그인테스트',
      password: password,
    },
  });
  expect(signupRes.status()).toBe(201);

  // 로그인 시도
  const loginRes = await api.post('/api/auth/local/login', {
    data: {
      phoneNumber: uniquePhone,
      password: password,
    },
  });

  expect(loginRes.status()).toBe(201);

  const body = await loginRes.json();
  expect(body.accessToken).toBeDefined();
  expect(body.user).toBeDefined();
  expect(body.user.nickname).toBe('로그인테스트');
  expect(body.user.isNewUser).toBe(false); // 기존 사용자

  await client.query('DELETE FROM users WHERE phone_number = $1', [
    uniquePhone,
  ]);
});

test('POST /api/auth/local/login 201: 로그인 성공 (이메일)', async () => {
  const uniqueEmail = `test${Date.now()}@example.com`;
  const password = 'Test1234!';

  // 먼저 회원가입
  const signupRes = await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: `010${Math.floor(Math.random() * 90000000 + 10000000)}`,
      nickname: '이메일로그인',
      password: password,
      email: uniqueEmail,
    },
  });
  expect(signupRes.status()).toBe(201);

  // 이메일로 로그인 시도
  const loginRes = await api.post('/api/auth/local/login', {
    data: {
      email: uniqueEmail,
      password: password,
    },
  });

  expect(loginRes.status()).toBe(201);

  const body = await loginRes.json();
  expect(body.accessToken).toBeDefined();
  expect(body.user).toBeDefined();
  expect(body.user.nickname).toBe('이메일로그인');
  expect(body.user.email).toBe(uniqueEmail);
  expect(body.user.isNewUser).toBe(false);

  await client.query('DELETE FROM users WHERE email = $1', [uniqueEmail]);
});

test('POST /api/auth/local/login 401: 잘못된 비밀번호', async () => {
  const uniquePhone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;

  // 먼저 회원가입
  await api.post('/api/auth/local/signup', {
    data: {
      phoneNumber: uniquePhone,
      nickname: '비밀번호테스트',
      password: 'Test1234!',
    },
  });

  // 잘못된 비밀번호로 로그인 시도
  const loginRes = await api.post('/api/auth/local/login', {
    data: {
      phoneNumber: uniquePhone,
      password: 'WrongPassword123!',
    },
  });

  expect(loginRes.status()).toBe(401);

  await client.query('DELETE FROM users WHERE phone_number = $1', [
    uniquePhone,
  ]);
});

test('POST /api/auth/local/login 401: 존재하지 않는 사용자', async () => {
  const loginRes = await api.post('/api/auth/local/login', {
    data: {
      phoneNumber: '01099999999',
      password: 'Test1234!',
    },
  });

  expect(loginRes.status()).toBe(401);
});

test('POST /api/auth/local/login 403: SNS 계정으로 시도', async () => {
  // 카카오 계정 생성
  const userId = crypto.randomUUID();
  const phone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'KAKAO', 3)
    `,
    [userId, 'SNS유저', phone],
  );

  // 로컬 로그인 시도
  const loginRes = await api.post('/api/auth/local/login', {
    data: {
      phoneNumber: phone,
      password: 'Test1234!',
    },
  });

  expect(loginRes.status()).toBe(403);

  await cleanupUser(userId);
});

// ============================================
// 로그아웃 테스트
// ============================================

test('POST /api/auth/logout 200: 로그아웃 성공', async () => {
  const user = await createUser('로그아웃테스트');

  const res = await api.post('/api/auth/logout', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);

  // token_version이 증가했는지 확인
  const dbUser = await client.query(
    'SELECT token_version FROM users WHERE id = $1',
    [user.id],
  );
  expect(dbUser.rows[0].token_version).toBe(1); // 0에서 1로 증가

  // 기존 토큰으로 요청하면 401
  const meRes = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(meRes.status()).toBe(401);

  await cleanupUser(user.id);
});

test('POST /api/auth/logout 401: 토큰 없이 요청', async () => {
  const res = await api.post('/api/auth/logout');
  expect(res.status()).toBe(401);
});

test('POST /api/auth/logout 401: 잘못된 토큰', async () => {
  const res = await api.post('/api/auth/logout', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  expect(res.status()).toBe(401);
});

// ============================================
// 토큰 검증 테스트
// ============================================

test('GET /api/auth/verify 200: 유효한 토큰', async () => {
  const user = await createUser('토큰검증테스트');

  const res = await api.get('/api/auth/verify', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.valid).toBe(true);
  expect(body.userId).toBe(user.id);

  await cleanupUser(user.id);
});

test('GET /api/auth/verify 401: 토큰 없이 요청', async () => {
  const res = await api.get('/api/auth/verify');
  expect(res.status()).toBe(401);
});

test('GET /api/auth/verify 401: 잘못된 토큰', async () => {
  const res = await api.get('/api/auth/verify', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  expect(res.status()).toBe(401);
});

test('GET /api/auth/verify 401: 만료된 토큰', async () => {
  const user = await createUser('만료토큰검증');

  const expiredToken = jwt.sign(
    { sub: user.id, nickname: user.nickname, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '-1h' },
  );

  const res = await api.get('/api/auth/verify', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});

test('GET /api/auth/verify 401: 로그아웃된 사용자 (token_version 불일치)', async () => {
  const user = await createUser('버전불일치검증');

  // 로그아웃 (token_version 증가)
  await client.query('UPDATE users SET token_version = 1 WHERE id = $1', [
    user.id,
  ]);

  const res = await api.get('/api/auth/verify', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});
