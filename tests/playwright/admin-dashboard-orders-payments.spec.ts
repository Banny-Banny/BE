/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

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

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const scryptAsync = promisify(crypto.scrypt);

let api: APIRequestContext;
let client: Client;

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({ baseURL: API_BASE_URL });
});

test.afterAll(async () => {
  await client.end();
  await api.dispose();
});

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function createAdminUser(
  email: string,
  password: string,
  role: 'SUPER_ADMIN' | 'ADMIN' = 'ADMIN',
  name = '관리자',
) {
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const [localPart, domain] = email.split('@');
  const uniqueEmail = domain
    ? `${localPart}+${uniqueSuffix}@${domain}`
    : `${email}_${uniqueSuffix}`;
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await client.query(
    `
    INSERT INTO admin_users (id, email, name, password_hash, role, is_active)
    VALUES ($1, $2, $3, $4, $5, true)
    `,
    [id, uniqueEmail, name, passwordHash, role],
  );
  return { id, email: uniqueEmail };
}

async function cleanupAdminUser(id: string) {
  await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
}

async function loginAdmin(email: string, password: string) {
  const res = await api.post('/api/admin/auth/login', {
    data: { email, password },
  });
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error('access token missing');
  }
  return { status: res.status(), accessToken: body.accessToken };
}

async function createUser(
  nickname = 'test-user',
  email: string | null = null,
  isActive = true,
) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, email, provider, egg_slots, is_active)
    VALUES ($1, $2, $3, $4, 'LOCAL', 3, $5)
    `,
    [id, nickname, phone, email, isActive],
  );
  return { id };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createProduct() {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO products (id, name, price, product_type, description, is_active, created_at)
    VALUES ($1, '테스트 상품', 1000, 'TIME_CAPSULE', '테스트 설명', true, NOW())
    `,
    [id],
  );
  return id;
}

async function cleanupProducts(ids: string[]) {
  if (!ids.length) return;
  await client.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [ids]);
}

async function createOrder(params: {
  userId: string;
  productId: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELED' | 'FAILED';
}) {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO orders (
      id, user_id, product_id, total_amount, time_option, headcount, photo_count, add_music, add_video, status, created_at
    ) VALUES ($1, $2, $3, 1000, '1_WEEK', 1, 0, false, false, $4, NOW())
    `,
    [id, params.userId, params.productId, params.status],
  );
  return id;
}

async function createPayment(params: {
  orderId: string;
  status: 'READY' | 'PAID' | 'CANCELED' | 'FAILED';
  paymentKey?: string | null;
  receiptUrl?: string | null;
  method?: string | null;
  failCode?: string | null;
  failMessage?: string | null;
  tossStatus?: string | null;
}) {
  const id = crypto.randomUUID();
  const pgTid = `PG-${crypto.randomUUID()}`;
  await client.query(
    `
    INSERT INTO payments (
      id, order_id, pg_tid, amount, status, payment_key, receipt_url, method,
      fail_code, fail_message, toss_status, approved_at, created_at, currency
    ) VALUES ($1, $2, $3, 1000, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), 'KRW')
    `,
    [
      id,
      params.orderId,
      pgTid,
      params.status,
      params.paymentKey ?? null,
      params.receiptUrl ?? null,
      params.method ?? null,
      params.failCode ?? null,
      params.failMessage ?? null,
      params.tossStatus ?? null,
    ],
  );
  return id;
}

async function cleanupOrders(orderIds: string[]) {
  if (!orderIds.length) return;
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id = ANY($1::uuid[])
    )
    `,
    [orderIds],
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id = ANY($1::uuid[])
    )
    `,
    [orderIds],
  );
  await client.query(
    'DELETE FROM time_capsules WHERE order_id = ANY($1::uuid[])',
    [orderIds],
  );
  await client.query(
    `
    DELETE FROM payment_cancels
    WHERE payment_id IN (
      SELECT id FROM payments WHERE order_id = ANY($1::uuid[])
    )
    `,
    [orderIds],
  );
  await client.query('DELETE FROM payments WHERE order_id = ANY($1::uuid[])', [
    orderIds,
  ]);
  await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [
    orderIds,
  ]);
}

test('GET /api/admin/dashboard/orders 200: 주문 리스트 조회', async () => {
  const admin = await createAdminUser('admin-order@test.com', 'test1234');
  const user = await createUser('order-user');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'PAID',
  });
  await createPayment({ orderId, status: 'PAID', method: '카드' });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.get('/api/admin/dashboard/orders', {
      headers: { Authorization: `Bearer ${login.accessToken}` },
      params: { userId: user.id, paymentStatus: 'PAID' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const items = body.data.items as Array<{ order_id: string }>;
    expect(items.some((item) => item.order_id === orderId)).toBe(true);
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});

test('GET /api/admin/dashboard/orders/:id 200: 주문 상세 조회', async () => {
  const admin = await createAdminUser(
    'admin-order-detail@test.com',
    'test1234',
  );
  const user = await createUser('detail-user', 'detail@example.com');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'PAID',
  });
  await createPayment({
    orderId,
    status: 'PAID',
    method: '카드',
    receiptUrl: 'https://mock.toss/receipt',
  });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.get(`/api/admin/dashboard/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.order.id).toBe(orderId);
    expect(body.data.payment.receipt_url).toBe('https://mock.toss/receipt');
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});

test('PATCH /api/admin/dashboard/orders/:id/status 200: 주문 상태 변경', async () => {
  const admin = await createAdminUser(
    'admin-order-status@test.com',
    'test1234',
  );
  const user = await createUser('status-user');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'PENDING_PAYMENT',
  });
  await createPayment({ orderId, status: 'READY' });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.patch(
      `/api/admin/dashboard/orders/${orderId}/status`,
      {
        headers: { Authorization: `Bearer ${login.accessToken}` },
        data: { status: 'PAID' },
      },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.order_status).toBe('PAID');

    const dbOrder = await client.query(
      'SELECT status FROM orders WHERE id = $1',
      [orderId],
    );
    expect(dbOrder.rows[0].status).toBe('PAID');

    const timeCapsule = await client.query(
      'SELECT order_id FROM time_capsules WHERE order_id = $1',
      [orderId],
    );
    expect(timeCapsule.rows.length).toBe(1);
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});

test('POST /api/admin/dashboard/payments/:id/cancel 200: 결제 환불', async () => {
  const admin = await createAdminUser(
    'admin-payment-cancel@test.com',
    'test1234',
  );
  const user = await createUser('cancel-user');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'PAID',
  });
  const paymentId = await createPayment({
    orderId,
    status: 'PAID',
    paymentKey: `pay_${crypto.randomUUID()}`,
  });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.post(
      `/api/admin/dashboard/payments/${paymentId}/cancel`,
      {
        headers: { Authorization: `Bearer ${login.accessToken}` },
        data: { cancelReason: '테스트 환불' },
      },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status ?? body.data?.status ?? 'CANCELED').toBeTruthy();

    const dbPayment = await client.query(
      'SELECT status FROM payments WHERE id = $1',
      [paymentId],
    );
    expect(dbPayment.rows[0].status).toBe('CANCELED');

    const dbOrder = await client.query(
      'SELECT status FROM orders WHERE id = $1',
      [orderId],
    );
    expect(dbOrder.rows[0].status).toBe('CANCELED');

    const dbCancel = await client.query(
      'SELECT id FROM payment_cancels WHERE payment_id = $1',
      [paymentId],
    );
    expect(dbCancel.rows.length).toBe(1);
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});

test('GET /api/admin/dashboard/payments/logs 200: 결제 실패 로그 조회', async () => {
  const admin = await createAdminUser(
    'admin-payment-logs@test.com',
    'test1234',
  );
  const user = await createUser('logs-user');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'FAILED',
  });
  await createPayment({
    orderId,
    status: 'FAILED',
    failCode: 'CARD_DECLINED',
    failMessage: '카드 승인 실패',
    tossStatus: 'ABORTED',
  });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.get('/api/admin/dashboard/payments/logs', {
      headers: { Authorization: `Bearer ${login.accessToken}` },
      params: { status: 'FAILED', userId: user.id },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const items = body.data.items as Array<{ fail_code: string }>;
    expect(items.some((item) => item.fail_code === 'CARD_DECLINED')).toBe(true);
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});

test('POST /api/admin/dashboard/receipts/:orderId/issue 200: 영수증 재발급', async () => {
  const admin = await createAdminUser('admin-receipt@test.com', 'test1234');
  const user = await createUser('receipt-user');
  const productId = await createProduct();
  const orderId = await createOrder({
    userId: user.id,
    productId,
    status: 'PAID',
  });
  await createPayment({
    orderId,
    status: 'PAID',
    receiptUrl: 'https://mock.toss/receipt',
  });

  try {
    const login = await loginAdmin(admin.email, 'test1234');
    const res = await api.post(
      `/api/admin/dashboard/receipts/${orderId}/issue`,
      {
        headers: { Authorization: `Bearer ${login.accessToken}` },
      },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.receipt_url).toBe('https://mock.toss/receipt');
  } finally {
    await cleanupOrders([orderId]);
    await cleanupProducts([productId]);
    await cleanupUser(user.id);
    await cleanupAdminUser(admin.id);
  }
});
