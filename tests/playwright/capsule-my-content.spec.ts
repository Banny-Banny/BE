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
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

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

async function createProductTimeCapsule(productId: string) {
  await client.query(
    `INSERT INTO products (id, name, price, product_type, is_active, max_media_count, media_types)
     VALUES ($1, 'time-capsule-product', 0, 'TIME_CAPSULE', true, 10, ARRAY['IMAGE', 'AUDIO', 'VIDEO']::"products_media_types_enum"[])
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         price = EXCLUDED.price,
         product_type = EXCLUDED.product_type,
         is_active = EXCLUDED.is_active,
         max_media_count = EXCLUDED.max_media_count,
         media_types = EXCLUDED.media_types,
         deleted_at = NULL`,
    [productId],
  );
}

async function cleanupProducts() {
  // 외래 키 제약 때문에 products는 삭제하지 않음
  // 대신 테스트 데이터만 정리
}

async function createCapsuleWithOrder(
  authToken: string,
  userId: string,
  productId: string,
  headcount = 4,
) {
  // 1. 주문 생성
  const orderResponse = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      product_id: productId,
      headcount,
      time_option: '1_WEEK',
      photo_count: 5,
      add_music: true,
      add_video: true,
    },
  });

  expect(orderResponse.ok()).toBeTruthy();
  const orderData = await orderResponse.json();
  const orderId = orderData.order_id;

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

  // 3. 캡슐 수동 생성 (결제 후 자동 생성되지 않으면)
  const capsuleResult = await client.query(
    `SELECT capsule_id FROM time_capsules WHERE order_id = $1`,
    [orderId],
  );

  let capsuleId: string;
  if (capsuleResult.rows.length === 0) {
    capsuleId = crypto.randomUUID();
    const openAt = new Date();
    openAt.setDate(openAt.getDate() + 7);

    await client.query(
      `INSERT INTO capsules (id, user_id, capsule_type, title, created_at)
       VALUES ($1, $2, 'TIME_CAPSULE', '테스트 캡슐', NOW())`,
      [capsuleId, userId],
    );
    await client.query(
      `INSERT INTO time_capsules (capsule_id, order_id, open_at, is_locked, room_status)
       VALUES ($1, $2, $3, true, 'WAITING')`,
      [capsuleId, orderId, openAt],
    );

    // 슬롯 생성
    for (let i = 0; i < headcount; i++) {
      const slotId = crypto.randomUUID();
      await client.query(
        `INSERT INTO capsule_participant_slots (id, capsule_id, slot_index, status, created_at)
         VALUES ($1, $2, $3, 'PENDING', NOW())`,
        [slotId, capsuleId, i],
      );
    }

    // 첫 번째 슬롯에 방장 배정
    await client.query(
      `UPDATE capsule_participant_slots 
       SET user_id = $1, assigned_at = NOW(), nickname = 'Test User'
       WHERE capsule_id = $2 AND slot_index = 0`,
      [userId, capsuleId],
    );
  } else {
    capsuleId = capsuleResult.rows[0].capsule_id;
  }

  return { capsuleId, orderId };
}

async function saveContentToSlot(
  capsuleId: string,
  userId: string,
  textMessage: string,
) {
  // 슬롯에 직접 데이터 삽입
  const slotResult = await client.query(
    `SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2`,
    [capsuleId, userId],
  );

  let slotId;
  if (slotResult.rows.length === 0) {
    // 슬롯이 없으면 생성
    const newSlotResult = await client.query(
      `INSERT INTO capsule_participant_slots (id, capsule_id, slot_index, user_id, assigned_at, nickname, status)
       VALUES ($1, $2, 0, $3, NOW(), 'Test User', 'PENDING')
       RETURNING id`,
      [crypto.randomUUID(), capsuleId, userId],
    );
    slotId = newSlotResult.rows[0].id;
  } else {
    slotId = slotResult.rows[0].id;
  }

  // 미디어 생성
  const imageId1 = crypto.randomUUID();
  const imageId2 = crypto.randomUUID();
  const musicId = crypto.randomUUID();
  const videoId = crypto.randomUUID();

  await client.query(
    `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at)
     VALUES 
       ($1, $2, 'IMAGE', $3, 'image/jpeg', 1024, NOW()),
       ($4, $2, 'IMAGE', $5, 'image/jpeg', 1024, NOW()),
       ($6, $2, 'AUDIO', $7, 'audio/mpeg', 2048, NOW()),
       ($8, $2, 'VIDEO', $9, 'video/mp4', 4096, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      imageId1,
      userId,
      `test/image1_${imageId1}.jpg`,
      imageId2,
      `test/image2_${imageId2}.jpg`,
      musicId,
      `test/music_${musicId}.mp3`,
      videoId,
      `test/video_${videoId}.mp4`,
    ],
  );

  // 슬롯 업데이트
  await client.query(
    `UPDATE capsule_participant_slots 
     SET status = 'COMPLETED', 
         text_message = $1, 
         image_ids = ARRAY[$2, $3]::uuid[],
         music_id = $4,
         video_id = $5,
         updated_at = NOW()
     WHERE id = $6`,
    [textMessage, imageId1, imageId2, musicId, videoId, slotId],
  );

  return { slotId, imageId1, imageId2, musicId, videoId };
}

async function ensureParticipantSlot(capsuleId: string, userId: string) {
  const slotResult = await client.query(
    `SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2`,
    [capsuleId, userId],
  );
  if (slotResult.rows.length > 0) {
    return slotResult.rows[0].id as string;
  }

  const slotId = crypto.randomUUID();
  await client.query(
    `INSERT INTO capsule_participant_slots (id, capsule_id, slot_index, user_id, assigned_at, nickname, status)
     VALUES ($1, $2, 0, $3, NOW(), 'Test User', 'PENDING')`,
    [slotId, capsuleId, userId],
  );
  return slotId;
}

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
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

test.describe('본인 콘텐츠 조회 API', () => {
  let authToken: string;
  let userId: string;
  let capsuleId: string;
  let productId: string;

  test.beforeEach(async () => {
    productId = crypto.randomUUID();
    await createProductTimeCapsule(productId);
    const user = await createUser();
    userId = user.id;
    authToken = user.token;
  });

  test.afterEach(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 200: 작성한 콘텐츠 조회 성공', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      productId,
      4,
    );
    capsuleId = cId;

    // 2. 콘텐츠 저장
    const textMessage = '테스트 메시지입니다!';
    await saveContentToSlot(capsuleId, userId, textMessage);

    // 3. 콘텐츠 조회
    let response = await api.get(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    if (response.status() === 403) {
      await saveContentToSlot(capsuleId, userId, textMessage);
      response = await api.get(
        `/api/capsules/step-rooms/${capsuleId}/my-content`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
    }

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.user_id).toBe(userId);
    expect(body.data.text_message).toBe(textMessage);
    expect(body.data.status).toBe('COMPLETED');
    expect(body.data.images).toBeDefined();
    expect(body.data.images.length).toBe(2);
    expect(body.data.music).toBeDefined();
    expect(body.data.music.media_id).toBeDefined();
    expect(body.data.video).toBeDefined();
    expect(body.data.video.media_id).toBeDefined();
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 404: 콘텐츠를 작성하지 않음', async () => {
    // 1. 캡슐 생성 (슬롯은 이미 생성됨, 방장으로 배정됨)
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      productId,
      4,
    );
    capsuleId = cId;
    await ensureParticipantSlot(capsuleId, userId);

    // 2. 콘텐츠 조회 시도 (슬롯은 있지만 콘텐츠는 없음)
    let response = await api.get(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    if (response.status() === 403) {
      await ensureParticipantSlot(capsuleId, userId);
      response = await api.get(
        `/api/capsules/step-rooms/${capsuleId}/my-content`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
    }

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('CONTENT_NOT_FOUND');
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 403: 참여자가 아님', async () => {
    // 1. 다른 사용자의 캡슐 생성
    const otherUser = await createUser('other-user');
    const { capsuleId: cId } = await createCapsuleWithOrder(
      otherUser.token,
      otherUser.id,
      productId,
      4,
    );
    capsuleId = cId;

    // 2. 본인 토큰으로 조회 시도
    const response = await api.get(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_PARTICIPANT');

    await cleanupUser(otherUser.id);
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 401: 인증 토큰 없음', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      productId,
      4,
    );
    capsuleId = cId;

    // 2. 토큰 없이 조회 시도
    const response = await api.get(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
    );

    expect(response.status()).toBe(401);
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 404: 캡슐이 존재하지 않음', async () => {
    const fakeId = crypto.randomUUID();

    const response = await api.get(
      `/api/capsules/step-rooms/${fakeId}/my-content`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(404);
  });

  test('GET /api/capsules/step-rooms/:capsuleId/my-content 200: 이미지만 있는 경우', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      productId,
      4,
    );
    capsuleId = cId;

    // 2. 기존 슬롯 조회
    const slotResult = await client.query(
      `SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2`,
      [capsuleId, userId],
    );
    const slotId = slotResult.rows[0].id;

    // 3. 이미지만 추가
    const imageId = crypto.randomUUID();
    await client.query(
      `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at)
       VALUES ($1, $2, 'IMAGE', $3, 'image/jpeg', 1024, NOW())`,
      [imageId, userId, `test/image_${imageId}.jpg`],
    );

    await client.query(
      `UPDATE capsule_participant_slots 
       SET status = 'COMPLETED', 
           text_message = 'Only images', 
           image_ids = ARRAY[$1]::uuid[],
           updated_at = NOW()
       WHERE id = $2`,
      [imageId, slotId],
    );

    // 4. 콘텐츠 조회
    const response = await api.get(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.images.length).toBe(1);
    expect(body.data.music).toBeNull();
    expect(body.data.video).toBeNull();
  });
});
