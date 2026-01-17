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
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

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

test.skip(
  skipIfNoS3,
  'S3_BUCKET env가 없어 미디어 업로드 테스트를 건너뜁니다.',
);

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

// ============================================
// 미디어 직접 업로드 테스트
// ============================================

test('POST /api/media/upload 201: 이미지 직접 업로드 성공', async () => {
  const { id, token } = await createUser();

  const imageBuffer = Buffer.from('fake-image-data');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'test-image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  if (res.status() !== 201) {
    console.error('upload error', res.status(), await res.text());
  }
  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.media_id).toBeDefined();
  expect(body.object_key).toBeDefined();
  expect(body.type).toBe('IMAGE');
  expect(body.size).toBeGreaterThan(0);
  expect(body.content_type).toBe('image/jpeg');

  // DB에서 미디어 확인
  const mediaRow = await client.query('SELECT * FROM media WHERE id = $1', [
    body.media_id,
  ]);
  expect(mediaRow.rows.length).toBe(1);
  expect(mediaRow.rows[0].type).toBe('IMAGE');
  expect(mediaRow.rows[0].user_id).toBe(id);

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 201: 비디오 직접 업로드 성공', async () => {
  const { id, token } = await createUser();

  const videoBuffer = Buffer.from('fake-video-data');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'test-video.mp4',
        mimeType: 'video/mp4',
        buffer: videoBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.media_id).toBeDefined();
  expect(body.type).toBe('VIDEO');
  expect(body.content_type).toBe('video/mp4');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 201: 오디오 직접 업로드 성공', async () => {
  const { id, token } = await createUser();

  const audioBuffer = Buffer.from('fake-audio-data');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'test-audio.mp3',
        mimeType: 'audio/mpeg',
        buffer: audioBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.media_id).toBeDefined();
  expect(body.type).toBe('AUDIO');
  expect(body.content_type).toBe('audio/mpeg');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 201: type 파라미터 명시 (IMAGE)', async () => {
  const { id, token } = await createUser();

  const imageBuffer = Buffer.from('fake-image');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      type: 'IMAGE',
      file: {
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.type).toBe('IMAGE');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 400: 파일 없이 요청', async () => {
  const { id, token } = await createUser();

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(400);
  const bodyText = await res.text();
  expect(bodyText).toContain('FILE_REQUIRED');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 400: 지원하지 않는 파일 타입 (PDF)', async () => {
  const { id, token } = await createUser();

  const pdfBuffer = Buffer.from('fake-pdf-data');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
    },
  });

  expect(res.status()).toBe(400);
  const bodyText = await res.text();
  expect(bodyText).toContain('UNSUPPORTED_FILE_TYPE');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 400: 잘못된 type 파라미터', async () => {
  const { id, token } = await createUser();

  const imageBuffer = Buffer.from('fake-image');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      type: 'INVALID_TYPE',
      file: {
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(400);
  const bodyText = await res.text();
  expect(bodyText).toContain('INVALID_MEDIA_TYPE');

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 401: 인증 없이 요청', async () => {
  const imageBuffer = Buffer.from('fake-image');

  const res = await api.post('/api/media/upload', {
    multipart: {
      file: {
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(401);
});

test('POST /api/media/upload 201: 자동 타입 감지 (image/*)', async () => {
  const { id, token } = await createUser();

  const imageBuffer = Buffer.from('fake-image');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'photo.png',
        mimeType: 'image/png',
        buffer: imageBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.type).toBe('IMAGE'); // 자동 감지됨

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 201: 자동 타입 감지 (video/*)', async () => {
  const { id, token } = await createUser();

  const videoBuffer = Buffer.from('fake-video');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'clip.webm',
        mimeType: 'video/webm',
        buffer: videoBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.type).toBe('VIDEO'); // 자동 감지됨

  await cleanupUserAndMedia(id);
});

test('POST /api/media/upload 201: 자동 타입 감지 (audio/*)', async () => {
  const { id, token } = await createUser();

  const audioBuffer = Buffer.from('fake-audio');

  const res = await api.post('/api/media/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'sound.mp3',
        mimeType: 'audio/mpeg',
        buffer: audioBuffer,
      },
    },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.type).toBe('AUDIO'); // 자동 감지됨

  await cleanupUserAndMedia(id);
});
