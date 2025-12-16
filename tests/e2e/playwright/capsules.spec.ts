import 'reflect-metadata';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME ?? 'kimdongeun',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'banny_banny',
};

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

let api: APIRequestContext;
let client: Client;

async function createProductEasterEgg(limit = 1) {
  const productId = '00000000-0000-0000-0000-0000000000a1';
  await client.query('DELETE FROM products WHERE id = $1', [productId]);
  await client.query(
    `
    INSERT INTO products (id, name, price, media_types, max_media_count, product_type, is_active)
    VALUES ($1, 'e2e-egg', 0, '{"IMAGE"}'::products_media_types_enum[], $2, 'EASTER_EGG', true)
    `,
    [productId, limit],
  );
  return productId;
}

test.beforeAll(async ({ playwright }) => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await client.query('DELETE FROM products WHERE id = $1', [
    '00000000-0000-0000-0000-0000000000a1',
  ]);
  await client.end();
  await api.dispose();
});

// 프론트 연동 없는 환경을 위한 하드코딩 유저/토큰 생성기
async function createUser(eggSlots = 3) {
  const id = '00000000-0000-0000-0000-00000000e2e1';
  const phone = '010-9999-8888';
  // 동일 ID가 남아있을 경우 정리
  await client.query('DELETE FROM users WHERE id = $1', [id]);
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', $4)
    `,
    [id, 'e2e-user', phone, eggSlots],
  );
  const token = jwt.sign({ sub: id, nickname: 'e2e-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

test('캡슐 생성 성공 (201) 및 슬롯 차감', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'e2e capsule',
      content: 'hello world',
      media_urls: ['https://cdn.example.com/img1.jpg'],
      media_types: ['IMAGE'],
      open_at: openAt,
      view_limit: 1,
    },
  });

  if (res.status() !== 201) {
    console.error('create error', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  expect(body.media_types?.[0]).toBe('IMAGE');

  const { rows } = await client.query(
    'SELECT egg_slots FROM users WHERE id = $1',
    [id],
  );
  expect(rows[0].egg_slots).toBe(2);

  await cleanupUser(id);
});

test('슬롯 부족 시 409', async () => {
  const { id, token } = await createUser(0);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'slot exhausted',
      open_at: openAt,
    },
  });

  if (res.status() !== 409) {
    console.error('slot error', res.status(), await res.text());
  }
  expect(res.status()).toBe(409);

  await cleanupUser(id);
});

test('open_at이 과거면 400', async () => {
  const { id, token } = await createUser(3);
  const past = new Date(Date.now() - 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'past open',
      open_at: past,
    },
  });

  if (res.status() !== 400) {
    console.error('past error', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('media type가 IMAGE인데 url 없음 → 400', async () => {
  const { id, token } = await createUser(3);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'media mismatch',
      media_types: ['IMAGE'],
      media_urls: [null],
      open_at: openAt,
    },
  });

  if (res.status() !== 400) {
    console.error('media mismatch', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});

test('EASTER_EGG 상품 max_media_count 초과시 400', async () => {
  const { id, token } = await createUser(3);
  const productId = await createProductEasterEgg(1);
  const openAt = new Date(Date.now() + 60_000).toISOString();

  const res = await api.post('/api/capsules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'product limit',
      product_id: productId,
      media_types: ['IMAGE', 'IMAGE'], // 2개 > limit 1
      media_urls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
      open_at: openAt,
    },
  });

  if (res.status() !== 400) {
    console.error('product limit', res.status(), await res.text());
  }
  expect(res.status()).toBe(400);

  await cleanupUser(id);
});