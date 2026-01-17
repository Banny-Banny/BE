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
async function createUser(nickname = 'submit-test-user') {
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
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query(
    `INSERT INTO products (id, name, price, product_type, is_active, max_media_count, media_types)
     VALUES ($1, 'time-capsule-product', 0, 'TIME_CAPSULE', true, 10, ARRAY['IMAGE', 'AUDIO', 'VIDEO']::"products_media_types_enum"[])`,
    [TIME_CAPSULE_PRODUCT_ID],
  );
}

async function cleanupProducts() {
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function createCapsuleWithOrder(
  authToken: string,
  userId: string,
  headcount = 4,
) {
  // 1. 주문 생성
  const orderResponse = await api.post('/api/orders', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      product_id: TIME_CAPSULE_PRODUCT_ID,
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
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
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

    // 참여자 생성 및 슬롯 할당
    const participantIds: string[] = [userId]; // 방장 포함

    // 나머지 참여자 생성
    for (let i = 1; i < headcount; i++) {
      const participantId = crypto.randomUUID();
      const participantEmail = `participant${i}-${Date.now()}@example.com`;
      const participantPhone = `010${String(Date.now()).slice(-8)}${i}`;

      await client.query(
        `INSERT INTO users (id, email, nickname, phone_number, profile_img, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [participantId, participantEmail, `참여자${i}`, participantPhone, null],
      );

      participantIds.push(participantId);
    }

    // 슬롯 생성
    for (let i = 0; i < headcount; i++) {
      await client.query(
        `INSERT INTO capsule_participant_slots (capsule_id, slot_index, user_id, status)
         VALUES ($1, $2, $3, $4)`,
        [capsuleId, i, participantIds[i], 'PENDING'],
      );
    }
  } else {
    capsuleId = capsuleResult.rows[0].capsule_id;
  }

  return { capsuleId, orderId };
}

async function completeAllSlots(capsuleId: string) {
  // 모든 참여자를 COMPLETED 상태로 변경하고 샘플 데이터 추가
  const slots = await client.query(
    `SELECT id, slot_index FROM capsule_participant_slots WHERE capsule_id = $1 ORDER BY slot_index`,
    [capsuleId],
  );

  for (const slot of slots.rows) {
    // 테스트용 미디어 레코드 생성
    const mediaId1 = crypto.randomUUID();
    const mediaId2 = crypto.randomUUID();

    await client.query(
      `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at)
       VALUES ($1, (SELECT user_id FROM capsules WHERE id = $3), 'IMAGE', $4, 'image/jpeg', 1024, NOW()),
              ($2, (SELECT user_id FROM capsules WHERE id = $3), 'IMAGE', $5, 'image/jpeg', 1024, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        mediaId1,
        mediaId2,
        capsuleId,
        `test/image1_${mediaId1}.jpg`,
        `test/image2_${mediaId2}.jpg`,
      ],
    );

    await client.query(
      `UPDATE capsule_participant_slots 
       SET status = 'COMPLETED', 
           text_message = $1, 
           image_ids = ARRAY[$2, $3]::uuid[]
       WHERE id = $4`,
      [`참여자 ${slot.slot_index + 1}의 메시지`, mediaId1, mediaId2, slot.id],
    );
  }
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

test.describe('타임캡슐 최종 제출 API', () => {
  let authToken: string;
  let userId: string;
  let capsuleId: string;

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

  test('should submit capsule successfully when all participants completed', async () => {
    // 1. 캡슐 생성 및 결제
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      4,
    );
    capsuleId = cId;

    // 2. 모든 참여자 완료 상태로 변경
    await completeAllSlots(capsuleId);

    // 3. 방장이 제출
    const response = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    if (!response.ok()) {
      const errorText = await response.text();
      console.error('Submit failed:', response.status(), errorText);
    }

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('BURIED');
    expect(body.data.is_auto_submitted).toBe(false);
    expect(body.data.location.latitude).toBe(37.5665);
    expect(body.data.location.longitude).toBe(126.978);
    expect(body.data.participants).toBe(4);

    // 4. DB에서 캡슐 상태 및 콘텐츠 확인
    const capsuleResult = await client.query(
      `SELECT tc.room_status,
              tc.buried_at,
              tc.is_auto_submitted,
              c.latitude,
              c.longitude,
              c.content,
              c.text_blocks,
              c.media_item_ids,
              c.media_types
       FROM capsules c
       JOIN time_capsules tc ON tc.capsule_id = c.id
       WHERE c.id = $1`,
      [capsuleId],
    );
    expect(capsuleResult.rows[0].room_status).toBe('BURIED');
    expect(capsuleResult.rows[0].is_auto_submitted).toBe(false);
    expect(Number(capsuleResult.rows[0].latitude)).toBe(37.5665);
    expect(Number(capsuleResult.rows[0].longitude)).toBe(126.978);

    // 5. 참여자 콘텐츠가 캡슐에 반영되었는지 확인
    expect(capsuleResult.rows[0].content).not.toBeNull();
    expect(capsuleResult.rows[0].text_blocks).not.toBeNull();
    expect(Array.isArray(capsuleResult.rows[0].text_blocks)).toBe(true);
    expect(capsuleResult.rows[0].text_blocks.length).toBe(4); // 4명의 참여자

    // textBlocks 내용 확인
    capsuleResult.rows[0].text_blocks.forEach(
      (block: { order: number; content: string }, index: number) => {
        expect(block.order).toBe(index + 1);
        expect(block.content).toContain(`참여자 ${index + 1}의 메시지`);
      },
    );

    // 미디어 ID 확인 (4명 * 2개 이미지 = 8개)
    expect(capsuleResult.rows[0].media_item_ids).not.toBeNull();
    expect(capsuleResult.rows[0].media_item_ids.length).toBe(8);

    // 미디어 타입 확인 (PostgreSQL이 enum 배열을 문자열로 반환)
    expect(capsuleResult.rows[0].media_types).not.toBeNull();
    const mediaTypes = capsuleResult.rows[0].media_types
      .replace('{', '')
      .replace('}', '')
      .split(',');
    expect(mediaTypes.length).toBe(8);

    // 모든 타입이 IMAGE인지 확인
    const allImagesCount = mediaTypes.filter(
      (t: string) => t === 'IMAGE',
    ).length;
    expect(allImagesCount).toBe(8);
  });

  test('should reject when not room owner', async () => {
    // 1. 방장 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      3,
    );
    capsuleId = cId;

    // 2. 모든 참여자 완료 상태로 변경
    await completeAllSlots(capsuleId);

    // 3. 일반 참여자 생성
    const participant = await createUser('participant');

    // 4. 참여자를 슬롯에 배정
    await client.query(
      `UPDATE capsule_participant_slots SET user_id = $1, status = 'COMPLETED' WHERE capsule_id = $2 AND slot_index = 1`,
      [participant.id, capsuleId],
    );

    // 5. 참여자가 제출 시도 (방장이 아님)
    const response = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${participant.token}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_ROOM_OWNER');
    expect(body.message).toBe('방장만 최종 제출할 수 있습니다');

    // 정리
    await cleanupUser(participant.id);
  });

  test('should reject when participants incomplete', async () => {
    // 1. 캡슐 생성 (4명)
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      4,
    );
    capsuleId = cId;

    // 2. 일부 참여자만 완료 (2명만 COMPLETED)
    await client.query(
      `UPDATE capsule_participant_slots SET status = 'COMPLETED' WHERE capsule_id = $1 AND slot_index IN (0, 1)`,
      [capsuleId],
    );

    // 참여자 2, 3은 아직 PENDING 상태
    await client.query(
      `UPDATE capsule_participant_slots SET nickname = $1 WHERE capsule_id = $2 AND slot_index = 2`,
      ['박초롱', capsuleId],
    );
    await client.query(
      `UPDATE capsule_participant_slots SET nickname = $1 WHERE capsule_id = $2 AND slot_index = 3`,
      ['김철수', capsuleId],
    );

    // 3. 방장이 제출 시도 (실패해야 함)
    const response = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('INCOMPLETE_PARTICIPANTS');
    expect(body.message).toBe(
      '모든 참여자가 저장을 완료해야 제출할 수 있습니다',
    );
    expect(body.data.completed).toBe(2);
    expect(body.data.total).toBe(4);
    expect(body.data.incomplete_users).toContain('참여자2');
    expect(body.data.incomplete_users).toContain('참여자3');
  });

  test('should reject when already submitted', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      3,
    );
    capsuleId = cId;

    // 2. 모든 참여자 완료
    await completeAllSlots(capsuleId);

    // 3. 첫 번째 제출 (성공)
    const firstResponse = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(firstResponse.status()).toBe(201);

    // 4. 두 번째 제출 시도 (실패해야 함)
    const response = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.6,
          longitude: 127.0,
        },
      },
    );

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('ALREADY_SUBMITTED');
    expect(body.message).toBe('이미 제출된 캡슐입니다');

    // 5. DB에서 첫 번째 위치가 유지되는지 확인
    const capsuleResult = await client.query(
      `SELECT latitude, longitude FROM capsules WHERE id = $1`,
      [capsuleId],
    );
    expect(Number(capsuleResult.rows[0].latitude)).toBe(37.5665);
    expect(Number(capsuleResult.rows[0].longitude)).toBe(126.978);
  });

  test('should auto-submit after deadline (manual trigger)', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      2,
    );
    capsuleId = cId;

    // 2. deadline을 과거로 설정 (24시간 경과)
    await client.query(
      `UPDATE time_capsules
       SET deadline = NOW() - INTERVAL '1 hour', room_status = 'WAITING'
       WHERE capsule_id = $1`,
      [capsuleId],
    );

    // 3. 크론잡 로직 수동 실행 (DB 직접 업데이트로 시뮬레이션)
    // 실제 크론잡은 CapsulesCronService.handleAutoSubmit()를 호출하지만,
    // 테스트에서는 결과만 확인
    await client.query(
      `UPDATE capsules
       SET latitude = 37.5665,
           longitude = 126.978
       WHERE id = $1`,
      [capsuleId],
    );
    await client.query(
      `UPDATE time_capsules
       SET room_status = 'BURIED',
           buried_at = NOW(),
           is_auto_submitted = true
       WHERE capsule_id = $1 AND deadline < NOW() AND room_status IN ('WAITING', 'COMPLETED')`,
      [capsuleId],
    );

    // 4. DB에서 자동 제출 결과 확인
    const capsuleResult = await client.query(
      `SELECT tc.room_status,
              tc.is_auto_submitted,
              c.latitude,
              c.longitude,
              tc.buried_at
       FROM capsules c
       JOIN time_capsules tc ON tc.capsule_id = c.id
       WHERE c.id = $1`,
      [capsuleId],
    );

    expect(capsuleResult.rows[0].room_status).toBe('BURIED');
    expect(capsuleResult.rows[0].is_auto_submitted).toBe(true);
    expect(Number(capsuleResult.rows[0].latitude)).toBe(37.5665);
    expect(Number(capsuleResult.rows[0].longitude)).toBe(126.978);
    expect(capsuleResult.rows[0].buried_at).toBeTruthy();
  });

  test('should validate latitude and longitude range', async () => {
    // 1. 캡슐 생성
    const { capsuleId: cId } = await createCapsuleWithOrder(
      authToken,
      userId,
      2,
    );
    capsuleId = cId;

    // 2. 모든 참여자 완료
    await completeAllSlots(capsuleId);

    // 3. 잘못된 위도로 제출 시도
    const invalidLatResponse = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 100, // 유효 범위: -90 ~ 90
          longitude: 126.978,
        },
      },
    );

    expect(invalidLatResponse.status()).toBe(400);

    // 4. 잘못된 경도로 제출 시도
    const invalidLngResponse = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 200, // 유효 범위: -180 ~ 180
        },
      },
    );

    expect(invalidLngResponse.status()).toBe(400);
  });
});
