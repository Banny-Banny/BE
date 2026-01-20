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
  user: process.env.TEST_DB_USERNAME ?? process.env.DB_USERNAME ?? 'postgres',
  password:
    process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? 'postgres',
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
const TIME_CAPSULE_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440100';

let api: APIRequestContext;
let client: Client;

// Helper Functions
async function createUser(nickname = 'content-test-user') {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  await client.query(
    `INSERT INTO users (id, nickname, phone_number, provider, egg_slots, is_active)
     VALUES ($1, $2, $3, 'LOCAL', 3, true)`,
    [id, nickname, phone],
  );
  const token = jwt.sign({ sub: id, nickname }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(userId: string) {
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
    [userId],
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT tc.capsule_id
      FROM time_capsules tc
      WHERE tc.order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
    [userId],
  );
  await client.query(
    'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)',
    [userId],
  );
  await client.query('DELETE FROM orders WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function createProductTimeCapsule() {
  await client.query(
    `INSERT INTO products (
      id, name, price, product_type, is_active, max_media_count, media_types
    ) VALUES (
      $1, 'time-capsule-product', 0, 'TIME_CAPSULE', true, 10,
      ARRAY['IMAGE', 'AUDIO', 'VIDEO']::"products_media_types_enum"[]
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        price = EXCLUDED.price,
        product_type = EXCLUDED.product_type,
        is_active = EXCLUDED.is_active,
        max_media_count = EXCLUDED.max_media_count,
        media_types = EXCLUDED.media_types,
        deleted_at = NULL`,
    [TIME_CAPSULE_PRODUCT_ID],
  );
}

async function cleanupProducts() {
  await client.query(
    `
    DELETE FROM products
    WHERE id = $1
      AND NOT EXISTS (
        SELECT 1 FROM orders WHERE product_id = $1
      )
    `,
    [TIME_CAPSULE_PRODUCT_ID],
  );
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
  await cleanupProducts();
  await client.end();
  await api.dispose();
});

test.describe('Step Room Content Save API', () => {
  let authToken: string;
  let userId: string;
  let capsuleId: string;
  let orderId: string;

  test.beforeEach(async () => {
    // 각 테스트마다 새로운 상품과 사용자 생성
    await createProductTimeCapsule();
    const user = await createUser();
    userId = user.id;
    authToken = user.token;
  });

  test.afterEach(async () => {
    // 각 테스트 후 정리
    if (userId) {
      await cleanupUser(userId);
    }
  });

  test('should save content successfully with text only', async () => {
    // 1. 주문 생성
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 3,
        time_option: '1_WEEK',
        photo_count: 5,
        add_music: true,
        add_video: true,
      },
    });

    if (!orderResponse.ok()) {
      console.error('Order creation failed:', await orderResponse.text());
    }
    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    orderId = orderData.order_id;

    // 2. 결제 처리 (DB 직접 업데이트)
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, orderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      orderId,
    ]);

    // 캡슐 생성 (결제 완료 후 자동 생성되어야 함 - 수동으로 확인)
    const capsuleResult = await client.query(
      `SELECT capsule_id FROM time_capsules WHERE order_id = $1`,
      [orderId],
    );

    if (capsuleResult.rows.length === 0) {
      // 캡슐이 없으면 수동으로 생성
      capsuleId = crypto.randomUUID();
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      await client.query(
        `INSERT INTO capsules (id, user_id, capsule_type, title)
         VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
        [capsuleId, userId],
      );
      await client.query(
        `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
        [capsuleId, orderId, inviteCode],
      );

      // 슬롯 생성
      for (let i = 0; i < 3; i++) {
        await client.query(
          `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
           VALUES ($1, $2, $3, $4)`,
          [capsuleId, i, i === 0 ? userId : null, 'PENDING'],
        );
      }
    } else {
      capsuleId = capsuleResult.rows[0].capsule_id;
    }

    // 3. 텍스트만 저장
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '안녕하세요! 테스트 메시지입니다.',
        },
      },
    );

    if (!saveResponse.ok()) {
      console.error(
        'Content save failed:',
        saveResponse.status(),
        await saveResponse.text(),
      );
    }
    expect(saveResponse.ok()).toBeTruthy();
    const result = await saveResponse.json();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.user_id).toBe(userId);
    expect(result.data.uploaded_images).toBe(0);
    expect(result.data.uploaded_music).toBe(false);
    expect(result.data.uploaded_video).toBe(false);
  });

  test('should reject when payment is not completed', async () => {
    // 주문 생성 (결제 미완료)
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 3,
        add_music: false,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const unpaidOrderId = orderData.order_id;

    // 캡슐 수동 생성 (PENDING_PAYMENT 상태)
    const unpaidCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '미결제 캡슐')`,
      [unpaidCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [unpaidCapsuleId, unpaidOrderId, inviteCode],
    );

    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${unpaidCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '테스트',
        },
      },
    );

    expect(saveResponse.status()).toBeGreaterThanOrEqual(400); // 결제 미완료로 접근 거부
  });

  test('should reject music upload when not allowed', async () => {
    // 1. 주문 생성 (음악 업로드 불허)
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 3,
        add_music: false, // 음악 업로드 불허
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 음악 파일을 포함하여 저장 시도 (Buffer 생성하여 업로드)
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '음악 업로드 시도',
          music: {
            name: 'test-music.mp3',
            mimeType: 'audio/mpeg',
            buffer: Buffer.from('fake-audio-data'),
          },
        },
      },
    );

    // 음악 업로드가 허용되지 않으므로 400 또는 403 에러 예상
    expect(saveResponse.status()).toBeGreaterThanOrEqual(400);
    if (saveResponse.status() < 500) {
      const result = await saveResponse.json();
      if ('success' in result) {
        expect(result.success).toBe(false);
      } else {
        expect(result.statusCode ?? result.error).toBeDefined();
      }
    }
  });

  test('should reject invalid image mime type', async () => {
    // 1. 주문 생성 (이미지 허용)
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 3,
        add_music: false,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 허용되지 않는 이미지 타입 업로드 시도 (image/gif)
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '이미지 타입 테스트',
          images: {
            name: 'invalid-image.gif',
            mimeType: 'image/gif',
            buffer: Buffer.from('fake-image-data'),
          },
        },
      },
    );

    expect(saveResponse.status()).toBe(400);
    const result = await saveResponse.json();
    expect(result.message).toBe('INVALID_IMAGE_TYPE');
  });

  test('should reject invalid audio mime type', async () => {
    // 1. 주문 생성 (음성 허용)
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 0,
        add_music: true,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 허용되지 않는 오디오 타입 업로드 시도 (audio/ogg)
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '오디오 타입 테스트',
          music: {
            name: 'invalid-audio.ogg',
            mimeType: 'audio/ogg',
            buffer: Buffer.from('fake-audio-data'),
          },
        },
      },
    );

    expect(saveResponse.status()).toBe(400);
    const result = await saveResponse.json();
    expect(result.message).toBe('INVALID_AUDIO_TYPE');
  });

  test('should reject invalid video mime type', async () => {
    // 1. 주문 생성 (비디오 허용)
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 0,
        add_music: false,
        add_video: true,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 허용되지 않는 비디오 타입 업로드 시도 (video/avi)
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '비디오 타입 테스트',
          video: {
            name: 'invalid-video.avi',
            mimeType: 'video/avi',
            buffer: Buffer.from('fake-video-data'),
          },
        },
      },
    );

    expect(saveResponse.status()).toBe(400);
    const result = await saveResponse.json();
    expect(result.message).toBe('INVALID_VIDEO_TYPE');
  });

  test('should update content successfully (re-save)', async () => {
    // 1. 주문 및 캡슐 생성
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 3,
        add_music: true,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 첫 번째 저장
    const firstSaveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '첫 번째 메시지입니다.',
        },
      },
    );

    expect(firstSaveResponse.ok()).toBeTruthy();

    // 5. 두 번째 저장 (업데이트)
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '수정된 메시지입니다.',
        },
      },
    );

    if (!saveResponse.ok()) {
      console.error(
        'Content update failed:',
        saveResponse.status(),
        await saveResponse.text(),
      );
    }
    expect(saveResponse.ok()).toBeTruthy();
    const result = await saveResponse.json();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('COMPLETED');
  });

  test('should patch content and keep existing images', async () => {
    // 1. 주문 및 캡슐 생성
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 5,
        add_music: false,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    const existingImages = [crypto.randomUUID(), crypto.randomUUID()];
    await client.query(
      `
      UPDATE capsule_participant_slots
      SET text_message = $1, status = 'COMPLETED', image_ids = $2
      WHERE capsule_id = $3 AND user_id = $4
      `,
      ['기존 메시지', existingImages, testCapsuleId, userId],
    );

    // 4. PATCH로 텍스트만 수정
    const patchResponse = await api.patch(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '부분 수정된 메시지입니다.',
        },
      },
    );

    if (!patchResponse.ok()) {
      console.error(
        'Content patch failed:',
        patchResponse.status(),
        await patchResponse.text(),
      );
    }
    expect(patchResponse.ok()).toBeTruthy();
    const result = await patchResponse.json();
    expect(result.success).toBe(true);
    expect(result.data.uploaded_images).toBe(existingImages.length);
    expect(result.data.uploaded_music).toBe(false);
    expect(result.data.uploaded_video).toBe(false);

    const slotCheck = await client.query(
      `
      SELECT image_ids
      FROM capsule_participant_slots
      WHERE capsule_id = $1 AND user_id = $2
      `,
      [testCapsuleId, userId],
    );
    expect(slotCheck.rows[0].image_ids).toEqual(existingImages);
  });

  test('should return 404 when patching without existing content', async () => {
    // 1. 주문 및 캡슐 생성
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 3,
        add_music: false,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성 (PENDING + text_message 없음)
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    const patchResponse = await api.patch(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        multipart: {
          text_message: '수정 시도',
        },
      },
    );

    expect(patchResponse.status()).toBe(404);
    const result = await patchResponse.json();
    expect(result.success).toBe(false);
    expect(result.error).toBe('CONTENT_NOT_FOUND');
  });

  test('should reject unauthorized access', async () => {
    // 1. 주문 및 캡슐 생성
    const orderResponse = await api.post('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        product_id: TIME_CAPSULE_PRODUCT_ID,
        headcount: 2,
        time_option: '1_WEEK',
        photo_count: 2,
        add_music: false,
        add_video: false,
      },
    });

    expect(orderResponse.ok()).toBeTruthy();
    const orderData = await orderResponse.json();
    const testOrderId = orderData.order_id;

    // 2. 결제 완료 처리
    const paymentId = crypto.randomUUID();
    const paymentKey = `test-payment-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (id, order_id, payment_key, amount, status, currency, pg_tid, approved_at)
       VALUES ($1, $2, $3, 0, 'PAID', 'KRW', $3, NOW())`,
      [paymentId, testOrderId, paymentKey],
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
      testOrderId,
    ]);

    // 3. 캡슐 생성
    const testCapsuleId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐')`,
      [testCapsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, invite_code, deadline, room_status)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', true, $3, NOW() + INTERVAL '24 hours', 'WAITING')`,
      [testCapsuleId, testOrderId, inviteCode],
    );

    // 슬롯 생성
    for (let i = 0; i < 2; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [testCapsuleId, i, i === 0 ? userId : null, 'PENDING'],
      );
    }

    // 4. 다른 사용자 생성
    const otherUser = await createUser('other-user');

    // 5. 다른 사용자로 접근 시도
    const saveResponse = await api.post(
      `/api/capsules/step-rooms/${testCapsuleId}/my-content`,
      {
        headers: {
          Authorization: `Bearer ${otherUser.token}`,
        },
        multipart: {
          text_message: '권한 없는 접근',
        },
      },
    );

    expect(saveResponse.status()).toBe(403);
    const result = await saveResponse.json();
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED_ACCESS');

    // 정리
    await cleanupUser(otherUser.id);
  });
});
