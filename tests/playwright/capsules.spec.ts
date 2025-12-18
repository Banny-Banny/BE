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

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

let api: APIRequestContext;
let client: Client;

async function createProductEasterEgg(limit = 1) {
  const productId = '00000000-0000-0000-0000-0000000000a1';
  await client.query('DELETE FROM products WHERE id = $1', [productId]);
  await client.query(
    `
    INSERT INTO products (id, name, price, media_types, max_media_count, product_type, is_active)
    VALUES ($1, 'e2e-egg', 0, '{"IMAGE"}'::products_media_types_enum[], $2, 'EASTER_EGG', true)
    `,
    [productId, limit],
  );
  return productId;
}

test.beforeAll(async ({ playwright }) => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await client.query('DELETE FROM products WHERE id = $1', [
    '00000000-0000-0000-0000-0000000000a1',
  ]);
  await client.end();
  await api.dispose();
});

// 프론트 연동 없는 환경을 위한 하드코딩 유저/토큰 생성기
async function createUser(eggSlots = 3) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', $4)
    `,
    [id, 'e2e-user', phone, eggSlots],
  );
  const token = jwt.sign({ sub: id, nickname: 'e2e-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function cleanupFriendships(a: string, b: string) {
  await client.query(
    'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
    [a, b],
  );
}

async function connectFriends(a: string, b: string) {
  await cleanupFriendships(a, b);
  await client.query(
    `INSERT INTO friendships (id, user_id, friend_id, status) VALUES ($1, $2, $3, 'CONNECTED')`,
    [crypto.randomUUID(), a, b],
  );
  await client.query(
    `INSERT INTO friendships (id, user_id, friend_id, status) VALUES ($1, $2, $3, 'CONNECTED')`,
    [crypto.randomUUID(), b, a],
  );
}

async function createCapsule(ownerId: string, productId: string | null, lat = 37.0, lng = 127.0) {
  const capId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, product_id, title, content, media_urls, media_types, open_at, is_locked, view_limit, view_count, latitude, longitude)
    VALUES ($1, $2, $3, 'capsule', 'content', '{"https://cdn.example.com/1.jpg"}', '{"IMAGE"}',
            NOW() + interval '1 day', true, 1, 0, $4, $5)
    `,
    [capId, ownerId, productId, lat, lng],
  );
  return capId;
}

async function createConsumedCapsule(ownerId: string, lat = 37.0, lng = 127.0) {
  const capId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, content, media_urls, media_types, open_at, is_locked, view_limit, view_count, latitude, longitude)
    VALUES ($1, $2, 'capsule-consumed', 'content', '{"https://cdn.example.com/1.jpg"}', '{"IMAGE"}',
            NOW() - interval '1 day', false, 1, 1, $3, $4)
    `,
    [capId, ownerId, lat, lng],
  );
  return capId;
}

async function insertMedia(ownerId: string) {
  const objectKey = `media/${crypto.randomUUID()}.jpg`;
  const { rows } = await client.query(
    `
    INSERT INTO media (user_id, object_key, type, content_type, size)
    VALUES ($1, $2, 'IMAGE', 'image/jpeg', 1024)
    RETURNING id
    `,
    [ownerId, objectKey],
  );
  return rows[0].id as string;
}

test('캡슐 생성 성공 (201) 및 슬롯 차감', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'e2e capsule',
      content: 'hello world',
      media_urls: ['https://cdn.example.com/img1.jpg'],
      media_types: ['IMAGE'],
      open_at: openAt,
      view_limit: 1,
    },
  });

  if (res.status() !== 201) {
    console.error('create error', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  expect(body.media_types?.[0]).toBe('IMAGE');

  const { rows } = await client.query(
    'SELECT egg_slots FROM users WHERE id = $1',
    [id],
  );
  expect(rows[0].egg_slots).toBe(2);

  await cleanupUser(id);
});

test('캡슐 조회 200 (친구+위치 도달)', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);
  const productId = await createProductEasterEgg(1);
  const capId = await createCapsule(owner.id, productId, 37.0, 127.0);

  const res = await api.get(`/api/capsule/${capId}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(capId);
  expect(body.product?.product_type).toBe('EASTER_EGG');

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('캡슐 조회 403 (친구 아님)', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  const capId = await createCapsule(owner.id, null, 37.0, 127.0);

  const res = await api.get(`/api/capsule/${capId}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(403);

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('캡슐 조회 403 (위치 반경 밖)', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);
  const capId = await createCapsule(owner.id, null, 37.0, 127.0);

  const res = await api.get(`/api/capsule/${capId}?lat=38.0&lng=128.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(403);

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('캡슐 조회 404 (없음)', async () => {
  const viewer = await createUser(3);
  const fakeId = crypto.randomUUID();

  const res = await api.get(`/api/capsule/${fakeId}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(viewer.id);
});

test('캡슐 조회 400 (uuid 형식 오류)', async () => {
  const viewer = await createUser(3);
  const res = await api.get(`/api/capsule/not-uuid?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });
  expect(res.status()).toBe(400);
  await cleanupUser(viewer.id);
});

test('슬롯 부족 시 409', async () => {
  const { id, token } = await createUser(0);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'slot exhausted',
      open_at: openAt,
    },
  });

  if (res.status() !== 409) {
    console.error('slot error', res.status(), await res.text());
  }
  expect(res.status()).toBe(409);

  await cleanupUser(id);
});

test('open_at이 과거면 400', async () => {
  const { id, token } = await createUser(3);
  const past = new Date(Date.now() - 60_000).toISOString();

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'past open',
      open_at: past,
    },
  });

  if (res.status() !== 400) {
    console.error('past error', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('목록 조회 200: 반경 내 + 친구', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);
  const productId = await createProductEasterEgg(1);
  const capId = await createCapsule(owner.id, productId, 37.0, 127.0);

  const res = await api.get(
    `/api/capsule?lat=37.0&lng=127.0&radius_m=500&limit=10`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
  const found = body.items.find((item) => item.id === capId);
  expect(found).toBeTruthy();
  expect(found.product.product_type).toBe('EASTER_EGG');
  expect(found.is_locked).toBe(true);

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('목록 조회에서 소비된 캡슐 기본 제외, include_consumed=true 시 노출', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);
  const consumedId = await createConsumedCapsule(owner.id, 37.0, 127.0);

  const res1 = await api.get(
    `/api/capsule?lat=37.0&lng=127.0&radius_m=500&limit=10`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  const found1 = body1.items.find((item) => item.id === consumedId);
  expect(found1).toBeFalsy();

  const res2 = await api.get(
    `/api/capsule?lat=37.0&lng=127.0&radius_m=500&limit=10&include_consumed=true`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  const found2 = body2.items.find((item) => item.id === consumedId);
  expect(found2).toBeTruthy();
  expect(found2.can_open).toBe(false);

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [consumedId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('목록 조회 400: 좌표 범위/반경/limit 오류', async () => {
  const viewer = await createUser(3);
  const res = await api.get(
    `/api/capsule?lat=1000&lng=127.0&radius_m=999999&limit=999`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res.status()).toBe(400);
  await cleanupUser(viewer.id);
});

test('media type가 IMAGE인데 url 없음 → 400', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'media mismatch',
      media_types: ['IMAGE'],
      media_urls: [null],
      open_at: openAt,
    },
  });

  if (res.status() !== 400) {
    console.error('media mismatch', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('EASTER_EGG 상품 max_media_count 초과시 400', async () => {
  const { id, token } = await createUser(3);
  const productId = await createProductEasterEgg(1);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'product limit',
      product_id: productId,
      media_types: ['IMAGE', 'IMAGE'], // 2개 > limit 1
      media_urls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
      open_at: openAt,
    },
  });

  if (res.status() !== 400) {
    console.error('product limit', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('media_ids + text_blocks로 캡슐 생성 201', async () => {
  const owner = await createUser(3);
  const mediaId = await insertMedia(owner.id);

  const res = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      title: '멀티미디어 캡슐',
      media_ids: [mediaId],
      text_blocks: [
        { order: 0, content: '첫 번째 메시지' },
        { order: 1, content: '두 번째 메시지' },
      ],
      view_limit: 0,
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  expect(Array.isArray(body.media_items)).toBe(true);
  expect(body.media_items[0]?.media_id).toBe(mediaId);
  expect(body.text_blocks?.length).toBe(2);

  await cleanupUser(owner.id);
});

test('media_ids + text_blocks 조회 200 (친구)', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);
  const mediaId = await insertMedia(owner.id);

  const createRes = await api.post('/api/capsule', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      title: '친구 조회 캡슐',
      media_ids: [mediaId],
      text_blocks: [{ order: 0, content: '공유 메시지' }],
    },
  });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  const getRes = await api.get(`/api/capsule/${created.id}`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(getRes.status()).toBe(200);
  const body = await getRes.json();
  expect(body.media_items?.[0]?.media_id).toBe(mediaId);
  expect(body.text_blocks?.[0]?.content).toBe('공유 메시지');

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await cleanupFriendships(owner.id, viewer.id);
});