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

async function createUser(nickname = 'detail-user') {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  const profileImg = `https://example.com/profiles/${id}.jpg`;

  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots, profile_img)
    VALUES ($1, $2, $3, 'LOCAL', 3, $4)
    `,
    [id, nickname, phone, profileImg],
  );
  const token = jwt.sign({ sub: id, nickname }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token, nickname, profileImg };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM capsule_access_logs WHERE viewer_id = $1', [
    id,
  ]);
  await client.query('DELETE FROM capsules WHERE user_id = $1', [id]);
  await client.query('DELETE FROM media WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createEasterEgg(
  userId: string,
  title: string,
  viewLimit = 5,
  isDeleted = false,
) {
  const eggId = crypto.randomUUID();
  const openAt = new Date(Date.now() + 86400000);
  const deletedAt = isDeleted ? new Date() : null;

  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, content, latitude, longitude, view_limit, view_count, is_locked, open_at, deleted_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      eggId,
      userId,
      title,
      '테스트 콘텐츠',
      37.5665,
      126.978,
      viewLimit,
      0,
      true,
      openAt,
      deletedAt,
    ],
  );
  return eggId;
}

async function createMedia(userId: string, type = 'IMAGE') {
  const mediaId = crypto.randomUUID();
  const objectKey = `media/${userId}/${type}/${mediaId}.jpg`;

  await client.query(
    `
    INSERT INTO media (id, user_id, object_key, type, content_type, size)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [mediaId, userId, objectKey, type, 'image/jpeg', 1024],
  );
  return { mediaId, objectKey };
}

async function linkMediaToCapsule(capsuleId: string, mediaIds: string[]) {
  await client.query(
    `
    UPDATE capsules 
    SET media_item_ids = $1::uuid[]
    WHERE id = $2
    `,
    [mediaIds, capsuleId],
  );
}

async function recordCapsuleView(
  capsuleId: string,
  viewerId: string,
  viewedAt = new Date(),
) {
  await client.query(
    `
    INSERT INTO capsule_access_logs (id, capsule_id, viewer_id, viewed_at)
    VALUES ($1, $2, $3, $4)
    `,
    [crypto.randomUUID(), capsuleId, viewerId, viewedAt],
  );
}

// ============================================
// 알 상세 정보 조회 테스트 - 본인이 심은 알
// ============================================

test('GET /api/capsules/:id/detail 200: 본인이 심은 알 조회', async () => {
  const user = await createUser('알주인');

  const egg = await createEasterEgg(user.id, '내가 심은 알', 5, false);

  const { mediaId: imageId, objectKey: imageKey } = await createMedia(
    user.id,
    'IMAGE',
  );
  const { mediaId: audioId, objectKey: audioKey } = await createMedia(
    user.id,
    'AUDIO',
  );
  await linkMediaToCapsule(egg, [imageId, audioId]);

  // 다른 사용자들이 발견한 기록
  const viewer1 = await createUser('발견자1');
  const viewer2 = await createUser('발견자2');
  await recordCapsuleView(egg, viewer1.id, new Date('2025-01-05'));
  await recordCapsuleView(egg, viewer2.id, new Date('2025-01-06'));

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.eggId).toBe(egg);
  expect(body.type).toBe('PLANTED'); // 본인이 심은 알
  expect(body.isMine).toBe(true);
  expect(body.title).toBe('내가 심은 알');
  expect(body.message).toBe('테스트 콘텐츠');

  // 미디어 확인
  expect(body.imageMediaId).toBe(imageId);
  expect(body.imageObjectKey).toBe(imageKey);
  expect(body.audioMediaId).toBe(audioId);
  expect(body.audioObjectKey).toBe(audioKey);
  expect(body.videoMediaId).toBeNull();

  // 위치 확인
  expect(body.location).toBeDefined();
  expect(body.location.latitude).toBe(37.5665);
  expect(body.location.longitude).toBe(126.978);

  // 작성자 확인
  expect(body.author).toBeDefined();
  expect(body.author.id).toBe(user.id);
  expect(body.author.nickname).toBe(user.nickname);
  expect(body.author.profileImg).toBe(user.profileImg);

  // 발견자 목록 확인
  expect(body.discoveredCount).toBe(2);
  expect(Array.isArray(body.viewers)).toBe(true);
  expect(body.viewers.length).toBe(2);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const viewerIds = body.viewers.map((v: any) => v.id);
  expect(viewerIds).toContain(viewer1.id);
  expect(viewerIds).toContain(viewer2.id);

  await cleanupUser(user.id);
  await cleanupUser(viewer1.id);
  await cleanupUser(viewer2.id);
});

// ============================================
// 알 상세 정보 조회 테스트 - 발견한 알
// ============================================

test('GET /api/capsules/:id/detail 200: 내가 발견한 알 조회', async () => {
  const owner = await createUser('알주인2');
  const finder = await createUser('발견자');

  const egg = await createEasterEgg(owner.id, '발견한 알', 3, false);

  const { mediaId: imageId } = await createMedia(owner.id, 'IMAGE');
  await linkMediaToCapsule(egg, [imageId]);

  // finder가 발견한 기록
  const foundAt = new Date('2025-01-10T14:30:00Z');
  await recordCapsuleView(egg, finder.id, foundAt);

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${finder.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.eggId).toBe(egg);
  expect(body.type).toBe('FOUND'); // 발견한 알
  expect(body.isMine).toBe(false);
  expect(body.title).toBe('발견한 알');

  // 발견 시각 확인
  expect(body.foundAt).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  expect(new Date(body.foundAt).getTime()).toBe(foundAt.getTime());

  // 작성자는 알주인
  expect(body.author.id).toBe(owner.id);
  expect(body.author.nickname).toBe(owner.nickname);

  await cleanupUser(owner.id);
  await cleanupUser(finder.id);
});

// ============================================
// Edge Cases
// ============================================

test('GET /api/capsules/:id/detail 404: 존재하지 않는 알', async () => {
  const user = await createUser('사용자');
  const fakeEggId = crypto.randomUUID();

  const res = await api.get(`/api/capsules/${fakeEggId}/detail`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(user.id);
});

test('GET /api/capsules/:id/detail 200: 본인이 심은 삭제된 알은 조회 가능', async () => {
  const user = await createUser('사용자2');
  const egg = await createEasterEgg(user.id, '삭제될 알', 5, true);

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.eggId).toBe(egg);
  expect(body.isMine).toBe(true);
  expect(body.expiredAt).not.toBeNull();

  await cleanupUser(user.id);
});

test('GET /api/capsules/:id/detail 400: 잘못된 UUID 형식', async () => {
  const user = await createUser('사용자3');

  const res = await api.get('/api/capsules/invalid-uuid/detail', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(user.id);
});

test('GET /api/capsules/:id/detail 401: 인증 없이 요청', async () => {
  const user = await createUser('사용자4');
  const egg = await createEasterEgg(user.id, '알', 5, false);

  const res = await api.get(`/api/capsules/${egg}/detail`);

  expect(res.status()).toBe(401);

  await cleanupUser(user.id);
});

test('GET /api/capsules/:id/detail 200: 미디어 없는 알', async () => {
  const user = await createUser('미디어없음');
  const egg = await createEasterEgg(user.id, '텍스트만', 5, false);

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.imageMediaId).toBeNull();
  expect(body.audioMediaId).toBeNull();
  expect(body.videoMediaId).toBeNull();

  await cleanupUser(user.id);
});

test('GET /api/capsules/:id/detail 200: 발견자 목록 최신순 정렬', async () => {
  const owner = await createUser('알주인정렬');
  const viewer1 = await createUser('발견1');
  const viewer2 = await createUser('발견2');
  const viewer3 = await createUser('발견3');

  const egg = await createEasterEgg(owner.id, '정렬테스트', 5, false);

  // 발견 순서: viewer1 → viewer2 → viewer3
  await recordCapsuleView(egg, viewer1.id, new Date('2025-01-01'));
  await recordCapsuleView(egg, viewer2.id, new Date('2025-01-02'));
  await recordCapsuleView(egg, viewer3.id, new Date('2025-01-03'));

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.viewers.length).toBe(3);

  // 최신순이므로 viewer3 → viewer2 → viewer1 (viewedAt 기준 오름차순)
  const viewedDates = body.viewers.map((v: any) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new Date(v.viewedAt).getTime(),
  );
  for (let i = 0; i < viewedDates.length - 1; i++) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(viewedDates[i]).toBeLessThanOrEqual(viewedDates[i + 1]);
  }

  await cleanupUser(owner.id);
  await cleanupUser(viewer1.id);
  await cleanupUser(viewer2.id);
  await cleanupUser(viewer3.id);
});

test('GET /api/capsules/:id/detail 200: expiredAt 확인 (만료된 알)', async () => {
  const user = await createUser('만료테스트');

  // 이미 만료된 알 (deleted_at 설정)
  const egg = await createEasterEgg(user.id, '만료된 알', 3, true);
  await client.query(
    `
    UPDATE capsules 
    SET open_at = NOW() - interval '1 day',
        view_count = 3,
        is_locked = false
    WHERE id = $1
    `,
    [egg],
  );

  const res = await api.get(`/api/capsules/${egg}/detail`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.expiredAt).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  expect(new Date(body.expiredAt).getTime()).toBeLessThan(Date.now());

  await cleanupUser(user.id);
});
