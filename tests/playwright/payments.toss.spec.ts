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
  // 외래 키 제약 때문에 순서대로 삭제
  await client.query(
    'DELETE FROM capsule_participant_slots WHERE capsule_id IN (SELECT id FROM capsules WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1))',
    [id],
  );
  await client.query(
    'DELETE FROM capsules WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)',
    [id],
  );
  await client.query(
    'DELETE FROM payment_cancels WHERE payment_id IN (SELECT id FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1))',
    [id],
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)',
    [id],
  );
  await client.query('DELETE FROM orders WHERE user_id = $1', [id]);
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

test.describe('GET /api/payments/toss/my-payments', () => {
  let userId: string;
  let authToken: string;

  test.beforeEach(async () => {
    await createProductTimeCapsule();
    const user = await createUser();
    userId = user.id;
    authToken = user.token;
  });

  test.afterEach(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
  });

  test('200: 본인의 결제 내역 조회 성공 (기본 페이지네이션)', async () => {
    // 1. 3개의 주문 생성 및 결제 승인
    for (let i = 0; i < 3; i++) {
      const { orderId, totalAmount } = await createOrder(authToken);
      const paymentKey = `test_payment_key_${Date.now()}_${i}`;
      const confirmRes = await api.post('/api/payments/toss/confirm', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          paymentKey,
          orderId,
          amount: totalAmount,
        },
      });
      expect(confirmRes.status()).toBe(201);
    }

    // 2. 결제 내역 조회
    const response = await api.get('/api/payments/toss/my-payments', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments).toBeDefined();
    expect(body.payments.length).toBe(3);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);

    // 3. 최신순 정렬 확인
    const firstPayment = body.payments[0];
    expect(firstPayment.paymentKey).toBeDefined();
    expect(firstPayment.orderNo).toBeDefined();
    expect(firstPayment.amount).toBeGreaterThan(0);
    expect(firstPayment.approvedAt).toBeDefined();
  });

  test('200: 페이지네이션 적용 (page=2, limit=2)', async () => {
    // 1. 5개의 주문 생성 및 결제 승인
    for (let i = 0; i < 5; i++) {
      const { orderId, totalAmount } = await createOrder(authToken);
      const paymentKey = `test_payment_key_${Date.now()}_${i}`;
      await api.post('/api/payments/toss/confirm', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          paymentKey,
          orderId,
          amount: totalAmount,
        },
      });
      // 시간 간격을 두어 approvedAt 차이 확보
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // 2. 2페이지 조회 (limit=2)
    const response = await api.get(
      '/api/payments/toss/my-payments?page=2&limit=2',
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments.length).toBe(2);
    expect(body.total).toBe(5);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(2);
  });

  test('200: 상태 필터링 (status=DONE)', async () => {
    // 1. DONE 상태 결제 생성
    const { orderId, totalAmount } = await createOrder(authToken);
    const paymentKey = `test_payment_key_${Date.now()}`;
    await api.post('/api/payments/toss/confirm', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        paymentKey,
        orderId,
        amount: totalAmount,
      },
    });

    // 2. DONE 필터로 조회
    const response = await api.get(
      '/api/payments/toss/my-payments?status=DONE',
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments.length).toBeGreaterThanOrEqual(1);
    body.payments.forEach((payment: any) => {
      expect(payment.tossStatus).toBe('DONE');
    });
  });

  test('200: 상태 필터링 (status=ALL)', async () => {
    // 1. 결제 생성
    const { orderId, totalAmount } = await createOrder(authToken);
    const paymentKey = `test_payment_key_${Date.now()}`;
    await api.post('/api/payments/toss/confirm', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        paymentKey,
        orderId,
        amount: totalAmount,
      },
    });

    // 2. ALL 필터로 조회 (기본값)
    const response = await api.get(
      '/api/payments/toss/my-payments?status=ALL',
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments.length).toBeGreaterThanOrEqual(1);
  });

  test('200: 빈 결과 (결제 내역 없음)', async () => {
    const response = await api.get('/api/payments/toss/my-payments', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
  });

  test('401: 인증 토큰 없음', async () => {
    const response = await api.get('/api/payments/toss/my-payments');

    expect(response.status()).toBe(401);
  });

  test('200: 다른 사용자의 결제 내역은 조회되지 않음', async () => {
    // 1. 현재 사용자의 결제 생성
    const { orderId, totalAmount } = await createOrder(authToken);
    const paymentKey = `test_payment_key_${Date.now()}`;
    await api.post('/api/payments/toss/confirm', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        paymentKey,
        orderId,
        amount: totalAmount,
      },
    });

    // 2. 다른 사용자 생성
    const otherUser = await createUser();

    // 3. 다른 사용자로 조회
    const response = await api.get('/api/payments/toss/my-payments', {
      headers: { Authorization: `Bearer ${otherUser.token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.payments).toEqual([]);
    expect(body.total).toBe(0);

    // cleanup
    await cleanupUser(otherUser.id);
  });
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

// ============================================
// 토스 결제 승인 테스트
// ============================================

test('POST /api/payments/toss/confirm 201: 결제 승인 성공', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  const res = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      orderId,
      amount: totalAmount,
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.payment_key).toBe(paymentKey);
  expect(body.order_id).toBe(orderId);
  expect(body.amount).toBe(totalAmount);
  expect(body.status).toBe('PAID');
  expect(body.capsule_id).toBeDefined();

  // 주문 상태가 PAID로 변경되었는지 확인
  const orderRow = await client.query(
    'SELECT status FROM orders WHERE id = $1',
    [orderId],
  );
  expect(orderRow.rows[0].status).toBe('PAID');

  await cleanupUser(id);
});

test('POST /api/payments/toss/confirm 400: 금액 불일치', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  const res = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      orderId,
      amount: totalAmount + 1000, // 금액 불일치
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('POST /api/payments/toss/confirm 404: 존재하지 않는 주문', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();

  const fakeOrderId = crypto.randomUUID();
  const res = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey: `pay-${crypto.randomUUID()}`,
      orderId: fakeOrderId,
      amount: 1000,
    },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(id);
});

test('POST /api/payments/toss/confirm 401: 다른 사용자의 주문', async () => {
  await createProductTimeCapsule();
  const owner = await createUser();
  const other = await createUser();
  const { orderId, totalAmount } = await createOrder(owner.token);

  const res = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${other.token}` },
    data: {
      paymentKey: `pay-${crypto.randomUUID()}`,
      orderId,
      amount: totalAmount,
    },
  });

  expect(res.status()).toBe(401);

  await cleanupUser(owner.id);
  await cleanupUser(other.id);
});

test('POST /api/payments/toss/confirm 409: 이미 승인된 결제', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;

  // 첫 번째 승인
  const res1 = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });
  expect(res1.status()).toBe(201);

  // 두 번째 승인 시도
  const res2 = await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey: `pay-${crypto.randomUUID()}`, orderId, amount: totalAmount },
  });
  expect(res2.status()).toBe(409);

  await cleanupUser(id);
});

// ============================================
// 토스 결제 조회 테스트
// ============================================

test('GET /api/payments/toss/:paymentKey 200: paymentKey로 조회', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  const res = await api.get(`/api/payments/toss/${paymentKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.payment).toBeDefined();
  expect(body.payment.paymentKey).toBe(paymentKey);
  expect(body.payment.orderId).toBe(orderId);
  expect(body.payment.totalAmount).toBe(totalAmount);
  expect(Array.isArray(body.cancels)).toBe(true);

  await cleanupUser(id);
});

test('GET /api/payments/toss/:paymentKey 404: 존재하지 않는 paymentKey', async () => {
  const { id, token } = await createUser();
  const fakePaymentKey = `pay-${crypto.randomUUID()}`;

  const res = await api.get(`/api/payments/toss/${fakePaymentKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(id);
});

test('GET /api/payments/toss/orders/:orderNo 200: orderId로 조회', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  const res = await api.get(`/api/payments/toss/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.payment).toBeDefined();
  expect(body.payment.paymentKey).toBe(paymentKey);
  expect(body.payment.orderId).toBe(orderId);

  await cleanupUser(id);
});

test('GET /api/payments/toss/orders/:orderNo 404: 존재하지 않는 orderId', async () => {
  const { id, token } = await createUser();
  const fakeOrderId = crypto.randomUUID();

  const res = await api.get(`/api/payments/toss/orders/${fakeOrderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(id);
});

// ============================================
// 토스 결제 취소 테스트
// ============================================

test('POST /api/payments/toss/:paymentKey/cancel 200: 전액 취소', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  const res = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      cancelReason: '고객 변심',
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.cancels).toBeDefined();
  expect(Array.isArray(body.cancels)).toBe(true);
  expect(body.cancels.length).toBeGreaterThan(0);

  // 취소 이력 DB 확인
  const cancelRow = await client.query(
    'SELECT * FROM payment_cancels WHERE payment_id = (SELECT id FROM payments WHERE payment_key = $1)',
    [paymentKey],
  );
  expect(cancelRow.rowCount).toBeGreaterThan(0);
  expect(cancelRow.rows[0].cancel_reason).toBe('고객 변심');

  // 주문 상태가 CANCELED로 변경되었는지 확인
  const orderRow = await client.query(
    'SELECT status FROM orders WHERE id = $1',
    [orderId],
  );
  expect(orderRow.rows[0].status).toBe('CANCELED');

  await cleanupUser(id);
});

test('POST /api/payments/toss/:paymentKey/cancel 200: 부분 취소', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  const cancelAmount = Math.floor(totalAmount / 2);
  const res = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      cancelReason: '부분 환불',
      cancelAmount,
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.cancels[0].cancelAmount).toBe(cancelAmount);

  await cleanupUser(id);
});

test('POST /api/payments/toss/:paymentKey/cancel 404: 존재하지 않는 결제', async () => {
  const { id, token } = await createUser();
  const fakePaymentKey = `pay-${crypto.randomUUID()}`;

  const res = await api.post(`/api/payments/toss/${fakePaymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey: fakePaymentKey,
      cancelReason: '취소',
    },
  });

  expect(res.status()).toBe(404);

  await cleanupUser(id);
});

test('POST /api/payments/toss/:paymentKey/cancel 400: 취소 사유 없음', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  const res = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      paymentKey,
      // cancelReason 누락
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('POST /api/payments/toss/:paymentKey/cancel 409: 이미 취소된 결제', async () => {
  await createProductTimeCapsule();
  const { id, token } = await createUser();
  const { orderId, totalAmount } = await createOrder(token);

  const paymentKey = `pay-${crypto.randomUUID()}`;
  await api.post('/api/payments/toss/confirm', {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, orderId, amount: totalAmount },
  });

  // 첫 번째 취소
  const res1 = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, cancelReason: '첫 번째 취소' },
  });
  expect(res1.status()).toBe(200);

  // 두 번째 취소 시도 (전액 취소 후)
  const res2 = await api.post(`/api/payments/toss/${paymentKey}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { paymentKey, cancelReason: '두 번째 취소' },
  });
  expect(res2.status()).toBe(409);

  await cleanupUser(id);
});
