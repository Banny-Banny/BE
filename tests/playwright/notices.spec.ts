/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

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

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const scryptAsync = promisify(crypto.scrypt);

let api: APIRequestContext;
let client: Client;

test.beforeAll(async () => {
  client = new Client(DB_CONFIG);
  await client.connect();
  api = await request.newContext({ baseURL: API_BASE_URL });
});

test.afterAll(async () => {
  await client.end();
  await api.dispose();
});

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function createAdminUser(
  email: string,
  password: string,
  role: 'SUPER_ADMIN' | 'ADMIN' = 'ADMIN',
  name = '관리자',
) {
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const [localPart, domain] = email.split('@');
  const uniqueEmail = domain
    ? `${localPart}+${uniqueSuffix}@${domain}`
    : `${email}_${uniqueSuffix}`;
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await client.query(
    `
    INSERT INTO admin_users (id, email, name, password_hash, role, is_active)
    VALUES ($1, $2, $3, $4, $5, true)
    `,
    [id, uniqueEmail, name, passwordHash, role],
  );
  return { id, email: uniqueEmail };
}

async function cleanupAdminUser(id: string) {
  await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
}

async function loginAdmin(email: string, password: string) {
  const res = await api.post('/api/admin/auth/login', {
    data: { email, password },
  });
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error('access token missing');
  }
  return { status: res.status(), accessToken: body.accessToken };
}

async function createNotice(params: {
  title: string;
  content: string;
  imageUrl?: string | null;
  isPinned?: boolean;
  isVisible?: boolean;
  createdAt?: Date;
}) {
  const id = crypto.randomUUID();
  const createdAt = params.createdAt ?? new Date();
  await client.query(
    `
    INSERT INTO notices (
      id, title, content, image_url, is_pinned, is_visible, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [
      id,
      params.title,
      params.content,
      params.imageUrl ?? null,
      params.isPinned ?? false,
      params.isVisible ?? true,
      createdAt,
    ],
  );
  return id;
}

async function cleanupNotices(ids: string[]) {
  if (!ids.length) return;
  await client.query('DELETE FROM notices WHERE id = ANY($1::uuid[])', [ids]);
}

test('POST /api/admin/notices 201: 공지사항 작성', async () => {
  const admin = await createAdminUser('notice-admin@test.com', 'test1234');
  const login = await loginAdmin(admin.email, 'test1234');

  const res = await api.post('/api/admin/notices', {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    data: {
      title: '공지 제목',
      content: '공지 본문',
      imageUrl: 'https://example.com/notice.png',
      isPinned: true,
      isVisible: true,
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.title).toBe('공지 제목');
  expect(body.data.isPinned).toBe(true);

  const noticeId = body.data.id as string;
  const db = await client.query('SELECT * FROM notices WHERE id = $1', [
    noticeId,
  ]);
  expect(db.rows.length).toBe(1);
  expect(db.rows[0].title).toBe('공지 제목');

  await cleanupNotices([noticeId]);
  await cleanupAdminUser(admin.id);
});

test('PATCH /api/admin/notices/:id 200: 공지사항 수정', async () => {
  const admin = await createAdminUser('notice-admin@test.com', 'test1234');
  const login = await loginAdmin(admin.email, 'test1234');
  const noticeId = await createNotice({
    title: '수정 전',
    content: '내용',
    isPinned: false,
    isVisible: true,
  });

  const res = await api.patch(`/api/admin/notices/${noticeId}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    data: {
      title: '수정 후',
      isPinned: true,
      isVisible: false,
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.title).toBe('수정 후');
  expect(body.data.isPinned).toBe(true);
  expect(body.data.isVisible).toBe(false);

  const db = await client.query(
    'SELECT title, is_pinned, is_visible FROM notices WHERE id = $1',
    [noticeId],
  );
  expect(db.rows[0].title).toBe('수정 후');
  expect(db.rows[0].is_pinned).toBe(true);
  expect(db.rows[0].is_visible).toBe(false);

  await cleanupNotices([noticeId]);
  await cleanupAdminUser(admin.id);
});

test('DELETE /api/admin/notices/:id 200: 공지사항 삭제', async () => {
  const admin = await createAdminUser('notice-admin@test.com', 'test1234');
  const login = await loginAdmin(admin.email, 'test1234');
  const noticeId = await createNotice({
    title: '삭제 테스트',
    content: '삭제 본문',
  });

  const res = await api.delete(`/api/admin/notices/${noticeId}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });

  expect(res.status()).toBe(200);

  const db = await client.query(
    'SELECT deleted_at FROM notices WHERE id = $1',
    [noticeId],
  );
  expect(db.rows.length).toBe(1);
  expect(db.rows[0].deleted_at).not.toBeNull();

  await cleanupNotices([noticeId]);
  await cleanupAdminUser(admin.id);
});

test('GET /api/notices 200: 공지사항 리스트(상단 고정 정렬)', async () => {
  const createdIds: string[] = [];
  const base = new Date();

  const pinnedOld = await createNotice({
    title: '고정-오래됨',
    content: '내용',
    isPinned: true,
    isVisible: true,
    createdAt: new Date(base.getTime() - 1000 * 60 * 10),
  });
  createdIds.push(pinnedOld);

  const pinnedNew = await createNotice({
    title: '고정-최신',
    content: '내용',
    isPinned: true,
    isVisible: true,
    createdAt: new Date(base.getTime() - 1000 * 60 * 5),
  });
  createdIds.push(pinnedNew);

  const normalNew = await createNotice({
    title: '일반-최신',
    content: '내용',
    isPinned: false,
    isVisible: true,
    createdAt: new Date(base.getTime() - 1000 * 60 * 1),
  });
  createdIds.push(normalNew);

  const hidden = await createNotice({
    title: '비노출',
    content: '내용',
    isPinned: true,
    isVisible: false,
  });
  createdIds.push(hidden);

  const res = await api.get('/api/notices?limit=10&offset=0');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    data: { items: { title: string }[] };
  };
  expect(body.data.items.length).toBeGreaterThanOrEqual(3);

  const titles = body.data.items.map((item) => item.title);
  const pinnedNewIndex = titles.indexOf('고정-최신');
  const pinnedOldIndex = titles.indexOf('고정-오래됨');
  const normalNewIndex = titles.indexOf('일반-최신');

  expect(pinnedNewIndex).toBeGreaterThan(-1);
  expect(pinnedOldIndex).toBeGreaterThan(-1);
  expect(normalNewIndex).toBeGreaterThan(-1);
  expect(pinnedNewIndex).toBeLessThan(pinnedOldIndex);
  expect(pinnedOldIndex).toBeLessThan(normalNewIndex);

  await cleanupNotices(createdIds);
});

test('GET /api/notices/:id 200/404: 상세 조회 및 비노출 차단', async () => {
  const visibleId = await createNotice({
    title: '상세 공개',
    content: '상세 내용',
    isVisible: true,
  });
  const hiddenId = await createNotice({
    title: '상세 비노출',
    content: '비노출',
    isVisible: false,
  });

  const okRes = await api.get(`/api/notices/${visibleId}`);
  expect(okRes.status()).toBe(200);
  const okBody = await okRes.json();
  expect(okBody.data.title).toBe('상세 공개');

  const notFoundRes = await api.get(`/api/notices/${hiddenId}`);
  expect(notFoundRes.status()).toBe(404);

  await cleanupNotices([visibleId, hiddenId]);
});

test('GET /api/notices?search= 200: 검색 필터', async () => {
  const ids: string[] = [];
  ids.push(
    await createNotice({
      title: '검색-키워드-제목',
      content: '내용',
      isVisible: true,
    }),
  );
  ids.push(
    await createNotice({
      title: '일반 제목',
      content: '검색-키워드-본문',
      isVisible: true,
    }),
  );
  ids.push(
    await createNotice({
      title: '다른 공지',
      content: '무관',
      isVisible: true,
    }),
  );

  const res = await api.get('/api/notices?search=키워드');
  expect(res.status()).toBe(200);
  const body = await res.json();
  const titles = body.data.items.map((item: { title: string }) => item.title);
  expect(titles).toContain('검색-키워드-제목');
  expect(titles).toContain('일반 제목');
  expect(titles).not.toContain('다른 공지');

  await cleanupNotices(ids);
});
