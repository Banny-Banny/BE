/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// 플레이wright E2E는 테스트 전용 환경변수를 우선 로드한다.
dotenv.config({ path: '.env' });
dotenv.config();

const DB_CONFIG = {
  host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 5432),
  user: process.env.TEST_DB_USERNAME ?? process.env.DB_USERNAME ?? 'postgres',
  password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? 'postgres',
  // PGDATABASE(로컬 OS 계정명)로 잘못 붙는 것을 방지하기 위해 명시적 기본값 사용
  database:
    process.env.TEST_DB_DATABASE ??
    process.env.DB_DATABASE ??
    'banny_banny_test',
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

const TIME_CAPSULE_PRODUCT_ID = '00000000-0000-0000-0000-00000000c001';

let api: APIRequestContext;
let client: Client;

async function createUser() {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', 3)
    `,
    [id, 'entry-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'entry-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM capsule_entries WHERE user_id = $1', [id]);
  await client.query(
    'DELETE FROM capsule_participant_slots WHERE user_id = $1',
    [id],
  );
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createProductTimeCapsule() {
  await client.query('DELETE FROM capsule_entries');
  await client.query('DELETE FROM capsule_participant_slots');
  await client.query('DELETE FROM capsules WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query(
    `
    INSERT INTO products (id, name, price, product_type, is_active)
    VALUES ($1, 'time-capsule-product', 0, 'TIME_CAPSULE', true)
    `,
    [TIME_CAPSULE_PRODUCT_ID],
  );
}

async function cleanupProductsAndCapsules() {
  await client.query('DELETE FROM capsule_entries');
  await client.query('DELETE FROM capsule_participant_slots');
  await client.query('DELETE FROM capsules WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function createPaidOrderWithCapsule(
  userId: string,
  headcount: number,
  status: 'PAID' | 'PENDING_PAYMENT' = 'PAID',
) {
  const orderId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO orders (id, user_id, product_id, total_amount, time_option, custom_open_at, headcount,
                        photo_count, add_music, add_video, status)
    VALUES ($1, $2, $3, 0, '1_WEEK', NULL, $4, 0, false, false, $5)
    `,
    [orderId, userId, TIME_CAPSULE_PRODUCT_ID, headcount, status],
  );

  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, product_id, order_id, title, content, media_urls, media_types,
                          open_at, is_locked, view_limit, view_count, latitude, longitude)
    VALUES ($1, $2, $3, $4, 'capsule-title', NULL, NULL, NULL,
            NOW() + interval '1 day', true, $5, 0, NULL, NULL)
    `,
    [capsuleId, userId, TIME_CAPSULE_PRODUCT_ID, orderId, headcount],
  );

  return { orderId, capsuleId };
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

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  console.log(
    `[e2e-db] host=${DB_CONFIG.host}:${DB_CONFIG.port} db=${DB_CONFIG.database} user=${DB_CONFIG.user}`,
  );
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await cleanupProductsAndCapsules();
  await client.end();
  await api.dispose();
});

test('PAID 캡슐 조회: 슬롯/작성자/미디어 포함 200', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const { capsuleId } = await createPaidOrderWithCapsule(owner.id, 2, 'PAID');

  const res = await api.get(`/api/capsules/${capsuleId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(capsuleId);
  expect(Array.isArray(body.slots)).toBe(true);
  expect(body.slots.length).toBe(2);

  await cleanupUser(owner.id);
});

test('미결제 캡슐 조회: 403', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const { capsuleId } = await createPaidOrderWithCapsule(
    owner.id,
    1,
    'PENDING_PAYMENT',
  );

  const res = await api.get(`/api/capsules/${capsuleId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });

  expect(res.status()).toBe(403);

  await cleanupUser(owner.id);
});

test('슬롯 작성 성공 201, 중복 작성 409', async () => {
  await createProductTimeCapsule();
  const writer = await createUser();
  const { capsuleId } = await createPaidOrderWithCapsule(writer.id, 1, 'PAID');
  const mediaId = await insertMedia(writer.id);

  const first = await api.post(`/api/capsules/${capsuleId}/entries`, {
    headers: { Authorization: `Bearer ${writer.token}` },
    data: {
      content: 'my first entry',
      media_item_ids: [mediaId],
    },
  });
  expect(first.status()).toBe(201);
  const firstBody = await first.json();
  expect(firstBody.slot_index).toBe(0);
  expect(firstBody.media_items?.[0]?.media_id).toBe(mediaId);

  const second = await api.post(`/api/capsules/${capsuleId}/entries`, {
    headers: { Authorization: `Bearer ${writer.token}` },
    data: { content: 'again' },
  });
  expect(second.status()).toBe(409);

  await cleanupUser(writer.id);
});

test('다른 유저가 남은 슬롯을 작성, 이후 슬롯 가득 시 409', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const other = await createUser();
  const { capsuleId } = await createPaidOrderWithCapsule(owner.id, 1, 'PAID');

  const first = await api.post(`/api/capsules/${capsuleId}/entries`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { content: 'owner entry' },
  });
  expect(first.status()).toBe(201);

  const second = await api.post(`/api/capsules/${capsuleId}/entries`, {
    headers: { Authorization: `Bearer ${other.token}` },
    data: { content: 'other entry' },
  });
  expect(second.status()).toBe(409);

  await cleanupUser(owner.id);
  await cleanupUser(other.id);
});

test('타인 media_id 사용 시 403', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const another = await createUser();
  const { capsuleId } = await createPaidOrderWithCapsule(owner.id, 1, 'PAID');
  const foreignMediaId = await insertMedia(another.id);

  const res = await api.post(`/api/capsules/${capsuleId}/entries`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { content: 'with foreign media', media_item_ids: [foreignMediaId] },
  });

  expect(res.status()).toBe(403);

  await cleanupUser(owner.id);
  await cleanupUser(another.id);
});
