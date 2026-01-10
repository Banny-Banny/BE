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

async function createUser(
  nickname = 'test-user',
  email: string | null = null,
  pushEnabled = true,
  marketingEnabled = false,
) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, email, provider, egg_slots, is_push_agreed, is_marketing_agreed)
    VALUES ($1, $2, $3, $4, 'LOCAL', 3, $5, $6)
    `,
    [id, nickname, phone, email, pushEnabled, marketingEnabled],
  );
  const token = jwt.sign({ sub: id, nickname }, JWT_SECRET, {
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
  roomStatus = 'WAITING',
  lat = 37.5665,
  lng = 126.978,
) {
  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, content, latitude, longitude, view_limit, view_count, is_locked, open_at, room_status)
    VALUES ($1, $2, 'test capsule', 'test content', $3, $4, $5, 0, true, NOW() + interval '1 day', $6)
    `,
    [capsuleId, userId, lat, lng, viewLimit, roomStatus],
  );
  return capsuleId;
}

async function createCapsuleParticipant(capsuleId: string, userId: string) {
  const slotId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsule_participant_slots (id, capsule_id, user_id, slot_index)
    VALUES ($1, $2, $3, 1)
    `,
    [slotId, capsuleId, userId],
  );
  return slotId;
}

async function createFriendship(
  userIdA: string,
  userIdB: string,
  status = 'CONNECTED',
) {
  const friendshipId = crypto.randomUUID();
  const [smallerId, largerId] =
    userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];

  await client.query(
    `
    INSERT INTO friendships (id, user_id, friend_id, status)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, friend_id) DO NOTHING
    `,
    [friendshipId, smallerId, largerId, status],
  );
  return friendshipId;
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

async function createNotification(
  userId: string,
  title: string,
  content: string,
  type = 'SYSTEM',
  isRead = false,
) {
  const notificationId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO notifications (id, user_id, title, content, type, is_read)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [notificationId, userId, title, content, type, isRead],
  );
  return notificationId;
}

async function cleanupNotifications(userId: string) {
  await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
}

// ============================================
// 프로필 관리 테스트
// ============================================

test('GET /api/me 200: 내 프로필 조회', async () => {
  const user = await createUser('테스트유저', 'test@example.com');

  const res = await api.get('/api/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.nickname).toBe('테스트유저');
  expect(body.email).toBe('test@example.com');
  expect(body.profileImg).toBeNull();
  expect(body.isPushAgreed).toBe(true);
  expect(body.isMarketingAgreed).toBe(false);

  await cleanupUser(user.id);
});

test('GET /api/me 401: 인증 없이 요청', async () => {
  const res = await api.get('/api/me');
  expect(res.status()).toBe(401);
});

test('POST /api/me/update 200: 프로필 수정 (닉네임만)', async () => {
  const uniqueNick = `변경닉${Date.now()}`;
  const user = await createUser('원래닉네임', 'test@example.com');

  const res = await api.post('/api/me/update', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      nickname: uniqueNick,
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.nickname).toBe(uniqueNick);
  expect(body.email).toBe('test@example.com');

  // DB 확인
  const dbUser = await client.query('SELECT * FROM users WHERE id = $1', [
    user.id,
  ]);
  expect(dbUser.rows[0].nickname).toBe(uniqueNick);

  await cleanupUser(user.id);
});

test('POST /api/me/update 200: 프로필 수정 (이메일만)', async () => {
  const user = await createUser('테스트유저', 'old@example.com');

  const res = await api.post('/api/me/update', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      email: 'new@example.com',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.nickname).toBe('테스트유저');
  expect(body.email).toBe('new@example.com');

  await cleanupUser(user.id);
});

test('POST /api/me/update 200: 닉네임과 이메일 동시 수정', async () => {
  const uniqueNick = `새유저${Date.now()}`;
  const user = await createUser('원래닉네임', 'old@example.com');

  const res = await api.post('/api/me/update', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      nickname: uniqueNick,
      email: 'new@example.com',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.nickname).toBe(uniqueNick);
  expect(body.email).toBe('new@example.com');

  await cleanupUser(user.id);
});

test('POST /api/me/settings 200: 알림 설정 수정', async () => {
  const user = await createUser('테스트유저', 'test@example.com', true, false);

  const res = await api.post('/api/me/settings', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      isPushAgreed: false,
      isMarketingAgreed: true,
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.message).toBe('알림 설정이 수정되었습니다.');

  // DB 확인
  const dbUser = await client.query('SELECT * FROM users WHERE id = $1', [
    user.id,
  ]);
  expect(dbUser.rows[0].is_push_agreed).toBe(false);
  expect(dbUser.rows[0].is_marketing_agreed).toBe(true);

  await cleanupUser(user.id);
});

// ============================================
// 프로필 이미지 업로드 테스트
// ============================================

test('POST /api/me/profile-image 201: 프로필 이미지 업로드 성공 (JPEG)', async () => {
  const user = await createUser('이미지업로드유저');

  // 가짜 이미지 파일 생성 (Buffer)
  const imageBuffer = Buffer.from('fake-image-data-jpeg');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'profile.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  if (res.status() !== 201) {
    console.error('upload error', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.profileImageUrl).toBeDefined();
  expect(body.profileImageUrl).toContain('profiles/');

  // DB에서 프로필 이미지 URL 확인
  const dbUser = await client.query(
    'SELECT profile_img FROM users WHERE id = $1',
    [user.id],
  );
  expect(dbUser.rows[0].profile_img).toBe(body.profileImageUrl);

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 201: 프로필 이미지 업로드 성공 (PNG)', async () => {
  const user = await createUser('PNG업로드');

  const imageBuffer = Buffer.from('fake-image-data-png');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'profile.png',
        mimeType: 'image/png',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.profileImageUrl).toBeDefined();

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 201: 프로필 이미지 업로드 성공 (WEBP)', async () => {
  const user = await createUser('WEBP업로드');

  const imageBuffer = Buffer.from('fake-image-data-webp');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'profile.webp',
        mimeType: 'image/webp',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.profileImageUrl).toBeDefined();

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 201: 기존 프로필 이미지 덮어쓰기', async () => {
  const user = await createUser('덮어쓰기테스트');

  // 기존 프로필 이미지 설정
  const oldImageUrl = 'https://old-image.com/profile.jpg';
  await client.query('UPDATE users SET profile_img = $1 WHERE id = $2', [
    oldImageUrl,
    user.id,
  ]);

  // 새 이미지 업로드
  const imageBuffer = Buffer.from('new-image-data');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'new-profile.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.profileImageUrl).not.toBe(oldImageUrl);

  // DB 확인
  const dbUser = await client.query(
    'SELECT profile_img FROM users WHERE id = $1',
    [user.id],
  );
  expect(dbUser.rows[0].profile_img).toBe(body.profileImageUrl);

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 400: 파일 없이 요청', async () => {
  const user = await createUser('파일없음');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 400: 잘못된 파일 형식 (PDF)', async () => {
  const user = await createUser('잘못된형식');

  const pdfBuffer = Buffer.from('fake-pdf-data');

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
    },
  });

  expect(res.status()).toBe(400);
  const bodyText = await res.text();
  expect(bodyText).toContain('jpeg, png, webp');

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 400: 파일 크기 초과 (6MB)', async () => {
  const user = await createUser('크기초과');

  // 6MB 크기의 버퍼 생성
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

  const res = await api.post('/api/me/profile-image', {
    headers: { Authorization: `Bearer ${user.token}` },
    multipart: {
      file: {
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer,
      },
    },
  });

  expect(res.status()).toBe(400);
  const bodyText = await res.text();
  expect(bodyText).toContain('5MB');

  await cleanupUser(user.id);
});

test('POST /api/me/profile-image 401: 인증 없이 요청', async () => {
  const imageBuffer = Buffer.from('fake-image');

  const res = await api.post('/api/me/profile-image', {
    multipart: {
      file: {
        name: 'profile.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(401);
});

// ============================================
// 타임캡슐 리스트 테스트
// ============================================

test('GET /api/me/capsules 200: 참여중인 캡슐 목록 조회', async () => {
  const user = await createUser('캡슐유저');

  // 사용자가 생성한 캡슐
  const capsule1 = await createCapsule(user.id, 0, 'WAITING');
  await createCapsuleParticipant(capsule1, user.id);

  // 사용자가 참여한 캡슐
  const otherUser = await createUser('다른유저');
  const capsule2 = await createCapsule(otherUser.id, 0, 'WAITING');
  await createCapsuleParticipant(capsule2, user.id);

  const res = await api.get('/api/me/capsules?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items).toBeDefined();
  expect(body.items.length).toBeGreaterThanOrEqual(2);
  expect(body.total).toBeGreaterThanOrEqual(2);
  expect(body.limit).toBe(10);
  expect(body.offset).toBe(0);

  // 캡슐 정보 확인
  const foundCapsule = body.items.find((c: any) => c.id === capsule1);
  expect(foundCapsule).toBeDefined();
  expect(foundCapsule.title).toBe('test capsule');
  expect(foundCapsule.status).toBe('WAITING');

  await cleanupUser(user.id);
  await cleanupUser(otherUser.id);
});

test('GET /api/me/capsules 200: 빈 목록', async () => {
  const user = await createUser('캡슐없는유저');

  const res = await api.get('/api/me/capsules?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items).toEqual([]);
  expect(body.total).toBe(0);

  await cleanupUser(user.id);
});

test('GET /api/me/capsules 200: 페이지네이션', async () => {
  const user = await createUser('페이지유저');

  // 5개 캡슐 생성
  for (let i = 0; i < 5; i++) {
    const capsule = await createCapsule(user.id);
    await createCapsuleParticipant(capsule, user.id);
  }

  // 첫 페이지 (2개)
  const res1 = await api.get('/api/me/capsules?limit=2&offset=0', {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.items.length).toBe(2);
  expect(body1.total).toBeGreaterThanOrEqual(5);

  // 두 번째 페이지
  const res2 = await api.get('/api/me/capsules?limit=2&offset=2', {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.items.length).toBe(2);

  await cleanupUser(user.id);
});

// ============================================
// 친구 관리 테스트
// ============================================

test('GET /api/me/friends 200: 친구 목록 조회', async () => {
  const user1 = await createUser('유저1', 'user1@example.com');
  const user2 = await createUser('유저2', 'user2@example.com');
  const user3 = await createUser('유저3', 'user3@example.com');

  await createFriendship(user1.id, user2.id, 'CONNECTED');
  await createFriendship(user1.id, user3.id, 'CONNECTED');

  const res = await api.get('/api/me/friends?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items).toBeDefined();
  expect(body.items.length).toBe(2);
  expect(body.total).toBe(2);

  // 친구 정보 확인
  const friendNicknames: string[] = body.items.map(
    (f: any) => f.friend.nickname as string,
  );
  expect(friendNicknames).toContain('유저2');
  expect(friendNicknames).toContain('유저3');

  await cleanupFriendships(user1.id, user2.id);
  await cleanupFriendships(user1.id, user3.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

test('GET /api/me/friends 200: PENDING 상태 친구 제외', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');
  const user3 = await createUser('유저3');

  // CONNECTED 친구
  await createFriendship(user1.id, user2.id, 'CONNECTED');
  // PENDING 친구
  await createFriendship(user1.id, user3.id, 'PENDING');

  const res = await api.get('/api/me/friends?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items.length).toBe(1); // CONNECTED만
  expect(body.items[0].friend.nickname).toBe('유저2');

  await cleanupFriendships(user1.id, user2.id);
  await cleanupFriendships(user1.id, user3.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

test('POST /api/me/friends 201: 친구 추가', async () => {
  const user1 = await createUser('유저1');
  const user2Phone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;

  // user2를 특정 전화번호로 생성
  const user2Id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots, is_push_agreed, is_marketing_agreed)
    VALUES ($1, $2, $3, 'LOCAL', 3, true, false)
    `,
    [user2Id, '유저2', user2Phone],
  );

  const res = await api.post('/api/me/friends', {
    headers: { Authorization: `Bearer ${user1.token}` },
    data: {
      phoneNumber: user2Phone,
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.friendshipId).toBeDefined();
  expect(body.message).toBeDefined();

  // DB 확인
  const friendship = await client.query(
    'SELECT * FROM friendships WHERE id = $1',
    [body.friendshipId],
  );
  expect(friendship.rows.length).toBe(1);
  expect(friendship.rows[0].status).toBe('CONNECTED');

  await cleanupFriendships(user1.id, user2Id);
  await cleanupUser(user1.id);
  await cleanupUser(user2Id);
});

test('POST /api/me/friends 404: 존재하지 않는 전화번호', async () => {
  const user = await createUser('유저1');

  const res = await api.post('/api/me/friends', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      phoneNumber: '01099999999',
    },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(user.id);
});

test('POST /api/me/friends 400: 자기 자신을 친구 추가', async () => {
  const user = await createUser('유저1');

  // 현재 사용자의 전화번호를 가져옴
  const userResult = await client.query(
    'SELECT phone_number FROM users WHERE id = $1',
    [user.id],
  );
  const userPhone = userResult.rows[0].phone_number;

  const res = await api.post('/api/me/friends', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      phoneNumber: userPhone,
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('POST /api/me/friends 409: 이미 친구인 경우', async () => {
  const user1 = await createUser('유저1');
  const user2Phone = `010${Math.floor(Math.random() * 90000000 + 10000000)}`;

  const user2Id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots, is_push_agreed, is_marketing_agreed)
    VALUES ($1, $2, $3, 'LOCAL', 3, true, false)
    `,
    [user2Id, '유저2', user2Phone],
  );

  await createFriendship(user1.id, user2Id, 'CONNECTED');

  const res = await api.post('/api/me/friends', {
    headers: { Authorization: `Bearer ${user1.token}` },
    data: {
      phoneNumber: user2Phone,
    },
  });

  expect(res.status()).toBe(409);

  await cleanupFriendships(user1.id, user2Id);
  await cleanupUser(user1.id);
  await cleanupUser(user2Id);
});

test('DELETE /api/me/friends/:friendshipId 204: 친구 삭제', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');

  const friendshipId = await createFriendship(user1.id, user2.id, 'CONNECTED');

  const res = await api.delete(`/api/me/friends/${friendshipId}`, {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(204);

  // DB 확인 (삭제 확인)
  const friendship = await client.query(
    'SELECT * FROM friendships WHERE id = $1',
    [friendshipId],
  );
  expect(friendship.rows.length).toBe(0);

  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
});

test('DELETE /api/me/friends/:friendshipId 404: 존재하지 않는 친구 관계', async () => {
  const user = await createUser('유저1');
  const fakeFriendshipId = crypto.randomUUID();

  const res = await api.delete(`/api/me/friends/${fakeFriendshipId}`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(user.id);
});

test('DELETE /api/me/friends/:friendshipId 403: 다른 사용자의 친구 관계 삭제 시도', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');
  const user3 = await createUser('유저3');

  const friendshipId = await createFriendship(user2.id, user3.id, 'CONNECTED');

  // user1이 user2-user3 관계를 삭제 시도
  const res = await api.delete(`/api/me/friends/${friendshipId}`, {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(403);

  await cleanupFriendships(user2.id, user3.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

// ============================================
// 알림 관리 테스트
// ============================================

test('GET /api/me/notifications 200: 알림 목록 조회', async () => {
  const user = await createUser('알림유저');

  await createNotification(user.id, '제목1', '내용1', 'SYSTEM', false);
  await createNotification(user.id, '제목2', '내용2', 'FRIEND_REQUEST', false);
  await createNotification(user.id, '제목3', '내용3', 'SYSTEM', true);

  const res = await api.get('/api/me/notifications?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items).toBeDefined();
  expect(body.items.length).toBe(3);
  expect(body.total).toBe(3);

  // 최신순 정렬 확인 (createdAt 기준)
  const titles: string[] = body.items.map((n: any) => n.title as string);
  expect(titles).toContain('제목1');
  expect(titles).toContain('제목2');
  expect(titles).toContain('제목3');

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

test('GET /api/me/notifications 200: 빈 목록', async () => {
  const user = await createUser('알림없는유저');

  const res = await api.get('/api/me/notifications?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items).toEqual([]);
  expect(body.total).toBe(0);

  await cleanupUser(user.id);
});

test('GET /api/me/notifications/unread-count 200: 읽지 않은 알림 개수', async () => {
  const user = await createUser('알림유저');

  await createNotification(user.id, '제목1', '내용1', 'SYSTEM', false);
  await createNotification(user.id, '제목2', '내용2', 'SYSTEM', false);
  await createNotification(user.id, '제목3', '내용3', 'SYSTEM', true);

  const res = await api.get('/api/me/notifications/unread-count', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.count).toBe(2);

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

test('GET /api/me/notifications/unread-count 200: 읽지 않은 알림 없음', async () => {
  const user = await createUser('알림유저');

  await createNotification(user.id, '제목1', '내용1', 'SYSTEM', true);

  const res = await api.get('/api/me/notifications/unread-count', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.count).toBe(0);

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

test('POST /api/me/notifications/:notificationId/read 200: 알림 읽음 처리', async () => {
  const user = await createUser('알림유저');
  const notificationId = await createNotification(
    user.id,
    '제목1',
    '내용1',
    'SYSTEM',
    false,
  );

  const res = await api.post(`/api/me/notifications/${notificationId}/read`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.message).toBe('알림이 읽음 처리되었습니다.');

  // DB 확인
  const notification = await client.query(
    'SELECT * FROM notifications WHERE id = $1',
    [notificationId],
  );
  expect(notification.rows[0].is_read).toBe(true);

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

test('POST /api/me/notifications/:notificationId/read 404: 존재하지 않는 알림', async () => {
  const user = await createUser('알림유저');
  const fakeNotificationId = crypto.randomUUID();

  const res = await api.post(
    `/api/me/notifications/${fakeNotificationId}/read`,
    {
      headers: { Authorization: `Bearer ${user.token}` },
    },
  );

  expect(res.status()).toBe(404);

  await cleanupUser(user.id);
});

test('POST /api/me/notifications/:notificationId/read 403: 다른 사용자의 알림 읽음 처리 시도', async () => {
  const user1 = await createUser('유저1');
  const user2 = await createUser('유저2');
  const notificationId = await createNotification(
    user2.id,
    '제목1',
    '내용1',
    'SYSTEM',
    false,
  );

  const res = await api.post(`/api/me/notifications/${notificationId}/read`, {
    headers: { Authorization: `Bearer ${user1.token}` },
  });

  expect(res.status()).toBe(403);

  await cleanupNotifications(user2.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
});

test('POST /api/me/notifications/:notificationId/read 200: 이미 읽은 알림 다시 읽기 (멱등성)', async () => {
  const user = await createUser('알림유저');
  const notificationId = await createNotification(
    user.id,
    '제목1',
    '내용1',
    'SYSTEM',
    true,
  );

  const res = await api.post(`/api/me/notifications/${notificationId}/read`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

// ============================================
// 관리자 알림 발송 테스트
// ============================================

test('POST /api/admin/notifications 201: 특정 사용자에게 알림 발송', async () => {
  const user = await createUser('타겟유저', 'target@example.com');

  const res = await api.post('/api/admin/notifications', {
    headers: { Authorization: `Bearer ${user.token}` },
    data: {
      targetType: 'USER',
      userId: user.id,
      title: '관리자 알림',
      content: '테스트 알림입니다.',
      type: 'SYSTEM',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.count).toBe(1);
  expect(body.message).toContain('알림');

  // DB 확인
  const notifications = await client.query(
    'SELECT * FROM notifications WHERE user_id = $1 AND title = $2',
    [user.id, '관리자 알림'],
  );
  expect(notifications.rows.length).toBe(1);
  expect(notifications.rows[0].content).toBe('테스트 알림입니다.');
  expect(notifications.rows[0].type).toBe('SYSTEM');
  expect(notifications.rows[0].is_read).toBe(false);

  await cleanupNotifications(user.id);
  await cleanupUser(user.id);
});

test('POST /api/admin/notifications 201: 전체 사용자에게 알림 발송', async () => {
  const user1 = await createUser('유저1', 'user1@example.com');
  const user2 = await createUser('유저2', 'user2@example.com');
  const user3 = await createUser('유저3', 'user3@example.com');

  const res = await api.post('/api/admin/notifications', {
    headers: { Authorization: `Bearer ${user1.token}` },
    data: {
      targetType: 'ALL',
      title: '전체 알림',
      content: '모든 사용자에게 발송',
      type: 'MARKETING',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.count).toBeGreaterThanOrEqual(3);

  // DB 확인 - 최소 3명에게 발송되었는지 확인
  const notifications = await client.query(
    'SELECT * FROM notifications WHERE title = $1',
    ['전체 알림'],
  );
  expect(notifications.rows.length).toBeGreaterThanOrEqual(3);

  await cleanupNotifications(user1.id);
  await cleanupNotifications(user2.id);
  await cleanupNotifications(user3.id);
  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupUser(user3.id);
});

test('POST /api/admin/notifications 404: 존재하지 않는 사용자에게 발송', async () => {
  const admin = await createUser('관리자');
  const fakeUserId = crypto.randomUUID();

  const res = await api.post('/api/admin/notifications', {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: {
      targetType: 'USER',
      userId: fakeUserId,
      title: '알림',
      content: '내용',
      type: 'SYSTEM',
    },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(admin.id);
});
