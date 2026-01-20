/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import dotenv from 'dotenv';
import { test, expect, request, APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { promisify } from 'util';

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
const scryptAsync = promisify(crypto.scrypt);

let api: APIRequestContext;
let client: Client;

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
  return { id, email: uniqueEmail, role };
}

async function cleanupAdminUser(id: string) {
  await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
}

async function createUser(
  nickname = 'test-user',
  email: string | null = null,
  isActive = true,
  createdAt?: Date,
) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, email, provider, egg_slots, is_active, created_at)
    VALUES ($1, $2, $3, $4, 'LOCAL', 3, $5, $6)
    `,
    [id, nickname, phone, email, isActive, createdAt ?? new Date()],
  );
  const token = jwt.sign({ sub: id, nickname, tokenVersion: 0 }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token, nickname, email };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function setUserDeletedAt(id: string, deletedAt: Date) {
  await client.query(
    `
    UPDATE users
    SET deleted_at = $2,
        is_active = false
    WHERE id = $1
    `,
    [id, deletedAt],
  );
}

async function createCustomerService(userId: string, createdAt?: Date) {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO customer_services (id, user_id, title, content, created_at, updated_at, is_resolved)
    VALUES ($1, $2, '문의 제목', '문의 내용', $3, $3, false)
    `,
    [id, userId, createdAt ?? new Date()],
  );
  return id;
}

async function createCapsule(userId: string) {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, capsule_type, title, content, created_at)
    VALUES ($1, $2, 'EASTER_EGG', '테스트 캡슐', '내용', NOW())
    `,
    [id, userId],
  );
  await client.query(
    `
    INSERT INTO easter_eggs (capsule_id, view_limit, view_count)
    VALUES ($1, 0, 0)
    `,
    [id],
  );
  return id;
}

async function createAccessLog(capsuleId: string, viewerId: string) {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsule_access_logs (id, capsule_id, viewer_id, viewed_at)
    VALUES ($1, $2, $3, NOW())
    `,
    [id, capsuleId, viewerId],
  );
  return id;
}

async function createProduct() {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO products (id, name, price, product_type, description, is_active, created_at)
    VALUES ($1, '테스트 상품', 1000, 'TIME_CAPSULE', '테스트 설명', true, NOW())
    `,
    [id],
  );
  return id;
}

async function createOrder(userId: string, productId: string) {
  const id = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO orders (
      id, user_id, product_id, total_amount, time_option, headcount, photo_count, add_music, add_video, status, created_at
    ) VALUES ($1, $2, $3, 1000, '1_WEEK', 1, 0, false, false, 'PAID', NOW())
    `,
    [id, userId, productId],
  );
  return id;
}

async function createPayment(orderId: string, approvedAt?: Date) {
  const id = crypto.randomUUID();
  const approved = approvedAt ?? new Date();
  const createdAt = new Date();
  await client.query(
    `
    INSERT INTO payments (
      id, order_id, pg_tid, amount, status, approved_at, created_at, currency
    ) VALUES ($1, $2, $3, 1000, 'PAID', $4, $5, 'KRW')
    `,
    [id, orderId, `PG-${crypto.randomUUID()}`, approved, createdAt],
  );
  return id;
}

async function cleanupPayments() {
  await client.query(`DELETE FROM payments`);
}

async function cleanupOrders() {
  await client.query(`DELETE FROM orders`);
}

async function cleanupProducts() {
  await client.query(`DELETE FROM products`);
}

// ============================================
// Admin Auth
// ============================================

test('POST /api/admin/auth/login 200: 관리자 로그인', async () => {
  const admin = await createAdminUser(
    'admin_login@example.com',
    'password1234',
  );

  const res = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.accessToken).toBeTruthy();
  expect(body.refreshToken).toBeTruthy();
  expect(body.admin.email).toBe(admin.email);

  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/auth/login 401: 비밀번호 불일치', async () => {
  const admin = await createAdminUser('admin_fail@example.com', 'password1234');

  const res = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'wrong-password' },
  });

  expect(res.status()).toBe(401);

  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/auth/refresh 200: 토큰 재발급', async () => {
  const admin = await createAdminUser(
    'admin_refresh@example.com',
    'password1234',
  );

  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const refreshRes = await api.post('/api/admin/auth/refresh', {
    data: { refreshToken: loginBody.refreshToken },
  });

  expect(refreshRes.status()).toBe(200);
  const refreshBody = await refreshRes.json();
  expect(refreshBody.accessToken).toBeTruthy();
  expect(refreshBody.refreshToken).toBeTruthy();

  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/auth/logout 200: 로그아웃 후 접근 실패', async () => {
  const admin = await createAdminUser(
    'admin_logout@example.com',
    'password1234',
  );

  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const logoutRes = await api.post('/api/admin/auth/logout', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(logoutRes.status()).toBe(200);

  const meRes = await api.get('/api/admin/auth/me', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(meRes.status()).toBe(401);

  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/auth/admins 201: 슈퍼 어드민이 관리자 생성', async () => {
  const superAdmin = await createAdminUser(
    'super_admin@example.com',
    'password1234',
    'SUPER_ADMIN',
  );

  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: superAdmin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const uniqueAdminEmail = `created_admin_${Date.now()}@example.com`;
  const res = await api.post('/api/admin/auth/admins', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    data: {
      email: uniqueAdminEmail,
      name: '생성관리자',
      password: 'password1234',
    },
  });

  expect(res.status()).toBe(201);
  const created = await client.query(
    `SELECT * FROM admin_users WHERE email = $1`,
    [uniqueAdminEmail],
  );
  expect(created.rowCount).toBe(1);

  await cleanupAdminUser(String(created.rows[0].id));
  await cleanupAdminUser(superAdmin.id);
});

test('POST /api/admin/auth/admins 403: 일반 관리자 접근', async () => {
  const admin = await createAdminUser('admin_only@example.com', 'password1234');

  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const res = await api.post('/api/admin/auth/admins', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    data: {
      email: 'should_fail@example.com',
      name: '실패관리자',
      password: 'password1234',
    },
  });

  expect(res.status()).toBe(403);

  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/auth/me 200: 관리자 프로필', async () => {
  const admin = await createAdminUser('admin_me@example.com', 'password1234');

  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const res = await api.get('/api/admin/auth/me', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.email).toBe(admin.email);

  await cleanupAdminUser(admin.id);
});

// ============================================
// Dashboard
// ============================================

test('GET /api/admin/dashboard/summary 200: 요약 지표', async () => {
  const admin = await createAdminUser(
    'admin_summary@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const baseRes = await api.get('/api/admin/dashboard/summary', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  const baseBody = await baseRes.json();

  const user1 = await createUser('대시보드유저1');
  const user2 = await createUser('대시보드유저2');
  await createCustomerService(user1.id);

  const capsuleId = await createCapsule(user1.id);
  await createAccessLog(capsuleId, user1.id);
  await createAccessLog(capsuleId, user2.id);

  const res = await api.get('/api/admin/dashboard/summary', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.data.signups).toBe(baseBody.data.signups + 2);
  expect(body.data.newInquiries).toBe(baseBody.data.newInquiries + 1);
  expect(body.data.dau).toBe(baseBody.data.dau + 2);

  await cleanupUser(user1.id);
  await cleanupUser(user2.id);
  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/dashboard/charts 200: 차트 데이터', async () => {
  const admin = await createAdminUser(
    'admin_charts@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const targetDate = new Date('2001-01-05T00:00:00.000Z');
  const user = await createUser(
    '차트유저',
    'chart@example.com',
    true,
    targetDate,
  );
  const productId = await createProduct();
  const orderId = await createOrder(user.id, productId);
  await createPayment(orderId, targetDate);

  const res = await api.get('/api/admin/dashboard/charts', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    params: {
      period: 'day',
      startDate: '2001-01-05',
      endDate: '2001-01-05',
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  const item = body.data.items.find(
    (row: { signups: number; revenue: number }) =>
      row.signups >= 1 && row.revenue >= 1000,
  );
  expect(item).toBeTruthy();
  expect(item.signups).toBeGreaterThanOrEqual(1);
  expect(item.revenue).toBeGreaterThanOrEqual(1000);

  await cleanupPayments();
  await cleanupOrders();
  await cleanupProducts();
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/dashboard/user-trends 200: 가입/탈퇴 추이', async () => {
  const admin = await createAdminUser(
    'admin_user_trends@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const baseRes = await api.get('/api/admin/dashboard/user-trends', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    params: { period: '90d' },
  });
  const baseBody = await baseRes.json();
  const baseData = baseBody.data ?? [];
  const baseJoinedTotal = baseData.reduce(
    (sum: number, row: { joined?: number }) => sum + (row.joined ?? 0),
    0,
  );
  const baseWithdrawnTotal = baseData.reduce(
    (sum: number, row: { withdrawn?: number }) => sum + (row.withdrawn ?? 0),
    0,
  );

  const joinedDate = new Date();
  joinedDate.setDate(joinedDate.getDate() - 2);
  joinedDate.setHours(12, 0, 0, 0);

  const withdrawnDate = new Date();
  withdrawnDate.setDate(withdrawnDate.getDate() - 1);
  withdrawnDate.setHours(12, 0, 0, 0);

  const joinedUser = await createUser(
    '가입추이유저',
    'joined@example.com',
    true,
    joinedDate,
  );
  const withdrawnUser = await createUser(
    '탈퇴추이유저',
    'withdrawn@example.com',
    false,
    withdrawnDate,
  );
  await setUserDeletedAt(withdrawnUser.id, withdrawnDate);

  const res = await api.get('/api/admin/dashboard/user-trends', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    params: { period: '90d' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.data.length).toBe(90);

  const nextJoinedTotal = body.data.reduce(
    (sum: number, row: { joined?: number }) => sum + (row.joined ?? 0),
    0,
  );
  const nextWithdrawnTotal = body.data.reduce(
    (sum: number, row: { withdrawn?: number }) => sum + (row.withdrawn ?? 0),
    0,
  );

  expect(nextJoinedTotal).toBe(baseJoinedTotal + 2);
  expect(nextWithdrawnTotal).toBe(baseWithdrawnTotal + 1);

  await cleanupUser(joinedUser.id);
  await cleanupUser(withdrawnUser.id);
  await cleanupAdminUser(admin.id);
});

// ============================================
// User Management
// ============================================

test('GET /api/admin/users 200: 검색/필터/페이지네이션', async () => {
  const admin = await createAdminUser(
    'admin_users@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const uniqueEmail = `search_${Date.now()}@example.com`;
  const user = await createUser('검색유저', uniqueEmail);
  const inactiveUser = await createUser(
    '비활성유저',
    'inactive@example.com',
    false,
  );

  const res = await api.get('/api/admin/users', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    params: { search: uniqueEmail, limit: 10, offset: 0 },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(
    body.data.items.some((item: { id: string }) => item.id === user.id),
  ).toBe(true);

  const inactiveRes = await api.get('/api/admin/users', {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    params: { status: 'INACTIVE', limit: 10, offset: 0 },
  });
  const inactiveBody = await inactiveRes.json();
  expect(
    inactiveBody.data.items.some(
      (item: { id: string }) => item.id === inactiveUser.id,
    ),
  ).toBe(true);

  await cleanupUser(user.id);
  await cleanupUser(inactiveUser.id);
  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/users/:id 200: 유저 상세', async () => {
  const admin = await createAdminUser(
    'admin_detail@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const user = await createUser('상세유저', 'detail@example.com');
  const capsuleId = await createCapsule(user.id);
  await createAccessLog(capsuleId, user.id);

  const res = await api.get(`/api/admin/users/${user.id}`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.user.id).toBe(user.id);
  expect(body.data.activityLogs.length).toBeGreaterThan(0);

  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/users/:id 200: 유저 정보 수정', async () => {
  const admin = await createAdminUser(
    'admin_update@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const user = await createUser('수정유저', 'update@example.com');

  const res = await api.post(`/api/admin/users/${user.id}`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    data: {
      nickname: '변경닉네임',
      email: 'updated@example.com',
      isPushAgreed: false,
    },
  });

  expect(res.status()).toBe(201);
  const dbUser = await client.query('SELECT * FROM users WHERE id = $1', [
    user.id,
  ]);
  expect(dbUser.rows[0].nickname).toBe('변경닉네임');
  expect(dbUser.rows[0].email).toBe('updated@example.com');

  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/users/:id/block 200: 유저 차단/해제', async () => {
  const admin = await createAdminUser(
    'admin_block@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const user = await createUser('차단유저', 'block@example.com');

  const blockRes = await api.post(`/api/admin/users/${user.id}/block`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(blockRes.status()).toBe(201);

  const blocked = await client.query(
    'SELECT is_active FROM users WHERE id = $1',
    [user.id],
  );
  expect(blocked.rows[0].is_active).toBe(false);

  const unblockRes = await api.post(`/api/admin/users/${user.id}/unblock`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(unblockRes.status()).toBe(201);

  const unblocked = await client.query(
    'SELECT is_active FROM users WHERE id = $1',
    [user.id],
  );
  expect(unblocked.rows[0].is_active).toBe(true);

  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('POST /api/admin/users/:id/deactivate 200: 유저 탈퇴 처리', async () => {
  const admin = await createAdminUser(
    'admin_deactivate@example.com',
    'password1234',
  );
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: admin.email, password: 'password1234' },
  });
  const loginBody = await loginRes.json();

  const user = await createUser('탈퇴유저', 'deactivate@example.com');

  const res = await api.post(`/api/admin/users/${user.id}/deactivate`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  expect(res.status()).toBe(201);

  const dbUser = await client.query(
    'SELECT is_active, deleted_at FROM users WHERE id = $1',
    [user.id],
  );
  expect(dbUser.rows[0].is_active).toBe(false);
  expect(dbUser.rows[0].deleted_at).toBeTruthy();

  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});
