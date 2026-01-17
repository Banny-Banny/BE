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

const TIME_CAPSULE_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440200';

let api: APIRequestContext;
let client: Client;

async function createUser() {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots, is_active)
    VALUES ($1, $2, $3, 'LOCAL', 3, true)
    `,
    [id, 'capsule-title-user', phone],
  );
  const token = jwt.sign(
    { sub: id, nickname: 'capsule-title-user' },
    JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );
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

async function cleanupOrdersAndCapsules() {
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      JOIN orders o ON o.id = tc.order_id
      WHERE o.product_id = $1
    )
    `,
    [TIME_CAPSULE_PRODUCT_ID],
  );
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
}

async function createOrder(
  token: string,
  data: {
    product_id: string;
    time_option: string;
    headcount: number;
    photo_count?: number;
    add_music?: boolean;
    add_video?: boolean;
    capsule_title?: string;
  },
) {
  const orderRes = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (orderRes.status() !== 201) {
    console.error('order create', orderRes.status(), await orderRes.text());
  }
  expect(orderRes.status()).toBe(201);
  const body = await orderRes.json();
  return body.order_id as string;
}

async function markOrderPaid(orderId: string, token: string) {
  const statusRes = await api.post(`/api/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'PAID' },
  });
  if (statusRes.status() !== 201) {
    console.error('order status', statusRes.status(), await statusRes.text());
  }
  expect(statusRes.status()).toBe(201);
}

async function createStepRoom(orderId: string, token: string) {
  const res = await api.post('/api/capsules/step-rooms/create', {
    headers: { Authorization: `Bearer ${token}` },
    data: { order_id: orderId },
  });
  if (res.status() !== 201) {
    console.error('step room create', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  return (await res.json()) as {
    capsule_id: string;
    invite_code: string;
    title: string;
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
  await cleanupOrdersAndCapsules();
  await cleanupProducts();
  await client.end();
  await api.dispose();
});

test.describe('Capsule Title - Order Creation', () => {
  test('주문 생성 시 capsule_title을 포함할 수 있다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const res = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 2,
        photo_count: 3,
        add_music: false,
        add_video: false,
        capsule_title: 'Our Precious Memories',
      },
    });

    if (res.status() !== 201) {
      console.error('order create with title', res.status(), await res.text());
    }
    expect(res.status()).toBe(201);
    const body = await res.json();

    // DB에서 주문 정보 확인
    const orderRes = await client.query(
      'SELECT capsule_title FROM orders WHERE id = $1',
      [body.order_id],
    );
    expect(orderRes.rows[0].capsule_title).toBe('Our Precious Memories');

    await cleanupUser(id);
  });

  test('주문 생성 시 capsule_title은 선택적이다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const res = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 2,
        photo_count: 1,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    // DB에서 주문 정보 확인
    const orderRes = await client.query(
      'SELECT capsule_title FROM orders WHERE id = $1',
      [body.order_id],
    );
    expect(orderRes.rows[0].capsule_title).toBeNull();

    await cleanupUser(id);
  });

  test('capsule_title은 최대 100자까지 가능하다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const validTitle = 'A'.repeat(100);
    const res = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 1,
        capsule_title: validTitle,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    const orderRes = await client.query(
      'SELECT capsule_title FROM orders WHERE id = $1',
      [body.order_id],
    );
    expect(orderRes.rows[0].capsule_title).toBe(validTitle);

    await cleanupUser(id);
  });

  test('capsule_title이 100자를 초과하면 400 에러를 반환한다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const tooLongTitle = 'A'.repeat(101);
    const res = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 1,
        capsule_title: tooLongTitle,
      },
    });

    expect(res.status()).toBe(400);

    await cleanupUser(id);
  });
});

test.describe('Capsule Title - Step Room Creation', () => {
  test('결제 완료 시 타임캡슐이 주문의 제목으로 생성된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 3,
      photo_count: 2,
      add_music: true,
      capsule_title: 'Summer Vacation 2025',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('Summer Vacation 2025');

    // DB에서 캡슐 제목 확인
    const capsuleRes = await client.query(
      `SELECT c.title
       FROM capsules c
       JOIN time_capsules tc ON tc.capsule_id = c.id
       WHERE tc.order_id = $1`,
      [orderId],
    );
    expect(capsuleRes.rows[0].title).toBe('Summer Vacation 2025');

    await cleanupUser(id);
  });

  test('제목이 없는 주문은 기본 제목으로 타임캡슐이 생성된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      photo_count: 1,
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('My Time Capsule');

    // DB에서 캡슐 제목 확인
    const capsuleRes = await client.query(
      `SELECT c.title
       FROM capsules c
       JOIN time_capsules tc ON tc.capsule_id = c.id
       WHERE tc.order_id = $1`,
      [orderId],
    );
    expect(capsuleRes.rows[0].title).toBe('My Time Capsule');

    await cleanupUser(id);
  });

  test('주문 상태를 PAID로 변경하면 제목이 올바르게 적용된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_MONTH',
      headcount: 4,
      photo_count: 5,
      capsule_title: 'Friends Forever',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('Friends Forever');

    await cleanupUser(id);
  });
});

test.describe('Capsule Title - Step Room API', () => {
  test('초대 코드 조회 시 캡슐 제목이 반환된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      capsule_title: 'Weekend Getaway',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    const inviteCode = stepRoom.invite_code;

    // 초대 코드로 조회
    const queryRes = await api.get(
      `/api/capsules/step-rooms/by-code?invite_code=${inviteCode}`,
    );

    expect(queryRes.status()).toBe(200);
    const queryBody = await queryRes.json();
    expect(queryBody.capsule_name).toBe('Weekend Getaway');

    await cleanupUser(id);
  });

  test('대기실 상세 조회 시 캡슐 제목이 반환된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_YEAR',
      headcount: 3,
      capsule_title: 'New Year Wishes 2025',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    const roomId = stepRoom.capsule_id;

    // 대기실 상세 조회
    const detailRes = await api.get(`/api/capsules/step-rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(detailRes.status()).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.capsule_name).toBe('New Year Wishes 2025');

    await cleanupUser(id);
  });

  test('대기실 설정값 조회 시 캡슐 제목이 반환된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 5,
      photo_count: 5,
      add_music: true,
      add_video: true,
      capsule_title: 'Team Building 2025',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    const roomId = stepRoom.capsule_id;

    // 설정값 조회
    const settingsRes = await api.get(
      `/api/capsules/step-rooms/${roomId}/settings`,
    );

    expect(settingsRes.status()).toBe(200);
    const settingsBody = await settingsRes.json();
    expect(settingsBody.capsule_name).toBe('Team Building 2025');
    expect(settingsBody.max_participants).toBe(5);
    expect(settingsBody.has_music).toBe(true);
    expect(settingsBody.has_video).toBe(true);

    await cleanupUser(id);
  });
});

test.describe('Capsule Title - Special Characters', () => {
  test('한글 제목이 올바르게 저장되고 조회된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      capsule_title: '우리의 소중한 추억',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('우리의 소중한 추억');

    await cleanupUser(id);
  });

  test('이모지가 포함된 제목이 올바르게 처리된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      capsule_title: '🎉 Happy Birthday 2025 🎂',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('🎉 Happy Birthday 2025 🎂');

    await cleanupUser(id);
  });

  test('특수문자가 포함된 제목이 올바르게 처리된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    const orderId = await createOrder(token, {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: 2,
      capsule_title: 'Best Friends #2025 @Seoul!',
    });
    await markOrderPaid(orderId, token);
    const stepRoom = await createStepRoom(orderId, token);
    expect(stepRoom.title).toBe('Best Friends #2025 @Seoul!');

    await cleanupUser(id);
  });
});
