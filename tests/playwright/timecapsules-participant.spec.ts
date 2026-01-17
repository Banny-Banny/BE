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

async function createUser(nickname: string = 'test-user') {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', 3)
    `,
    [id, nickname, phone],
  );
  const token = jwt.sign({ sub: id, nickname }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  // Foreign key 제약 조건 순서대로 삭제
  await client.query(
    `
    DELETE FROM capsule_participant_slots
    WHERE capsule_id IN (
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
    [id],
  );
  await client.query(
    `
    DELETE FROM capsule_access_logs
    WHERE capsule_id IN (
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
    [id],
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)
    )
    `,
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
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders)
    )
    `,
  );
  await client.query(
    `
    DELETE FROM capsule_access_logs
    WHERE capsule_id IN (
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders)
    )
    `,
  );
  await client.query(
    `
    DELETE FROM capsules
    WHERE id IN (
      SELECT capsule_id FROM time_capsules
      WHERE order_id IN (SELECT id FROM orders)
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

test.describe('/timecapsules/:id API (참여자 확인 방식)', () => {
  test('참여자는 토큰으로 타임캡슐을 조회할 수 있다', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('방장');
    const participant = await createUser('참여자');

    // 1. 주문 및 결제
    const orderId = await createOrder(owner.token, 3);
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const capsuleId = approveBody.step_room.room_id;
    const inviteCode = approveBody.step_room.invite_code;

    // 2. 참여자가 대기실 참여
    await api.post(`/api/capsules/step-rooms/${capsuleId}/join`, {
      headers: { Authorization: `Bearer ${participant.token}` },
      data: { invite_code: inviteCode },
    });

    // 3. 타임캡슐이 열린 상태로 변경 (open_at을 과거로 설정)
    await client.query(
      `UPDATE time_capsules SET open_at = NOW() - INTERVAL '1 day' WHERE capsule_id = $1`,
      [capsuleId],
    );

    // 4. 참여자가 토큰으로 조회
    const res = await api.get(`/api/timecapsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${participant.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    console.log('\n=== API 응답 ===');
    console.log(JSON.stringify(body, null, 2));
    console.log('\n=== 슬롯 정보 ===');
    body.slots.forEach((slot: any, idx: number) => {
      console.log(`슬롯 ${idx + 1}:`);
      console.log(`  - user_id: ${slot.user_id}`);
      console.log(`  - nickname: ${slot.nickname}`);
      console.log(`  - content: ${slot.text_message ? '있음' : '없음'}`);
      console.log(`  - images: ${slot.images_ids?.length || 0}개`);
    });

    // 5. 응답 검증
    expect(body.id).toBe(capsuleId);
    expect(body.is_locked).toBe(false); // 열린 상태
    expect(body.slots).toHaveLength(3);
    expect(body.headcount).toBe(3);

    await cleanupUser(owner.id);
    await cleanupUser(participant.id);
  });

  test('비참여자는 타임캡슐을 조회할 수 없다 (403)', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('방장');
    const stranger = await createUser('외부인');

    // 1. 주문 및 결제
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
    const capsuleId = approveBody.step_room.room_id;

    // 2. 비참여자가 조회 시도
    const res = await api.get(`/api/timecapsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${stranger.token}` },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('NOT_PARTICIPANT');

    await cleanupUser(owner.id);
    await cleanupUser(stranger.id);
  });

  test('타임캡슐이 잠긴 상태면 content와 미디어가 숨겨진다', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('방장');
    const participant = await createUser('참여자');

    // 1. 주문 및 결제
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
    const capsuleId = approveBody.step_room.room_id;
    const inviteCode = approveBody.step_room.invite_code;

    // 2. 참여자가 대기실 참여
    await api.post(`/api/capsules/step-rooms/${capsuleId}/join`, {
      headers: { Authorization: `Bearer ${participant.token}` },
      data: { invite_code: inviteCode },
    });

    // 3. 타임캡슐이 잠긴 상태 유지 (open_at이 미래)
    await client.query(
      `UPDATE time_capsules SET open_at = NOW() + INTERVAL '7 days' WHERE capsule_id = $1`,
      [capsuleId],
    );

    // 4. 참여자가 조회
    const res = await api.get(`/api/timecapsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${participant.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // 5. 잠금 상태 검증
    expect(body.is_locked).toBe(true);

    // 6. 모든 슬롯의 content와 미디어가 null/빈 배열이어야 함
    body.slots.forEach((slot: any) => {
      expect(slot.text_message).toBeNull();
      expect(slot.images_ids).toEqual([]);
      expect(slot.audio_id).toBeNull();
      expect(slot.video_id).toBeNull();
    });

    await cleanupUser(owner.id);
    await cleanupUser(participant.id);
  });

  test('타임캡슐이 열린 상태면 모든 참여자의 데이터를 볼 수 있다', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('방장');
    const user1 = await createUser('참여자1');
    const user2 = await createUser('참여자2');

    // 1. 주문 및 결제
    const orderId = await createOrder(owner.token, 3);
    await api.post('/api/payments/kakao/ready', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId },
    });
    const approveRes = await api.post('/api/payments/kakao/approve', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { order_id: orderId, pg_token: 'PGTOKEN-MOCK' },
    });
    const approveBody = await approveRes.json();
    const capsuleId = approveBody.step_room.room_id;
    const inviteCode = approveBody.step_room.invite_code;

    // 2. 참여자들이 대기실 참여
    await api.post(`/api/capsules/step-rooms/${capsuleId}/join`, {
      headers: { Authorization: `Bearer ${user1.token}` },
      data: { invite_code: inviteCode },
    });
    await api.post(`/api/capsules/step-rooms/${capsuleId}/join`, {
      headers: { Authorization: `Bearer ${user2.token}` },
      data: { invite_code: inviteCode },
    });

    // 3. 각 참여자가 콘텐츠 작성 (텍스트만)
    const content1 = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${owner.token}` },
        multipart: { text_message: '방장의 메시지' },
      },
    );
    expect(content1.ok()).toBeTruthy();

    const content2 = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${user1.token}` },
        multipart: { text_message: '참여자1의 메시지' },
      },
    );
    expect(content2.ok()).toBeTruthy();

    const content3 = await api.post(
      `/api/capsules/step-rooms/${capsuleId}/my-content`,
      {
        headers: { Authorization: `Bearer ${user2.token}` },
        multipart: { text_message: '참여자2의 메시지' },
      },
    );
    expect(content3.ok()).toBeTruthy();

    // 3-1. 미디어 파일 DB에 직접 삽입
    const ownerSlotResult = await client.query(
      'SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2',
      [capsuleId, owner.id],
    );
    const ownerSlotId = ownerSlotResult.rows[0].id;

    const user1SlotResult = await client.query(
      'SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2',
      [capsuleId, user1.id],
    );
    const user1SlotId = user1SlotResult.rows[0].id;

    const user2SlotResult = await client.query(
      'SELECT id FROM capsule_participant_slots WHERE capsule_id = $1 AND user_id = $2',
      [capsuleId, user2.id],
    );
    const user2SlotId = user2SlotResult.rows[0].id;

    // 방장: 이미지 2개 + 음악 1개
    const ownerImg1Id = crypto.randomUUID();
    const ownerImg2Id = crypto.randomUUID();
    const ownerMusicId = crypto.randomUUID();
    await client.query(
      `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at) VALUES
       ($1, $2, 'IMAGE', $3, 'image/jpeg', 1024, NOW()),
       ($4, $2, 'IMAGE', $5, 'image/jpeg', 1024, NOW()),
       ($6, $2, 'AUDIO', $7, 'audio/mpeg', 2048, NOW())`,
      [
        ownerImg1Id,
        owner.id,
        `test/owner_img1_${ownerImg1Id}.jpg`,
        ownerImg2Id,
        `test/owner_img2_${ownerImg2Id}.jpg`,
        ownerMusicId,
        `test/owner_music_${ownerMusicId}.mp3`,
      ],
    );
    await client.query(
      `UPDATE capsule_participant_slots SET image_ids = ARRAY[$1, $2]::uuid[], music_id = $3 WHERE id = $4`,
      [ownerImg1Id, ownerImg2Id, ownerMusicId, ownerSlotId],
    );

    // 참여자1: 이미지 1개 + 영상 1개
    const user1ImgId = crypto.randomUUID();
    const user1VideoId = crypto.randomUUID();
    await client.query(
      `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at) VALUES
       ($1, $2, 'IMAGE', $3, 'image/jpeg', 1024, NOW()),
       ($4, $2, 'VIDEO', $5, 'video/mp4', 4096, NOW())`,
      [
        user1ImgId,
        user1.id,
        `test/user1_img_${user1ImgId}.jpg`,
        user1VideoId,
        `test/user1_video_${user1VideoId}.mp4`,
      ],
    );
    await client.query(
      `UPDATE capsule_participant_slots SET image_ids = ARRAY[$1]::uuid[], video_id = $2 WHERE id = $3`,
      [user1ImgId, user1VideoId, user1SlotId],
    );

    // 참여자2: 이미지 3개 + 음악 1개 + 영상 1개
    const user2Img1Id = crypto.randomUUID();
    const user2Img2Id = crypto.randomUUID();
    const user2Img3Id = crypto.randomUUID();
    const user2MusicId = crypto.randomUUID();
    const user2VideoId = crypto.randomUUID();
    await client.query(
      `INSERT INTO media (id, user_id, type, object_key, content_type, size, created_at) VALUES
       ($1, $2, 'IMAGE', $3, 'image/jpeg', 1024, NOW()),
       ($4, $2, 'IMAGE', $5, 'image/jpeg', 1024, NOW()),
       ($6, $2, 'IMAGE', $7, 'image/jpeg', 1024, NOW()),
       ($8, $2, 'AUDIO', $9, 'audio/mpeg', 2048, NOW()),
       ($10, $2, 'VIDEO', $11, 'video/mp4', 4096, NOW())`,
      [
        user2Img1Id,
        user2.id,
        `test/user2_img1_${user2Img1Id}.jpg`,
        user2Img2Id,
        `test/user2_img2_${user2Img2Id}.jpg`,
        user2Img3Id,
        `test/user2_img3_${user2Img3Id}.jpg`,
        user2MusicId,
        `test/user2_music_${user2MusicId}.mp3`,
        user2VideoId,
        `test/user2_video_${user2VideoId}.mp4`,
      ],
    );
    await client.query(
      `UPDATE capsule_participant_slots SET image_ids = ARRAY[$1, $2, $3]::uuid[], music_id = $4, video_id = $5 WHERE id = $6`,
      [
        user2Img1Id,
        user2Img2Id,
        user2Img3Id,
        user2MusicId,
        user2VideoId,
        user2SlotId,
      ],
    );

    // 4. 타임캡슐이 열린 상태로 변경
    await client.query(
      `UPDATE time_capsules SET open_at = NOW() - INTERVAL '1 day' WHERE capsule_id = $1`,
      [capsuleId],
    );

    // 5. 참여자1이 조회
    const res = await api.get(`/api/timecapsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${user1.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    console.log('\n=== 모든 참여자 데이터 확인 ===');
    console.log(`총 슬롯 수: ${body.slots.length}`);

    // 6. 모든 슬롯 데이터 검증
    expect(body.is_locked).toBe(false);
    expect(body.slots).toHaveLength(3);

    // 각 슬롯에 user_id가 할당되어 있는지 확인
    const assignedSlots = body.slots.filter((s: any) => s.user_id !== null);
    expect(assignedSlots).toHaveLength(3);

    // 모든 슬롯이 작성 완료 상태인지 확인
    const completedSlots = body.slots.filter(
      (s: any) => s.status === 'COMPLETED',
    );
    expect(completedSlots).toHaveLength(3);

    // 슬롯별 상세 검증
    body.slots.forEach((slot: any, idx: number) => {
      console.log(`\n슬롯 ${idx + 1}:`);
      console.log(`  - user_id: ${slot.user_id}`);
      console.log(`  - nickname: ${slot.nickname}`);
      console.log(`  - content: ${slot.text_message ?? ''}`);
      console.log(`  - images: ${slot.images_ids?.length ?? 0}개`);
      console.log(`  - audio: ${slot.audio_id ? 'O' : 'X'}`);
      console.log(`  - video: ${slot.video_id ? 'O' : 'X'}`);

      expect(slot.user_id).not.toBeNull();
      expect(slot.nickname).toBeTruthy();
      expect(slot.status).toBe('COMPLETED');
    });

    // 미디어 파일 상세 검증
    const ownerSlot = body.slots.find(
      (slot: any) => slot.text_message === '방장의 메시지',
    );
    expect(ownerSlot).toBeDefined();
    expect(ownerSlot.images_ids).toHaveLength(2); // 방장: 이미지 2개
    expect(ownerSlot.audio_id).not.toBeNull(); // 방장: 음악 O
    expect(ownerSlot.audio_id.media_id).toBeTruthy();
    expect(ownerSlot.audio_id.object_key).toBeTruthy();

    const user1Slot = body.slots.find(
      (slot: any) => slot.text_message === '참여자1의 메시지',
    );
    expect(user1Slot).toBeDefined();
    expect(user1Slot.images_ids).toHaveLength(1); // 참여자1: 이미지 1개
    expect(user1Slot.video_id).not.toBeNull(); // 참여자1: 영상 O
    expect(user1Slot.video_id.media_id).toBeTruthy();
    expect(user1Slot.video_id.object_key).toBeTruthy();

    const user2Slot = body.slots.find(
      (slot: any) => slot.text_message === '참여자2의 메시지',
    );
    expect(user2Slot).toBeDefined();
    expect(user2Slot.images_ids).toHaveLength(3); // 참여자2: 이미지 3개
    expect(user2Slot.audio_id).not.toBeNull(); // 참여자2: 음악 O
    expect(user2Slot.video_id).not.toBeNull(); // 참여자2: 영상 O

    await cleanupUser(owner.id);
    await cleanupUser(user1.id);
    await cleanupUser(user2.id);
  });

  test('존재하지 않는 capsuleId는 404를 반환한다', async () => {
    const owner = await createUser('방장');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const res = await api.get(`/api/timecapsules/${fakeUuid}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.status()).toBe(404);
    await cleanupUser(owner.id);
  });

  test('토큰 없이 요청하면 401을 반환한다', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('방장');

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
    const capsuleId = approveBody.step_room.room_id;

    // 토큰 없이 조회
    const res = await api.get(`/api/timecapsules/${capsuleId}`);

    expect(res.status()).toBe(401);

    await cleanupUser(owner.id);
  });
});
