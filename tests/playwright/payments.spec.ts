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
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

const TIME_CAPSULE_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440100';

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
    [id, 'pay-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'pay-user' }, JWT_SECRET, {
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

async function cleanupProducts() {
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function cleanupOrdersAndPayments() {
  await client.query(
    'DELETE FROM capsules WHERE order_id IN (SELECT id FROM orders)',
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders)',
  );
  await client.query('DELETE FROM orders');
}

async function createOrder(token: string) {
  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
      add_music: false,
      add_video: false,
    },
  });
  if (res.status() !== 201) {
    console.error('order create', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  // 금액 필드 검증: base 1000 + photo 500 = 1500
  expect(body.base_amount).toBe(1000);
  expect(body.photo_amount).toBe(500);
  expect(body.music_amount).toBe(0);
  expect(body.video_amount).toBe(0);
  expect(body.total_amount).toBe(1500);
  return body.order_id as string;
}

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await cleanupOrdersAndPayments();
  await cleanupProducts();
  await client.end();
  await api.dispose();
});

test('카카오페이 ready → approve 성공 (mock)', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const orderId = await createOrder(token);

  const readyRes = await api.post('/api/payments/kakao/ready', {
    headers: { Authorization: `Bearer ${token}` },
    data: { order_id: orderId },
  });

  expect(readyRes.status()).toBe(201);
  const readyBody = await readyRes.json();
  expect(readyBody.tid).toBeTruthy();
  expect(readyBody.redirect_url).toBeTruthy();

  const approveRes = await api.post('/api/payments/kakao/approve', {
    headers: { Authorization: `Bearer ${token}` },
    data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
  });

  expect(approveRes.status()).toBe(201);
  const approveBody = await approveRes.json();
  expect(approveBody.order_id).toBe(orderId);
  expect(approveBody.status).toBe('PAID');

  await cleanupUser(id);
});

test('결제 승인 시 캡슐이 1개 생성되고 주문에 연결된다', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const orderId = await createOrder(token);

  const readyRes = await api.post('/api/payments/kakao/ready', {
    headers: { Authorization: `Bearer ${token}` },
    data: { order_id: orderId },
  });
  expect(readyRes.status()).toBe(201);

  const approveRes = await api.post('/api/payments/kakao/approve', {
    headers: { Authorization: `Bearer ${token}` },
    data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
  });
  expect(approveRes.status()).toBe(201);
  const approveBody = await approveRes.json();
  expect(approveBody.capsule_id).toBeTruthy();

  const capsuleRes = await client.query(
    'SELECT id, order_id, product_id, user_id, view_limit FROM capsules WHERE order_id = $1',
    [orderId],
  );
  expect(capsuleRes.rowCount).toBe(1);
  const row = capsuleRes.rows[0];
  expect(row.order_id).toBe(orderId);
  expect(row.product_id).toBe(TIME_CAPSULE_PRODUCT_ID);
  expect(row.user_id).toBe(id);
  expect(row.view_limit).toBe(2);

  await cleanupUser(id);
});

test('타인 주문으로 ready 시 401', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const other = await createUser();
  const orderId = await createOrder(owner.token);

  const readyRes = await api.post('/api/payments/kakao/ready', {
    headers: { Authorization: `Bearer ${other.token}` },
    data: { order_id: orderId },
  });

  expect(readyRes.status()).toBe(401);

  await cleanupUser(owner.id);
  await cleanupUser(other.id);
});
