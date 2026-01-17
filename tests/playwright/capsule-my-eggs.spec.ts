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

async function createUser(nickname = 'eggs-user') {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', 3)
    `,
    [id, nickname, phone],
  );
  const token = jwt.sign({ sub: id, nickname }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM capsule_access_logs WHERE viewer_id = $1', [
    id,
  ]);
  await client.query('DELETE FROM capsules WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createEasterEgg(
  userId: string,
  title: string,
  viewLimit = 5,
  status: 'ACTIVE' | 'EXPIRED' = 'ACTIVE',
) {
  const eggId = crypto.randomUUID();
  const deletedAt = status === 'EXPIRED' ? new Date() : null;

  await client.query(
    `
    INSERT INTO capsules (id, user_id, capsule_type, title, content, latitude, longitude, deleted_at)
    VALUES ($1, $2, 'EASTER_EGG', $3, $4, $5, $6, $7)
    `,
    [
      eggId,
      userId,
      title,
      '테스트 콘텐츠',
      37.5665,
      126.978,
      deletedAt,
    ],
  );
  await client.query(
    `
    INSERT INTO easter_eggs (capsule_id, view_limit, view_count)
    VALUES ($1, $2, 0)
    `,
    [eggId, viewLimit],
  );
  return eggId;
}

async function createMedia(userId: string, type = 'IMAGE') {
  const mediaId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO media (id, user_id, object_key, type, content_type, size)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [mediaId, userId, `media/${userId}/${type}/${mediaId}.jpg`, type, 'image/jpeg', 1024],
  );
  return mediaId;
}

async function linkMediaToCapsule(capsuleId: string, mediaId: string) {
  await client.query(
    `
    UPDATE capsules 
    SET media_item_ids = ARRAY[$1]::uuid[]
    WHERE id = $2
    `,
    [mediaId, capsuleId],
  );
}

async function recordCapsuleView(capsuleId: string, viewerId: string, viewedAt = new Date()) {
  await client.query(
    `
    INSERT INTO capsule_access_logs (id, capsule_id, viewer_id, viewed_at)
    VALUES ($1, $2, $3, $4)
    `,
    [crypto.randomUUID(), capsuleId, viewerId, viewedAt],
  );
}

// ============================================
// 심은 알 (PLANTED) 테스트
// ============================================

test('GET /api/capsules/my-eggs?type=PLANTED 200: 심은 알 조회 (활성/만료)', async () => {
  const user = await createUser('심은알유저');

  // 활성 이스터에그 2개
  const activeEgg1 = await createEasterEgg(user.id, '활성 알 1', 5, 'ACTIVE');
  const activeEgg2 = await createEasterEgg(user.id, '활성 알 2', 3, 'ACTIVE');

  // 만료된 이스터에그 1개
  const expiredEgg = await createEasterEgg(user.id, '만료 알', 2, 'EXPIRED');

  const res = await api.get('/api/capsules/my-eggs?type=PLANTED', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  expect(body.summary).toBeDefined();
  expect(body.summary.totalPlantedCount).toBe(3);
  expect(body.summary.activeCount).toBe(2);

  expect(body.data).toBeDefined();
  expect(body.data.activeEggs).toBeDefined();
  expect(body.data.expiredEggs).toBeDefined();
  
  expect(body.data.activeEggs.length).toBe(2);
  expect(body.data.expiredEggs.length).toBe(1);

  const activeEggIds = body.data.activeEggs.map((e: any) => e.eggId);
  expect(activeEggIds).toContain(activeEgg1);
  expect(activeEggIds).toContain(activeEgg2);

  const expiredEggIds = body.data.expiredEggs.map((e: any) => e.eggId);
  expect(expiredEggIds).toContain(expiredEgg);

  await cleanupUser(user.id);
});

test('GET /api/capsules/my-eggs?type=PLANTED 200: 미디어 포함 확인', async () => {
  const user = await createUser('미디어심은알');

  const egg = await createEasterEgg(user.id, '미디어 알', 5, 'ACTIVE');
  const imageMedia = await createMedia(user.id, 'IMAGE');
  const audioMedia = await createMedia(user.id, 'AUDIO');
  await linkMediaToCapsule(egg, imageMedia);

  const res = await api.get('/api/capsules/my-eggs?type=PLANTED', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  const activeEgg = body.data.activeEggs.find((e: any) => e.eggId === egg);
  expect(activeEgg).toBeDefined();
  expect(activeEgg.hasImage).toBe(true);
  expect(activeEgg.hasAudio).toBe(false);
  expect(activeEgg.hasVideo).toBe(false);

  await cleanupUser(user.id);
});

test('GET /api/capsules/my-eggs?type=PLANTED 200: 빈 목록', async () => {
  const user = await createUser('빈심은알');

  const res = await api.get('/api/capsules/my-eggs?type=PLANTED', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  expect(body.summary.totalPlantedCount).toBe(0);
  expect(body.summary.activeCount).toBe(0);
  expect(body.data.activeEggs.length).toBe(0);
  expect(body.data.expiredEggs.length).toBe(0);

  await cleanupUser(user.id);
});

// ============================================
// 발견한 알 (FOUND) 테스트
// ============================================

test('GET /api/capsules/my-eggs?type=FOUND 200: 발견한 알 조회', async () => {
  const owner = await createUser('알주인');
  const finder = await createUser('알발견자');

  // owner가 만든 알 3개
  const egg1 = await createEasterEgg(owner.id, '발견 알 1', 5, 'ACTIVE');
  const egg2 = await createEasterEgg(owner.id, '발견 알 2', 3, 'ACTIVE');
  const egg3 = await createEasterEgg(owner.id, '발견 알 3', 2, 'ACTIVE');

  // finder가 발견한 기록
  await recordCapsuleView(egg1, finder.id, new Date('2025-01-01'));
  await recordCapsuleView(egg2, finder.id, new Date('2025-01-02'));
  await recordCapsuleView(egg3, finder.id, new Date('2025-01-03'));

  const res = await api.get('/api/capsules/my-eggs?type=FOUND', {
    headers: { Authorization: `Bearer ${finder.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  expect(body.summary).toBeDefined();
  expect(body.summary.totalFoundCount).toBe(3);

  expect(body.data).toBeDefined();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBe(3);

  const foundEggIds = body.data.map((e: any) => e.eggId);
  expect(foundEggIds).toContain(egg1);
  expect(foundEggIds).toContain(egg2);
  expect(foundEggIds).toContain(egg3);

  // foundDate 확인
  const foundEgg1 = body.data.find((e: any) => e.eggId === egg1);
  expect(foundEgg1.foundDate).toBeDefined();

  await cleanupUser(owner.id);
  await cleanupUser(finder.id);
});

test('GET /api/capsules/my-eggs?type=FOUND&sort=LATEST 200: 최신순 정렬', async () => {
  const owner = await createUser('알주인2');
  const finder = await createUser('알발견자2');

  const egg1 = await createEasterEgg(owner.id, '첫 번째 발견', 5);
  const egg2 = await createEasterEgg(owner.id, '두 번째 발견', 5);
  const egg3 = await createEasterEgg(owner.id, '세 번째 발견', 5);

  // 발견 순서: egg1 → egg2 → egg3
  await recordCapsuleView(egg1, finder.id, new Date('2025-01-01'));
  await recordCapsuleView(egg2, finder.id, new Date('2025-01-02'));
  await recordCapsuleView(egg3, finder.id, new Date('2025-01-03'));

  const res = await api.get('/api/capsules/my-eggs?type=FOUND&sort=LATEST', {
    headers: { Authorization: `Bearer ${finder.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  // 최신순이므로 egg3 → egg2 → egg1
  expect(body.data[0].eggId).toBe(egg3);
  expect(body.data[1].eggId).toBe(egg2);
  expect(body.data[2].eggId).toBe(egg1);

  await cleanupUser(owner.id);
  await cleanupUser(finder.id);
});

test('GET /api/capsules/my-eggs?type=FOUND&sort=OLDEST 200: 오래된순 정렬', async () => {
  const owner = await createUser('알주인3');
  const finder = await createUser('알발견자3');

  const egg1 = await createEasterEgg(owner.id, '첫 번째', 5);
  const egg2 = await createEasterEgg(owner.id, '두 번째', 5);

  await recordCapsuleView(egg1, finder.id, new Date('2025-01-01'));
  await recordCapsuleView(egg2, finder.id, new Date('2025-01-02'));

  const res = await api.get('/api/capsules/my-eggs?type=FOUND&sort=OLDEST', {
    headers: { Authorization: `Bearer ${finder.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  // 오래된순이므로 egg1 → egg2
  expect(body.data[0].eggId).toBe(egg1);
  expect(body.data[1].eggId).toBe(egg2);

  await cleanupUser(owner.id);
  await cleanupUser(finder.id);
});

test('GET /api/capsules/my-eggs?type=FOUND 200: 빈 목록', async () => {
  const finder = await createUser('아무것도발견안함');

  const res = await api.get('/api/capsules/my-eggs?type=FOUND', {
    headers: { Authorization: `Bearer ${finder.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  expect(body.summary.totalFoundCount).toBe(0);
  expect(body.data.length).toBe(0);

  await cleanupUser(finder.id);
});

// ============================================
// Edge Cases
// ============================================

test('GET /api/capsules/my-eggs 400: type 파라미터 누락', async () => {
  const user = await createUser('type누락');

  const res = await api.get('/api/capsules/my-eggs', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('GET /api/capsules/my-eggs 400: 잘못된 type 값', async () => {
  const user = await createUser('잘못된type');

  const res = await api.get('/api/capsules/my-eggs?type=INVALID', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('GET /api/capsules/my-eggs 401: 인증 없이 요청', async () => {
  const res = await api.get('/api/capsules/my-eggs?type=PLANTED');
  expect(res.status()).toBe(401);
});

test('GET /api/capsules/my-eggs?type=PLANTED 200: 삭제된 알도 포함 (EXPIRED)', async () => {
  const user = await createUser('삭제테스트');

  const activeEgg = await createEasterEgg(user.id, '활성 알', 5, 'ACTIVE');
  const deletedEgg = await createEasterEgg(user.id, '삭제된 알', 5, 'EXPIRED');

  const res = await api.get('/api/capsules/my-eggs?type=PLANTED', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  
  expect(body.summary.totalPlantedCount).toBe(2);
  expect(body.data.activeEggs.length).toBe(1);
  expect(body.data.activeEggs[0].eggId).toBe(activeEgg);
  expect(body.data.expiredEggs.length).toBe(1);
  expect(body.data.expiredEggs[0].eggId).toBe(deletedEgg);
  expect(body.data.expiredEggs[0].status).toBe('EXPIRED');

  await cleanupUser(user.id);
});
