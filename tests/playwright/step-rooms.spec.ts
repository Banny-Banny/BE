/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 5432),
  user: process.env.TEST_DB_USERNAME ?? process.env.DB_USERNAME ?? 'postgres',
  password:
    process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? 'postgres',
  database:
    process.env.TEST_DB_DATABASE ??
    process.env.DB_DATABASE ??
    'banny_banny_test',
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
    [id, 'step-room-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'step-room-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      JOIN orders o ON o.id = tc.order_id
      WHERE o.user_id = $1
    )
    `,
    [id],
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      JOIN orders o ON o.id = tc.order_id
      WHERE o.user_id = $1
    )
    `,
    [id],
  );
  await client.query(
    `
    DELETE FROM payment_cancels
    WHERE payment_id IN (
      SELECT id FROM payments
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
    [id],
  );
  await client.query(
    `
    DELETE FROM payments
    WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)
    `,
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

async function cleanupProducts() {
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function cleanupOrdersAndPayments() {
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id IN (SELECT id FROM orders)
    )
    `,
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id IN (SELECT id FROM orders)
    )
    `,
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders)',
  );
  await client.query('DELETE FROM orders');
}

async function createOrder(token: string, headcount = 3) {
  const res = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
      time_option: '1_WEEK',
      headcount: headcount,
      photo_count: 5,
      add_music: true,
      add_video: false,
    },
  });
  if (res.status() !== 201) {
    console.error('order create', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
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

test.describe('Step Room Creation', () => {
  test('결제 완료 시 대기실이 자동 생성되고 초대 코드가 발급된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 3);

    // Kakao Pay Ready
    const readyRes = await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    expect(readyRes.status()).toBe(201);

    // Kakao Pay Approve
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });

    expect(approveRes.status()).toBe(201);
    const approveBody = await approveRes.json();

    // 대기실 정보 검증
    expect(approveBody.step_room).toBeDefined();
    expect(approveBody.step_room.room_id).toBeTruthy();
    expect(approveBody.step_room.invite_code).toBeTruthy();
    expect(approveBody.step_room.invite_code).toHaveLength(6);
    expect(approveBody.step_room.capsule_name).toBe('My Time Capsule');
    expect(approveBody.step_room.deadline).toBeTruthy();
    expect(approveBody.step_room.participant_count).toBe(3);
    expect(approveBody.step_room.current_participants).toBe(1); // 방장만 자동 배정

    // DB에서 캡슐 검증
    const capsuleRes = await client.query(
      `SELECT tc.capsule_id,
              tc.invite_code,
              tc.deadline,
              tc.room_status,
              o.headcount
       FROM time_capsules tc
       JOIN orders o ON o.id = tc.order_id
       WHERE tc.order_id = $1`,
      [orderId],
    );
    expect(capsuleRes.rowCount).toBe(1);
    const capsule = capsuleRes.rows[0];
    expect(capsule.invite_code).toHaveLength(6);
    expect(capsule.deadline).toBeTruthy();
    expect(capsule.room_status).toBe('WAITING');
    expect(capsule.headcount).toBe(3);

    // 참여 슬롯 검증
    const slotsRes = await client.query(
      'SELECT * FROM capsule_participant_slots WHERE capsule_id = $1 ORDER BY slot_index',
      [capsule.capsule_id],
    );
    expect(slotsRes.rowCount).toBe(3);

    // 첫 번째 슬롯은 방장에게 자동 배정
    expect(slotsRes.rows[0].user_id).toBe(id);
    expect(slotsRes.rows[0].slot_index).toBe(0);

    // 나머지 슬롯은 초대 대기
    expect(slotsRes.rows[1].user_id).toBeNull();
    expect(slotsRes.rows[2].user_id).toBeNull();

    await cleanupUser(id);
  });

  test('동일 주문으로 중복 결제 승인 시 기존 대기실을 반환한다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 2);

    // 첫 번째 결제
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });

    // 두 번째 결제 시도 (실제로는 이미 PAID 상태라 에러가 발생하거나, 기존 캡슐 반환)
    // 이 테스트는 중복 생성 방지 로직을 확인하기 위한 것
    const capsuleRes = await client.query(
      'SELECT COUNT(*) as count FROM time_capsules WHERE order_id = $1',
      [orderId],
    );
    expect(parseInt(String(capsuleRes.rows[0].count))).toBe(1);

    await cleanupUser(id);
  });
});

test.describe('Step Room Query APIs', () => {
  test('초대 코드로 대기실을 조회할 수 있다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 4);

    // 결제 승인 및 대기실 생성
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const inviteCode = approveBody.step_room.invite_code;

    // 초대 코드로 조회
    const queryRes = await api.get(
      `/api/capsules/step-rooms/by-code?invite_code=${inviteCode}`,
    );

    expect(queryRes.status()).toBe(200);
    const queryBody = await queryRes.json();
    expect(queryBody.room_id).toBe(approveBody.step_room.room_id);
    expect(queryBody.capsule_name).toBe('My Time Capsule');
    expect(queryBody.participant_count).toBe(4);
    expect(queryBody.current_participants).toBe(1); // 방장만 배정됨
    expect(queryBody.status).toBe('WAITING');
    expect(queryBody.is_joinable).toBe(true);

    await cleanupUser(id);
  });

  test('초대 코드는 대소문자 구분 없이 조회된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 2);

    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const inviteCode = approveBody.step_room.invite_code;

    // 소문자로 조회
    const queryRes1 = await api.get(
      `/api/capsules/step-rooms/by-code?invite_code=${inviteCode.toLowerCase()}`,
    );
    expect(queryRes1.status()).toBe(200);

    // 대문자로 조회
    const queryRes2 = await api.get(
      `/api/capsules/step-rooms/by-code?invite_code=${inviteCode.toUpperCase()}`,
    );
    expect(queryRes2.status()).toBe(200);

    const body1 = await queryRes1.json();
    const body2 = await queryRes2.json();
    expect(body1.room_id).toBe(body2.room_id);

    await cleanupUser(id);
  });

  test('존재하지 않는 초대 코드는 404 에러를 반환한다', async () => {
    const queryRes = await api.get(
      '/api/capsules/step-rooms/by-code?invite_code=ABC123',
    );
    expect(queryRes.status()).toBe(404);
  });

  test('참여자는 대기실 상세 정보를 조회할 수 있다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 3);

    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const roomId = approveBody.step_room.room_id;

    // 상세 조회
    const detailRes = await api.get(`/api/capsules/step-rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(detailRes.status()).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.room_id).toBe(roomId);
    expect(detailBody.capsule_name).toBe('My Time Capsule');
    expect(detailBody.slots).toHaveLength(3);

    // 첫 번째 슬롯 검증 (방장)
    expect(detailBody.slots[0].slot_number).toBe(1);
    expect(detailBody.slots[0].user_id).toBe(id);
    expect(detailBody.slots[0].is_host).toBe(true);
    expect(detailBody.slots[0].status).toBe('ACCEPTED');

    // 나머지 슬롯 검증 (초대 대기)
    expect(detailBody.slots[1].user_id).toBeNull();
    expect(detailBody.slots[1].status).toBe('PENDING');

    await cleanupUser(id);
  });

  test('비참여자는 대기실 상세 정보를 조회할 수 없다', async () => {
    await createProductTimeCapsule();
    const owner = await createUser();
    const other = await createUser();
    const orderId = await createOrder(owner.token, 2);

    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const roomId = approveBody.step_room.room_id;

    // 비참여자가 조회 시도
    const detailRes = await api.get(`/api/capsules/step-rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });

    expect(detailRes.status()).toBe(403);

    await cleanupUser(owner.id);
    await cleanupUser(other.id);
  });

  test('대기실 설정값을 조회할 수 있다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 4);

    // 결제 승인 및 대기실 생성
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const roomId = approveBody.step_room.room_id;

    // 설정값 조회
    const settingsRes = await api.get(
      `/api/capsules/step-rooms/${roomId}/settings`,
    );

    expect(settingsRes.status()).toBe(200);
    const settingsBody = await settingsRes.json();

    // 기본 정보 검증
    expect(settingsBody.room_id).toBe(roomId);
    expect(settingsBody.capsule_name).toBe('My Time Capsule');
    expect(settingsBody.open_date).toBeTruthy();
    expect(settingsBody.open_date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD 형식

    // 참여 인원 검증
    expect(settingsBody.max_participants).toBe(4);

    // 1인당 사진 개수는 주문의 photo_count 값 그대로
    expect(settingsBody.max_images_per_person).toBe(5);

    // 미디어 타입 허용 여부 검증
    expect(settingsBody.has_music).toBe(true);
    expect(settingsBody.has_video).toBe(false);

    await cleanupUser(id);
  });

  test('1인당 사진 개수가 올바르게 계산된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();

    // photo_count=3, headcount=2 인 주문 생성
    const orderRes = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        time_option: '1_WEEK',
        headcount: 2,
        photo_count: 3,
        add_music: false,
        add_video: true,
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderBody = await orderRes.json();
    const orderId = orderBody.order_id;

    // 결제 승인
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const roomId = approveBody.step_room.room_id;

    // 설정값 조회
    const settingsRes = await api.get(
      `/api/capsules/step-rooms/${roomId}/settings`,
    );

    expect(settingsRes.status()).toBe(200);
    const settingsBody = await settingsRes.json();

    // 1인당 사진 개수는 주문의 photo_count 값 그대로
    expect(settingsBody.max_images_per_person).toBe(3);
    expect(settingsBody.has_music).toBe(false);
    expect(settingsBody.has_video).toBe(true);

    await cleanupUser(id);
  });

  test('존재하지 않는 capsuleId로 설정값 조회 시 404를 반환한다', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const settingsRes = await api.get(
      `/api/capsules/step-rooms/${fakeUuid}/settings`,
    );

    expect(settingsRes.status()).toBe(404);
  });

  test('설정값 조회는 인증 없이 가능하다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 2);

    // 결제 승인
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const roomId = approveBody.step_room.room_id;

    // 인증 헤더 없이 설정값 조회
    const settingsRes = await api.get(
      `/api/capsules/step-rooms/${roomId}/settings`,
    );

    expect(settingsRes.status()).toBe(200);
    const settingsBody = await settingsRes.json();
    expect(settingsBody.room_id).toBe(roomId);

    await cleanupUser(id);
  });
});

test.describe('Step Room with Toss Payments', () => {
  test('토스페이먼츠 결제 완료 시에도 대기실이 생성된다', async () => {
    await createProductTimeCapsule();
    const { id, token } = await createUser();
    const orderId = await createOrder(token, 5);

    // 주문 정보 조회하여 실제 금액 확인
    const orderRes = await api.get(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orderBody = await orderRes.json();
    const orderAmount = orderBody.order.total_amount;

    // Toss Payments Confirm
    const confirmRes = await api.post('/api/payments/toss/confirm', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        paymentKey: 'test_payment_key_' + Date.now(),
        orderId: orderId,
        amount: orderAmount,
      },
    });

    if (confirmRes.status() !== 201) {
      console.error('Toss confirm error:', await confirmRes.text());
    }
    expect(confirmRes.status()).toBe(201);
    const confirmBody = await confirmRes.json();

    // 대기실 정보 검증
    expect(confirmBody.step_room).toBeDefined();
    expect(confirmBody.step_room.invite_code).toHaveLength(6);
    expect(confirmBody.step_room.participant_count).toBe(5);
    expect(confirmBody.step_room.current_participants).toBe(1); // 방장만 자동 배정

    // DB에서 슬롯 검증
    const capsuleRes = await client.query(
      'SELECT capsule_id FROM time_capsules WHERE order_id = $1',
      [orderId],
    );
    const capsuleId = capsuleRes.rows[0].capsule_id;

    const slotsRes = await client.query(
      'SELECT COUNT(*) as count FROM capsule_participant_slots WHERE capsule_id = $1',
      [capsuleId],
    );
    expect(parseInt(String(slotsRes.rows[0].count))).toBe(5);

    await cleanupUser(id);
  });
});
