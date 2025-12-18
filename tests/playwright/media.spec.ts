import 'reflect-metadata';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME ?? '',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? '',
};

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

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
    [id, 'media-user', phone],
  );
  const token = jwt.sign({ sub: id, nickname: 'media-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

async function cleanupUserAndMedia(id: string) {
  await client.query('DELETE FROM media WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await client.end();
  await api.dispose();
});

// 환경에 S3가 준비되지 않았다면 스킵
const skipIfNoS3 = !process.env.S3_BUCKET;

test.skip(skipIfNoS3, 'S3_BUCKET env가 없어 미디어 업로드 테스트를 건너뜁니다.');

test('미디어 presign → complete → signed-url 201', async () => {
  const { id, token } = await createUser();

  const presignRes = await api.post('/api/media/presign', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      type: 'IMAGE',
      filename: 'sample.jpg',
      content_type: 'image/jpeg',
      size: 1024,
    },
  });

  if (presignRes.status() !== 201) {
    console.error('presign', presignRes.status(), await presignRes.text());
  }
  expect(presignRes.status()).toBe(201);
  const presignBody = await presignRes.json();
  expect(presignBody.upload_url).toBeTruthy();
  expect(presignBody.object_key).toContain('media/');

  // 업로드는 실제 S3 환경 의존이므로 생략하고 complete 호출
  const completeRes = await api.post('/api/media/complete', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      object_key: presignBody.object_key,
      content_type: 'image/jpeg',
      size: 1024,
      width: 100,
      height: 100,
    },
  });

  expect(completeRes.status()).toBe(201);
  const completeBody = await completeRes.json();
  expect(completeBody.media_id).toBeTruthy();

  const signedRes = await api.get(`/api/media/${completeBody.media_id}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(signedRes.status()).toBe(200);
  const signedBody = await signedRes.json();
  expect(signedBody.url).toBeTruthy();

  await cleanupUserAndMedia(id);
});

test('잘못된 파일 타입은 400', async () => {
  const { id, token } = await createUser();

  const res = await api.post('/api/media/presign', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      type: 'IMAGE',
      filename: 'doc.pdf',
      content_type: 'application/pdf',
      size: 1024,
    },
  });

  expect(res.status()).toBe(400);

  await cleanupUserAndMedia(id);
});

