/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// 플레이wright E2E는 테스트 전용 환경변수를 우선 로드한다.
dotenv.config({ path: '.env' });
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

const TIME_CAPSULE_PRODUCT_ID = '00000000-0000-0000-0000-00000000c002';

let api: APIRequestContext;
let client: Client;

async function createUser(nickname = 'test-user') {
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
  await client.query('DELETE FROM capsule_entries WHERE user_id = $1', [id]);
  await client.query(
    'DELETE FROM capsule_participant_slots WHERE user_id = $1',
    [id],
  );
  await client.query('DELETE FROM capsule_access_logs WHERE viewer_id = $1', [
    id,
  ]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createProductTimeCapsule() {
  await client.query('DELETE FROM capsule_entries');
  await client.query('DELETE FROM capsule_participant_slots');
  await client.query('DELETE FROM capsule_access_logs');
  await client.query('DELETE FROM capsules WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
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

async function cleanupProductsAndCapsules() {
  await client.query('DELETE FROM capsule_entries');
  await client.query('DELETE FROM capsule_participant_slots');
  await client.query('DELETE FROM capsule_access_logs');
  await client.query('DELETE FROM capsules WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM orders WHERE product_id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
  await client.query('DELETE FROM products WHERE id = $1', [
    TIME_CAPSULE_PRODUCT_ID,
  ]);
}

async function createPaidOrderWithCapsule(
  userId: string,
  headcount: number,
  status: 'PAID' | 'PENDING_PAYMENT',
  openAtInterval: string, // '1 day' | '-1 day' (미래/과거)
) {
  const orderId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO orders (id, user_id, product_id, total_amount, time_option, custom_open_at, headcount,
                        photo_count, add_music, add_video, status)
    VALUES ($1, $2, $3, 0, '1_WEEK', NULL, $4, 3, true, false, $5)
    `,
    [orderId, userId, TIME_CAPSULE_PRODUCT_ID, headcount, status],
  );

  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, product_id, order_id, title, content, media_urls, media_types,
                          open_at, is_locked, view_limit, view_count, latitude, longitude)
    VALUES ($1, $2, $3, $4, 'My Time Capsule', 'Time capsule description', NULL, NULL,
            NOW() + interval '${openAtInterval}', true, $5, 0, NULL, NULL)
    `,
    [capsuleId, userId, TIME_CAPSULE_PRODUCT_ID, orderId, headcount],
  );

  return { orderId, capsuleId };
}

async function insertMedia(ownerId: string, type: string = 'IMAGE') {
  const objectKey = `media/${crypto.randomUUID()}.jpg`;
  const { rows } = await client.query(
    `
    INSERT INTO media (user_id, object_key, type, content_type, size)
    VALUES ($1, $2, $3, 'image/jpeg', 1024)
    RETURNING id
    `,
    [ownerId, objectKey, type],
  );
  return rows[0].id as string;
}

async function createSlot(
  capsuleId: string,
  slotIndex: number,
  userId?: string,
) {
  const slotId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsule_participant_slots (id, capsule_id, slot_index, user_id, assigned_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [slotId, capsuleId, slotIndex, userId ?? null, userId ? new Date() : null],
  );
  return slotId;
}

async function createEntry(
  capsuleId: string,
  slotId: string,
  userId: string,
  content: string,
  mediaIds?: string[],
) {
  const entryId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsule_entries (id, capsule_id, slot_id, user_id, content, media_item_ids)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      entryId,
      capsuleId,
      slotId,
      userId,
      content,
      mediaIds ? `{${mediaIds.join(',')}}` : null,
    ],
  );
  return entryId;
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
  await cleanupProductsAndCapsules();
  await client.end();
  await api.dispose();
});

test.describe('타임캡슐 조회 - 잠금 상태', () => {
  test('🔒 잠긴 캡슐: content와 미디어가 숨겨짐', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('owner');
    const participant = await createUser('participant');

    // 미래로 개봉되는 캡슐 생성 (잠김)
    const { capsuleId } = await createPaidOrderWithCapsule(
      owner.id,
      3,
      'PAID',
      '1 day', // 내일 개봉 (잠김)
    );

    // 슬롯 및 작성 데이터 생성
    const slot1 = await createSlot(capsuleId, 0, owner.id);
    const slot2 = await createSlot(capsuleId, 1, participant.id);
    await createSlot(capsuleId, 2); // 빈 슬롯

    const mediaId1 = await insertMedia(owner.id, 'IMAGE');
    const mediaId2 = await insertMedia(participant.id, 'AUDIO');

    await createEntry(capsuleId, slot1, owner.id, '오너의 메시지', [mediaId1]);
    await createEntry(capsuleId, slot2, participant.id, '참여자의 메시지', [
      mediaId2,
    ]);

    // API 호출
    const res = await api.get(`/api/time-capsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // 기본 정보 확인
    expect(body.id).toBe(capsuleId);
    expect(body.title).toBe('My Time Capsule');
    expect(body.description).toBe('Time capsule description');
    expect(body.is_locked).toBe(true); // 🔒 잠김
    expect(body.headcount).toBe(3);
    expect(body.created_at).toBeTruthy();

    // 통계 확인
    expect(body.stats).toBeDefined();
    expect(body.stats.total_slots).toBe(3);
    expect(body.stats.filled_slots).toBe(2);
    expect(body.stats.empty_slots).toBe(1);

    // 슬롯 확인
    expect(body.slots).toHaveLength(3);

    // 슬롯 1 (작성됨) - 잠김이므로 content/미디어 숨김
    expect(body.slots[0].user_id).toBe(owner.id);
    expect(body.slots[0].nickname).toBe('owner');
    expect(body.slots[0].entry_id).toBeTruthy();
    expect(body.slots[0].wrote_at).toBeTruthy();
    expect(body.slots[0].content).toBeNull(); // ⚠️ 숨김
    expect(body.slots[0].images_ids).toEqual([]); // ⚠️ 숨김
    expect(body.slots[0].audio_id).toBeNull(); // ⚠️ 숨김
    expect(body.slots[0].video_id).toBeNull(); // ⚠️ 숨김

    // 슬롯 2 (작성됨) - 잠김이므로 content/미디어 숨김
    expect(body.slots[1].user_id).toBe(participant.id);
    expect(body.slots[1].nickname).toBe('participant');
    expect(body.slots[1].entry_id).toBeTruthy();
    expect(body.slots[1].wrote_at).toBeTruthy();
    expect(body.slots[1].content).toBeNull(); // ⚠️ 숨김
    expect(body.slots[1].images_ids).toEqual([]); // ⚠️ 숨김
    expect(body.slots[1].audio_id).toBeNull(); // ⚠️ 숨김
    expect(body.slots[1].video_id).toBeNull(); // ⚠️ 숨김

    // 슬롯 3 (빈 슬롯)
    expect(body.slots[2].user_id).toBeNull();
    expect(body.slots[2].entry_id).toBeNull();
    expect(body.slots[2].content).toBeNull();
    expect(body.slots[2].images_ids).toEqual([]);
    expect(body.slots[2].audio_id).toBeNull();
    expect(body.slots[2].video_id).toBeNull();

    await cleanupUser(owner.id);
    await cleanupUser(participant.id);
  });

  test('🔓 열린 캡슐: 모든 content와 미디어 표시됨', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('owner2');
    const participant = await createUser('participant2');

    // 과거로 개봉된 캡슐 생성 (열림)
    const { capsuleId } = await createPaidOrderWithCapsule(
      owner.id,
      3,
      'PAID',
      '-1 day', // 어제 개봉 (열림)
    );

    // 슬롯 및 작성 데이터 생성
    const slot1 = await createSlot(capsuleId, 0, owner.id);
    const slot2 = await createSlot(capsuleId, 1, participant.id);
    await createSlot(capsuleId, 2); // 빈 슬롯

    const mediaId1 = await insertMedia(owner.id, 'IMAGE');
    const mediaId2 = await insertMedia(participant.id, 'AUDIO');

    await createEntry(capsuleId, slot1, owner.id, '오너의 비밀 메시지', [
      mediaId1,
    ]);
    await createEntry(capsuleId, slot2, participant.id, '참여자의 추억', [
      mediaId2,
    ]);

    // API 호출
    const res = await api.get(`/api/time-capsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // 기본 정보 확인
    expect(body.id).toBe(capsuleId);
    expect(body.is_locked).toBe(false); // 🔓 열림
    expect(body.headcount).toBe(3);
    expect(body.created_at).toBeTruthy();

    // 통계 확인
    expect(body.stats).toBeDefined();
    expect(body.stats.total_slots).toBe(3);
    expect(body.stats.filled_slots).toBe(2);
    expect(body.stats.empty_slots).toBe(1);

    // 슬롯 확인
    expect(body.slots).toHaveLength(3);

    // 슬롯 1 (작성됨) - 열림이므로 content/미디어 표시
    expect(body.slots[0].user_id).toBe(owner.id);
    expect(body.slots[0].nickname).toBe('owner2');
    expect(body.slots[0].entry_id).toBeTruthy();
    expect(body.slots[0].wrote_at).toBeTruthy();
    expect(body.slots[0].content).toBe('오너의 비밀 메시지'); // ✅ 표시
    expect(body.slots[0].images_ids).toHaveLength(1); // ✅ 표시
    expect(body.slots[0].images_ids[0]).toBe(mediaId1);
    expect(body.slots[0].audio_id).toBeNull();
    expect(body.slots[0].video_id).toBeNull();

    // 슬롯 2 (작성됨) - 열림이므로 content/미디어 표시
    expect(body.slots[1].user_id).toBe(participant.id);
    expect(body.slots[1].nickname).toBe('participant2');
    expect(body.slots[1].entry_id).toBeTruthy();
    expect(body.slots[1].wrote_at).toBeTruthy();
    expect(body.slots[1].content).toBe('참여자의 추억'); // ✅ 표시
    expect(body.slots[1].images_ids).toEqual([]);
    expect(body.slots[1].audio_id).toBe(mediaId2); // ✅ 표시
    expect(body.slots[1].video_id).toBeNull();

    // 슬롯 3 (빈 슬롯)
    expect(body.slots[2].user_id).toBeNull();
    expect(body.slots[2].entry_id).toBeNull();
    expect(body.slots[2].content).toBeNull();
    expect(body.slots[2].images_ids).toEqual([]);
    expect(body.slots[2].audio_id).toBeNull();
    expect(body.slots[2].video_id).toBeNull();

    await cleanupUser(owner.id);
    await cleanupUser(participant.id);
  });

  test('빈 슬롯만 있는 캡슐 조회', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('owner3');

    // 잠긴 캡슐 생성 (아무도 작성 안 함)
    const { capsuleId } = await createPaidOrderWithCapsule(
      owner.id,
      2,
      'PAID',
      '1 day',
    );

    await createSlot(capsuleId, 0); // 빈 슬롯 1
    await createSlot(capsuleId, 1); // 빈 슬롯 2

    const res = await api.get(`/api/time-capsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.is_locked).toBe(true);
    expect(body.stats.total_slots).toBe(2);
    expect(body.stats.filled_slots).toBe(0);
    expect(body.stats.empty_slots).toBe(2);

    expect(body.slots).toHaveLength(2);
    expect(body.slots[0].user_id).toBeNull();
    expect(body.slots[0].content).toBeNull();
    expect(body.slots[0].images_ids).toEqual([]);
    expect(body.slots[0].audio_id).toBeNull();
    expect(body.slots[0].video_id).toBeNull();

    await cleanupUser(owner.id);
  });

  test('미결제 캡슐 조회 시 403 에러', async () => {
    await createProductTimeCapsule();
    const owner = await createUser('owner4');

    const { capsuleId } = await createPaidOrderWithCapsule(
      owner.id,
      1,
      'PENDING_PAYMENT', // 미결제
      '1 day',
    );

    const res = await api.get(`/api/time-capsules/${capsuleId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('CAPSULE_PAYMENT_REQUIRED');

    await cleanupUser(owner.id);
  });

  test('존재하지 않는 캡슐 조회 시 404 에러', async () => {
    await createProductTimeCapsule();
    const user = await createUser('user5');

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await api.get(`/api/time-capsules/${fakeId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(res.status()).toBe(404);

    await cleanupUser(user.id);
  });
});
