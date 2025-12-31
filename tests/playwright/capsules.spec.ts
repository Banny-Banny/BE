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

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'e2e capsule',
      content: 'hello world',
      media_urls: ['https://cdn.example.com/img1.jpg'],
      media_types: ['IMAGE'],
      open_at: openAt,
      view_limit: 1,
      latitude: 37.5665,
      longitude: 126.978,
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

  const res = await api.get(`/api/capsules/${capId}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(capId);
  expect(body.product?.product_type).toBe('EASTER_EGG');
  // 작성자 정보 확인
  expect(body.author).toBeTruthy();
  expect(body.author.id).toBe(owner.id);
  expect(body.author.nickname).toBeTruthy();
  // 조회자 목록 확인 (현재 조회한 viewer 포함)
  expect(Array.isArray(body.viewers)).toBe(true);
  expect(body.viewers.length).toBeGreaterThan(0);
  const currentViewer = body.viewers.find((v) => v.id === viewer.id);
  expect(currentViewer).toBeTruthy();
  expect(currentViewer.viewed_at).toBeTruthy();
  // 생성일시 확인
  expect(body.created_at).toBeTruthy();

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('캡슐 조회 403 (친구 아님)', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  const capId = await createCapsule(owner.id, null, 37.0, 127.0);

  const res = await api.get(`/api/capsules/${capId}?lat=37.0&lng=127.0`, {
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

  const res = await api.get(`/api/capsules/${capId}?lat=38.0&lng=128.0`, {
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

  const res = await api.get(`/api/capsules/${fakeId}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(viewer.id);
});

test('캡슐 조회 400 (uuid 형식 오류)', async () => {
  const viewer = await createUser(3);
  const res = await api.get(`/api/capsules/not-uuid?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });
  expect(res.status()).toBe(400);
  await cleanupUser(viewer.id);
});

test('슬롯 부족 시 409', async () => {
  const { id, token } = await createUser(0);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'slot exhausted',
      open_at: openAt,
      latitude: 37.5665,
      longitude: 126.978,
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

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'past open',
      open_at: past,
      latitude: 37.5665,
      longitude: 126.978,
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
    `/api/capsules?lat=37.0&lng=127.0&radius_m=500&limit=10`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
  const found = body.items.find((item) => item.id === capId);
  expect(found).toBeTruthy();
  expect(found.product.product_type).toBe('EASTER_EGG');
  expect(found.type).toBe('EASTER_EGG');
  expect(found.is_mine).toBe(false); // viewer가 조회했으므로 owner의 캡슐은 is_mine=false
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
    `/api/capsules?lat=37.0&lng=127.0&radius_m=500&limit=10`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  const found1 = body1.items.find((item) => item.id === consumedId);
  expect(found1).toBeFalsy();

  const res2 = await api.get(
    `/api/capsules?lat=37.0&lng=127.0&radius_m=500&limit=10&include_consumed=true`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  const found2 = body2.items.find((item) => item.id === consumedId);
  expect(found2).toBeTruthy();
  expect(found2.can_open).toBe(false);
  expect(found2.type).toBe('EASTER_EGG'); // product가 null이면 기본값 EASTER_EGG
  expect(found2.is_mine).toBe(false); // viewer가 조회했으므로 owner의 캡슐은 is_mine=false

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [consumedId]);
  await cleanupFriendships(owner.id, viewer.id);
});

test('목록 조회 400: 좌표 범위/반경/limit 오류', async () => {
  const viewer = await createUser(3);
  const res = await api.get(
    `/api/capsules?lat=1000&lng=127.0&radius_m=999999&limit=999`,
    { headers: { Authorization: `Bearer ${viewer.token}` } },
  );
  expect(res.status()).toBe(400);
  await cleanupUser(viewer.id);
});

test('목록 조회에서 본인 캡슐은 is_mine=true', async () => {
  const owner = await createUser(3);
  const productId = await createProductEasterEgg(1);
  const capId = await createCapsule(owner.id, productId, 37.0, 127.0);

  const res = await api.get(
    `/api/capsules?lat=37.0&lng=127.0&radius_m=500&limit=10`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );

  expect(res.status()).toBe(200);
  const body = await res.json();
  const found = body.items.find((item) => item.id === capId);
  expect(found).toBeTruthy();
  expect(found.is_mine).toBe(true); // owner가 조회했으므로 본인 캡슐은 is_mine=true
  expect(found.type).toBe('EASTER_EGG');

  await cleanupUser(owner.id);
  await client.query('DELETE FROM capsules WHERE id = $1', [capId]);
});

test('media type가 IMAGE인데 url 없음 → 400', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'media mismatch',
      media_types: ['IMAGE'],
      media_urls: [null],
      open_at: openAt,
      latitude: 37.5665,
      longitude: 126.978,
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

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'product limit',
      product_id: productId,
      media_types: ['IMAGE', 'IMAGE'], // 2개 > limit 1
      media_urls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
      open_at: openAt,
      latitude: 37.5665,
      longitude: 126.978,
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

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      title: '멀티미디어 캡슐',
      media_ids: [mediaId],
      text_blocks: [
        { order: 0, content: '첫 번째 메시지' },
        { order: 1, content: '두 번째 메시지' },
      ],
      view_limit: 0,
      latitude: 37.5665,
      longitude: 126.978,
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

  const createRes = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      title: '친구 조회 캡슐',
      media_ids: [mediaId],
      text_blocks: [{ order: 0, content: '공유 메시지' }],
      latitude: 37.5665,
      longitude: 126.978,
    },
  });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  const getRes = await api.get(`/api/capsules/${created.id}?lat=37.5665&lng=126.978`, {
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

test('이스터에그 생성 시 위도 없으면 400', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'no latitude',
      open_at: openAt,
      longitude: 126.978,
    },
  });

  if (res.status() !== 400) {
    console.error('no latitude error', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);
  const body = await res.text();
  expect(body).toContain('LATITUDE_REQUIRED_FOR_EASTER_EGG');

  await cleanupUser(id);
});

test('이스터에그 생성 시 경도 없으면 400', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'no longitude',
      open_at: openAt,
      latitude: 37.5665,
    },
  });

  if (res.status() !== 400) {
    console.error('no longitude error', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);
  const body = await res.text();
  expect(body).toContain('LONGITUDE_REQUIRED_FOR_EASTER_EGG');

  await cleanupUser(id);
});

test('슬롯 초기화 201: 캡슐이 없는 경우', async () => {
  const { id, token } = await createUser(2);

  const res = await api.post('/api/capsules/slots/reset', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.egg_slots).toBe(3);

  // DB에서 실제로 3으로 변경되었는지 확인
  const { rows } = await client.query(
    'SELECT egg_slots FROM users WHERE id = $1',
    [id],
  );
  expect(rows[0].egg_slots).toBe(3);

  await cleanupUser(id);
});

test('슬롯 초기화 201: 캡슐이 있는 경우 모두 삭제', async () => {
  const { id, token } = await createUser(3);

  // 캡슐 2개 생성
  const cap1Res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'capsule 1',
      latitude: 37.5665,
      longitude: 126.978,
    },
  });
  expect(cap1Res.status()).toBe(201);
  const cap1 = await cap1Res.json();

  const cap2Res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'capsule 2',
      latitude: 37.5665,
      longitude: 126.978,
    },
  });
  expect(cap2Res.status()).toBe(201);
  const cap2 = await cap2Res.json();

  // 슬롯이 1 남았는지 확인
  const { rows: beforeRows } = await client.query(
    'SELECT egg_slots FROM users WHERE id = $1',
    [id],
  );
  expect(beforeRows[0].egg_slots).toBe(1);

  // 초기화 요청
  const resetRes = await api.post('/api/capsules/slots/reset', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(resetRes.status()).toBe(201);
  const body = await resetRes.json();
  expect(body.egg_slots).toBe(3);

  // 슬롯이 3으로 복구되었는지 확인
  const { rows: afterRows } = await client.query(
    'SELECT egg_slots FROM users WHERE id = $1',
    [id],
  );
  expect(afterRows[0].egg_slots).toBe(3);

  // 캡슐이 소프트 삭제되었는지 확인
  const { rows: capsuleRows } = await client.query(
    'SELECT id, deleted_at FROM capsules WHERE id = ANY($1::uuid[])',
    [[cap1.id, cap2.id]],
  );
  expect(capsuleRows.length).toBe(2);
  capsuleRows.forEach((row) => {
    expect(row.deleted_at).not.toBeNull();
  });

  await cleanupUser(id);
});

test('슬롯 초기화 201: 관련 데이터(entry, slot, access_log) 모두 삭제', async () => {
  const owner = await createUser(3);
  const viewer = await createUser(3);
  await connectFriends(owner.id, viewer.id);

  // 캡슐 생성
  const capRes = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      title: 'test capsule',
      latitude: 37.0,
      longitude: 127.0,
    },
  });
  expect(capRes.status()).toBe(201);
  const capsule = await capRes.json();

  // viewer가 조회하여 access_log 생성
  await api.get(`/api/capsules/${capsule.id}?lat=37.0&lng=127.0`, {
    headers: { Authorization: `Bearer ${viewer.token}` },
  });

  // access_log가 생성되었는지 확인
  const { rows: logsBefore } = await client.query(
    'SELECT * FROM capsule_access_logs WHERE capsule_id = $1',
    [capsule.id],
  );
  expect(logsBefore.length).toBeGreaterThan(0);

  // 슬롯 초기화
  const resetRes = await api.post('/api/capsules/slots/reset', {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(resetRes.status()).toBe(201);

  // access_log가 삭제되었는지 확인
  const { rows: logsAfter } = await client.query(
    'SELECT * FROM capsule_access_logs WHERE capsule_id = $1',
    [capsule.id],
  );
  expect(logsAfter.length).toBe(0);

  await cleanupUser(owner.id);
  await cleanupUser(viewer.id);
  await cleanupFriendships(owner.id, viewer.id);
});

test('슬롯 초기화 후 다시 캡슐 생성 가능', async () => {
  const { id, token } = await createUser(3);

  // 캡슐 3개 생성 (슬롯 모두 사용)
  for (let i = 0; i < 3; i++) {
    const res = await api.post('/api/capsules', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `capsule ${i + 1}`,
        latitude: 37.5665,
        longitude: 126.978,
      },
    });
    expect(res.status()).toBe(201);
  }

  // 슬롯이 0이 되어 생성 불가
  const failRes = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'should fail',
      latitude: 37.5665,
      longitude: 126.978,
    },
  });
  expect(failRes.status()).toBe(409);

  // 슬롯 초기화
  const resetRes = await api.post('/api/capsules/slots/reset', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resetRes.status()).toBe(201);

  // 다시 캡슐 생성 가능
  const successRes = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'new capsule after reset',
      latitude: 37.5665,
      longitude: 126.978,
    },
  });
  expect(successRes.status()).toBe(201);

  await cleanupUser(id);
});
