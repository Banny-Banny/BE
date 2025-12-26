/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? 5432),
  user: process.env.TEST_DB_USERNAME ?? '',
  password: process.env.TEST_DB_PASSWORD ?? '',
  database: process.env.TEST_DB_DATABASE ?? '',
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

const TIME_CAPSULE_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440300';

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
    [id, 'toss-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'toss-user' }, JWT_SECRET, {
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

async function cleanupOrdersAndPayments() {
  await client.query(
    'DELETE FROM payment_cancels WHERE payment_id IN (SELECT id FROM payments)',
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders)',
  );
  await client.query(
    'DELETE FROM capsules WHERE order_id IN (SELECT id FROM orders)',
  );
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function cleanupProducts() {
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
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
  expect(res.status()).toBe(201);
  const body = await res.json();
  return {
    orderId: body.order_id as string,
    totalAmount: body.total_amount as number,
  };
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

test('토스 결제 승인 → 취소 플로우 (mock)', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  // confirm
  const paymentKey = `pay-${crypto.randomUUID()}`;
  const confirmRes = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      orderId,
      amount: totalAmount,
    },
  });
  if (confirmRes.status() !== 201) {
    console.error(
      'confirm status',
      confirmRes.status(),
      await confirmRes.text(),
    );
  }
  expect(confirmRes.status()).toBe(201);
  const confirmBody = await confirmRes.json();
  expect(confirmBody.payment_key).toBe(paymentKey);
  expect(confirmBody.status).toBe('PAID');
  expect(confirmBody.capsule_id).toBeTruthy();

  // DB 확인
  const payRow = await client.query(
    'SELECT payment_key, order_no, toss_status, method, currency, receipt_url FROM payments WHERE payment_key = $1',
    [paymentKey],
  );
  expect(payRow.rowCount).toBe(1);
  expect(payRow.rows[0].toss_status).toBe('DONE');

  // cancel
  const cancelRes = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, cancelReason: 'change of mind' },
  });
  expect(cancelRes.status()).toBe(200);
  const cancelBody = await cancelRes.json();
  expect(cancelBody.cancels.length).toBeGreaterThan(0);

  // 조회
  const getRes = await api.get(`/api/payments/toss/${paymentKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(getRes.status()).toBe(200);
  const getBody = await getRes.json();
  expect(getBody.payment.paymentKey).toBe(paymentKey);
  expect(Array.isArray(getBody.cancels)).toBe(true);
  expect(getBody.cancels.length).toBeGreaterThan(0);

  await cleanupUser(id);
});
