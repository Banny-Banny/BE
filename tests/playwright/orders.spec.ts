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
  // token_version은 기본값 0이므로 명시하지 않아도 됨
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots, is_active)
    VALUES ($1, $2, $3, 'LOCAL', 3, true)
    `,
    [id, 'order-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'order-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)',
    [id],
  );
  await client.query('DELETE FROM orders WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createProductTimeCapsule() {
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      JOIN orders o ON o.id = tc.order_id
      WHERE o.product_id = $1
    )
    `,
    [TIME_CAPSULE_PRODUCT_ID],
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE product_id = $1)',
    [TIME_CAPSULE_PRODUCT_ID],
  );
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

async function createProductWrongType() {
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE product_id = $1)',
    [WRONG_PRODUCT_ID],
  );
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    WRONG_PRODUCT_ID,
  ]);
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
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE product_id IN ($1, $2))',
    [TIME_CAPSULE_PRODUCT_ID, WRONG_PRODUCT_ID],
  );
  await client.query('DELETE FROM orders WHERE product_id IN ($1, $2)', [
    TIME_CAPSULE_PRODUCT_ID,
    WRONG_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM products WHERE id IN ($1, $2)', [
    TIME_CAPSULE_PRODUCT_ID,
    WRONG_PRODUCT_ID,
  ]);
}

async function cleanupOrders() {
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE product_id IN ($1, $2))',
    [TIME_CAPSULE_PRODUCT_ID, WRONG_PRODUCT_ID],
  );
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
      photo_count: 4,
      add_music: true,
      add_video: false,
    },
  });

  if (res.status() !== 201) {
    console.error('order create', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  // total: time(1주=1000) + image(2*4*500=4000) + audio(2*1000=2000) + video(0) = 7000
  expect(body.total_amount).toBe(7000);
  // 세부 금액 검증
  expect(body.time_option_amount).toBe(1000);
  expect(body.image_amount).toBe(4000); // 인원(2) × 이미지(4) × 500
  expect(body.audio_amount).toBe(2000); // 인원(2) × 1000
  expect(body.video_amount).toBe(0);
  expect(body.status).toBe('PENDING_PAYMENT');
  expect(body.headcount).toBe(2);
  expect(body.photo_count).toBe(4);

  await cleanupUser(id);
});

test('주문 생성 201: 모든 옵션 포함 금액 계산', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 3,
      photo_count: 5, // 최대 5장
      add_music: true,
      add_video: true,
    },
  });

  if (res.status() !== 201) {
    console.error('order create (all options)', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  // total: time(1주=1000) + image(3*5*500=7500) + audio(3*1000=3000) + video(3*2000=6000) = 17500
  expect(body.total_amount).toBe(17500);
  expect(body.time_option_amount).toBe(1000);
  expect(body.image_amount).toBe(7500); // 인원(3) × 이미지(5) × 500
  expect(body.audio_amount).toBe(3000); // 인원(3) × 1000
  expect(body.video_amount).toBe(6000); // 인원(3) × 2000
  expect(body.status).toBe('PENDING_PAYMENT');
  expect(body.headcount).toBe(3);
  expect(body.photo_count).toBe(5);
  expect(body.add_music).toBe(true);
  expect(body.add_video).toBe(true);

  await cleanupUser(id);
});

test('photo_count가 최대 제한 초과시 400', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();

  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 1,
      photo_count: 6, // 최대 5장 초과
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

// ===========================================
// 주문 상태 조회 및 변경 테스트
// ===========================================

test('주문 상태 조회 200: 결제 정보 없음', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  let createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    },
  });
  expect(createRes.status()).toBe(201);
  let orderId = (await createRes.json()).order_id as string;

  let statusRes = await api.get(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (statusRes.status() === 404) {
    // 재시도: 간헐적 데이터 정리로 주문이 사라지는 경우 대비
    createRes = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 2,
        photo_count: 1,
      },
    });
    expect(createRes.status()).toBe(201);
    orderId = (await createRes.json()).order_id as string;
    statusRes = await api.get(`/api/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  if (statusRes.status() !== 200) {
    console.error(
      'GET /orders/:orderId/status status',
      statusRes.status(),
      await statusRes.text(),
    );
  }
  expect(statusRes.status()).toBe(200);
  const body = await statusRes.json();
  expect(body.order_id).toBe(orderId);
  expect(body.order_status).toBe('PENDING_PAYMENT');
  expect(body.payment_status).toBeNull();
  expect(body.total_amount).toBeGreaterThan(0);
  expect(body.payment_amount).toBeNull();
  expect(body.payment_key).toBeNull();
  expect(body.approved_at).toBeNull();
  expect(body.created_at).toBeDefined();

  await cleanupUser(userId);
});

test('주문 상태 조회 200: 결제 정보 있음', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  // 결제 정보 생성
  const paymentId = crypto.randomUUID();
  const paymentKey = `test-payment-key-${crypto.randomUUID()}`;
  await client.query(
    `
    INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid)
    VALUES ($1, $2, $3, $4, 'READY', 'KRW', $5)
    `,
    [paymentId, orderId, paymentKey, 1500, paymentKey],
  );

  const statusRes = await api.get(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(statusRes.status()).toBe(200);
  const body = await statusRes.json();
  expect(body.order_id).toBe(orderId);
  expect(body.order_status).toBe('PENDING_PAYMENT');
  expect(body.payment_status).toBe('READY');
  expect(body.payment_amount).toBe(1500);
  expect(body.payment_key).toBe(paymentKey);

  await cleanupUser(userId);
});

test('주문 상태 조회 403: 소유자 아님', async () => {
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

  const statusRes = await api.get(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  if (statusRes.status() !== 403) {
    console.error(
      'GET /orders/:orderId/status (other user) status',
      statusRes.status(),
      await statusRes.text(),
    );
  }
  expect(statusRes.status()).toBe(403);

  await cleanupUser(ownerId);
});

test('주문 상태 조회 404: 주문 미존재', async () => {
  const { id: userId, token } = await createUser();
  const fakeOrderId = crypto.randomUUID();

  const statusRes = await api.get(`/api/orders/${fakeOrderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(statusRes.status()).toBe(404);

  await cleanupUser(userId);
});

test('주문 상태 변경 201: PENDING_PAYMENT -> CANCELED (결제 정보 없음)', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'CANCELED',
    },
  });
  if (updateRes.status() !== 200) {
    console.error(
      'PATCH /orders/:orderId/status status',
      updateRes.status(),
      await updateRes.text(),
    );
  }
  expect(updateRes.status()).toBe(201);
  const body = await updateRes.json();
  expect(body.order_id).toBe(orderId);
  expect(body.order_status).toBe('CANCELED');
  expect(body.payment_status).toBeNull();
  expect(body.updated_at).toBeDefined();

  // 상태 확인
  const statusRes = await api.get(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(statusRes.status()).toBe(200);
  const statusBody = await statusRes.json();
  expect(statusBody.order_status).toBe('CANCELED');

  await cleanupUser(userId);
});

test('주문 상태 변경 201: PENDING_PAYMENT -> PAID (결제 정보 동기화)', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  // 결제 정보 생성 (READY 상태)
  const paymentId = crypto.randomUUID();
  const paymentKey = `test-payment-key-${crypto.randomUUID()}`;
  await client.query(
    `
    INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid)
    VALUES ($1, $2, $3, $4, 'READY', 'KRW', $5)
    `,
    [paymentId, orderId, paymentKey, 1500, paymentKey],
  );

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'PAID',
    },
  });
  expect(updateRes.status()).toBe(201);
  const body = await updateRes.json();
  expect(body.order_id).toBe(orderId);
  expect(body.order_status).toBe('PAID');
  expect(body.payment_status).toBe('PAID'); // 결제 정보 동기화 확인
  expect(body.updated_at).toBeDefined();

  // 상태 확인
  const statusRes = await api.get(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(statusRes.status()).toBe(200);
  const statusBody = await statusRes.json();
  expect(statusBody.order_status).toBe('PAID');
  expect(statusBody.payment_status).toBe('PAID');

  await cleanupUser(userId);
});

test('주문 상태 변경 201: PAID -> CANCELED (결제 정보 동기화)', async () => {
  await createProductTimeCapsule();
  const { id: userId, token } = await createUser();

  const createRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    },
  });
  expect(createRes.status()).toBe(201);
  const orderId = (await createRes.json()).order_id as string;

  // 주문 상태를 PAID로 직접 변경
  await client.query('UPDATE orders SET status = $1 WHERE id = $2', [
    'PAID',
    orderId,
  ]);

  // 결제 정보 생성 (PAID 상태)
  const paymentId = crypto.randomUUID();
  const paymentKey = `test-payment-key-${crypto.randomUUID()}`;
  await client.query(
    `
    INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid)
    VALUES ($1, $2, $3, $4, 'PAID', 'KRW', $5)
    `,
    [paymentId, orderId, paymentKey, 1500, paymentKey],
  );

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'CANCELED',
    },
  });
  expect(updateRes.status()).toBe(201);
  const body = await updateRes.json();
  expect(body.order_id).toBe(orderId);
  expect(body.order_status).toBe('CANCELED');
  expect(body.payment_status).toBe('CANCELED'); // 결제 정보 동기화 확인

  await cleanupUser(userId);
});

test('주문 상태 변경 400: 유효하지 않은 상태 전환 (PAID -> PENDING_PAYMENT)', async () => {
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

  // 주문 상태를 PAID로 직접 변경
  await client.query('UPDATE orders SET status = $1 WHERE id = $2', [
    'PAID',
    orderId,
  ]);

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'PENDING_PAYMENT',
    },
  });
  expect(updateRes.status()).toBe(400);

  await cleanupUser(userId);
});

test('주문 상태 변경 400: 유효하지 않은 상태 전환 (CANCELED -> PAID)', async () => {
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

  // 주문 상태를 CANCELED로 직접 변경
  await client.query('UPDATE orders SET status = $1 WHERE id = $2', [
    'CANCELED',
    orderId,
  ]);

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'PAID',
    },
  });
  expect(updateRes.status()).toBe(400);

  await cleanupUser(userId);
});

test('주문 상태 변경 403: 소유자 아님', async () => {
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

  const updateRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${otherToken}` },
    data: {
      status: 'CANCELED',
    },
  });
  if (updateRes.status() !== 403) {
    console.error(
      'PATCH /orders/:orderId/status (other user) status',
      updateRes.status(),
      await updateRes.text(),
    );
  }
  expect(updateRes.status()).toBe(403);

  await cleanupUser(ownerId);
});

test('주문 상태 변경 404: 주문 미존재', async () => {
  const { id: userId, token } = await createUser();
  const fakeOrderId = crypto.randomUUID();

  const updateRes = await api.post(`/api/orders/${fakeOrderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      status: 'CANCELED',
    },
  });
  expect(updateRes.status()).toBe(404);

  await cleanupUser(userId);
});
