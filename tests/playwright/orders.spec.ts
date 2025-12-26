/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME ?? '',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? '',
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

const TIME_CAPSULE_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'; // valid v4
const WRONG_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440001';

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
    [id, 'order-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'order-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createProductTimeCapsule() {
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

async function createProductWrongType() {
  await client.query('DELETE FROM products WHERE id = $1', [WRONG_PRODUCT_ID]);
  await client.query(
    `
    INSERT INTO products (id, name, price, product_type, is_active, media_types, max_media_count)
    VALUES ($1, 'wrong-type-product', 0, 'EASTER_EGG', true, '{"IMAGE"}', 1)
    `,
    [WRONG_PRODUCT_ID],
  );
}

async function cleanupProducts() {
  await client.query('DELETE FROM products WHERE id IN ($1, $2)', [
    TIME_CAPSULE_PRODUCT_ID,
    WRONG_PRODUCT_ID,
  ]);
}

async function cleanupOrders() {
  await client.query('DELETE FROM orders WHERE product_id IN ($1, $2)', [
    TIME_CAPSULE_PRODUCT_ID,
    WRONG_PRODUCT_ID,
  ]);
}

async function setProductActive(productId: string, active: boolean) {
  await client.query('UPDATE products SET is_active = $2 WHERE id = $1', [
    productId,
    active,
  ]);
}

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await cleanupOrders();
  await cleanupProducts();
  await client.end();
  await api.dispose();
});

test('주문 생성 201: 옵션/금액 계산', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 4, // 4 * 500 = 2000
      add_music: true, // 1000
      add_video: false, // 0
    },
  });

  if (res.status() !== 201) {
    console.error('order create', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  // total: time(1주=1000) + image(4*500*2=4000, headcount 2 반영) + audio(1000) = 6000
  expect(body.total_amount).toBe(6000);
  // 세부 금액 검증
  expect(body.time_option_amount).toBe(1000);
  expect(body.image_amount).toBe(4000);
  expect(body.audio_amount).toBe(1000);
  expect(body.video_amount).toBe(0);
  expect(body.status).toBe('PENDING_PAYMENT');
  expect(body.headcount).toBe(2);
  expect(body.photo_count).toBe(4);

  await cleanupUser(id);
});

test('photo_count가 인원당 제한 초과시 400', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 1,
      photo_count: 11, // headcount(1) * 10 초과
    },
  });

  expect(res.status()).toBe(400);
  await cleanupUser(id);
});

test('커스텀 시점 과거면 400', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const past = new Date(Date.now() - 60_000).toISOString();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: 'CUSTOM',
      custom_open_at: past,
      headcount: 2,
      photo_count: 0,
    },
  });

  expect(res.status()).toBe(400);
  await cleanupUser(id);
});

test('product가 TIME_CAPSULE 아니면 404', async () => {
  await createProductWrongType();
  const { id, token } = await createUser();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: WRONG_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
    },
  });

  expect(res.status()).toBe(404);
  await cleanupUser(id);
});

test('product 미존재시 404', async () => {
  const { id, token } = await createUser();
  const fakeProduct = crypto.randomUUID();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: fakeProduct,
      time_option: '1_WEEK',
      headcount: 2,
    },
  });

  expect(res.status()).toBe(404);
  await cleanupUser(id);
});

test('주문 조회 200: 주문 + 상품 제약 반환', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
      add_music: true,
      add_video: false,
    },
  });
  expect(createRes.status()).toBe(201);
  const body = await createRes.json();
  const orderId = body.order_id as string;

  const getRes = await api.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.status() !== 200) {
    console.error('GET /orders status', getRes.status(), await getRes.text());
  }
  expect(getRes.status()).toBe(200);
  const detail = await getRes.json();
  expect(detail.order.order_id).toBe(orderId);
  expect(detail.order.headcount).toBe(2);
  expect(detail.order.photo_count).toBe(1);
  expect(detail.order.add_music).toBe(true);
  expect(detail.order.add_video).toBe(false);
  expect(detail.product.id).toBe(TIME_CAPSULE_PRODUCT_ID);
  expect(detail.product.product_type).toBe('TIME_CAPSULE');

  await cleanupUser(userId);
});

test('주문 조회 403: 소유자 아님', async () => {
  await createProductTimeCapsule();
  const { id: ownerId, token: ownerToken } = await createUser();
  const { token: otherToken } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  const getRes = await api.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  if (getRes.status() !== 403) {
    console.error(
      'GET /orders (other user) status',
      getRes.status(),
      await getRes.text(),
    );
  }
  expect(getRes.status()).toBe(403);

  await cleanupUser(ownerId);
});

test('주문 조회 404: 상품 비활성', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  // 비활성 처리 후 조회 시 404
  await setProductActive(TIME_CAPSULE_PRODUCT_ID, false);

  const getRes = await api.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(getRes.status()).toBe(404);

  await setProductActive(TIME_CAPSULE_PRODUCT_ID, true);
  await cleanupUser(userId);
});
