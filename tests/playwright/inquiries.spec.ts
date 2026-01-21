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
import { io, Socket } from 'socket.io-client';

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
const JWT_SECRET = process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';
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

async function createUser(nickname = 'test-user', email: string | null = null) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, email, provider, egg_slots, is_active, created_at)
    VALUES ($1, $2, $3, $4, 'LOCAL', 3, true, NOW())
    `,
    [id, nickname, phone, email],
  );
  const token = jwt.sign({ sub: id, nickname, tokenVersion: 0 }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token, nickname, email };
}

async function cleanupUser(id: string) {
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function createInquiry(
  userId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' = 'PENDING',
  createdAt?: Date,
  preview = '문의 시작',
) {
  const id = crypto.randomUUID();
  const timestamp = createdAt ?? new Date();
  const isResolved = status === 'COMPLETED';
  await client.query(
    `
    INSERT INTO customer_services (
      id, user_id, title, content, created_at, updated_at, is_resolved,
      status, last_message_at, last_message_preview
    )
    VALUES ($1, $2, '문의 제목', '문의 내용', $3, $3, $4, $5, $6, $7)
    `,
    [id, userId, timestamp, isResolved, status, timestamp, preview],
  );
  return id;
}

async function createInquiryMessage(params: {
  inquiryId: string;
  senderType: 'USER' | 'ADMIN';
  content: string;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  createdAt?: Date;
  isReadByAdmin?: boolean;
  isReadByUser?: boolean;
}) {
  const id = crypto.randomUUID();
  const timestamp = params.createdAt ?? new Date();
  await client.query(
    `
    INSERT INTO customer_service_messages (
      id, customer_service_id, sender_type, sender_user_id, sender_admin_id,
      content, is_read_by_admin, is_read_by_user, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
    `,
    [
      id,
      params.inquiryId,
      params.senderType,
      params.senderUserId ?? null,
      params.senderAdminId ?? null,
      params.content,
      params.isReadByAdmin ?? false,
      params.isReadByUser ?? false,
      timestamp,
    ],
  );
  return id;
}

async function cleanupInquiry(inquiryId: string) {
  await client.query(
    'DELETE FROM customer_service_messages WHERE customer_service_id = $1',
    [inquiryId],
  );
  await client.query('DELETE FROM customer_services WHERE id = $1', [
    inquiryId,
  ]);
}

async function connectSocket(namespace: string, token: string) {
  const socket: Socket = io(`${API_BASE_URL}${namespace}`, {
    auth: { token },
    query: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  return socket;
}

test('GET /api/admin/inquiries 200: 상태 필터 + unreadCount', async () => {
  const admin = await createAdminUser(
    'inquiry_list@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('문의유저');
  const inquiryPending = await createInquiry(
    user.id,
    'PENDING',
    new Date(),
    '미답변',
  );
  const inquiryDone = await createInquiry(
    user.id,
    'COMPLETED',
    new Date(),
    '답변완료',
  );
  await createInquiryMessage({
    inquiryId: inquiryPending,
    senderType: 'USER',
    senderUserId: user.id,
    content: '안녕하세요',
    isReadByAdmin: false,
  });

  const res = await api.get('/api/admin/inquiries', {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    params: { status: 'PENDING', limit: 10, offset: 0 },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  const item = body.data.items.find(
    (row: { id: string }) => row.id === inquiryPending,
  );
  expect(item).toBeTruthy();
  expect(item.status).toBe('PENDING');
  expect(item.unreadCount).toBeGreaterThanOrEqual(1);

  await cleanupInquiry(inquiryPending);
  await cleanupInquiry(inquiryDone);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/inquiries 200: status=ALL 이면 필터 미적용', async () => {
  const admin = await createAdminUser(
    'inquiry_list_all@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('문의유저2');
  const inquiryPending = await createInquiry(
    user.id,
    'PENDING',
    new Date(),
    '미답변',
  );
  const inquiryDone = await createInquiry(
    user.id,
    'COMPLETED',
    new Date(),
    '답변완료',
  );

  const res = await api.get('/api/admin/inquiries', {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    params: { status: 'ALL', limit: 10, offset: 0 },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  const ids = body.data.items.map((row: { id: string }) => row.id);
  expect(ids).toContain(inquiryPending);
  expect(ids).toContain(inquiryDone);

  await cleanupInquiry(inquiryPending);
  await cleanupInquiry(inquiryDone);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('GET /api/admin/inquiries/:id 200: 페이지네이션', async () => {
  const admin = await createAdminUser(
    'inquiry_detail@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('상세유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');
  const base = new Date('2025-01-01T00:00:00.000Z');
  await createInquiryMessage({
    inquiryId,
    senderType: 'USER',
    senderUserId: user.id,
    content: '첫번째',
    createdAt: new Date(base.getTime() + 1000),
  });
  await createInquiryMessage({
    inquiryId,
    senderType: 'USER',
    senderUserId: user.id,
    content: '두번째',
    createdAt: new Date(base.getTime() + 2000),
  });
  await createInquiryMessage({
    inquiryId,
    senderType: 'USER',
    senderUserId: user.id,
    content: '세번째',
    createdAt: new Date(base.getTime() + 3000),
  });

  const res = await api.get(`/api/admin/inquiries/${inquiryId}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    params: { limit: 2, offset: 0 },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.total).toBe(3);
  expect(body.data.messages.length).toBe(2);
  expect(body.data.messages[0].content).toBe('세번째');

  const page2 = await api.get(`/api/admin/inquiries/${inquiryId}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    params: { limit: 2, offset: 2 },
  });
  const page2Body = await page2.json();
  expect(page2Body.data.messages.length).toBe(1);
  expect(page2Body.data.messages[0].content).toBe('첫번째');

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('PATCH /api/admin/inquiries/:id/status 200: 상태 변경', async () => {
  const admin = await createAdminUser(
    'inquiry_status@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('상태유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');

  const res = await api.patch(`/api/admin/inquiries/${inquiryId}/status`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    data: { status: 'COMPLETED' },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.status).toBe('COMPLETED');
  expect(body.data.isResolved).toBe(true);

  const dbRow = await client.query(
    'SELECT status, is_resolved FROM customer_services WHERE id = $1',
    [inquiryId],
  );
  expect(dbRow.rows[0].status).toBe('COMPLETED');

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('PUT /api/admin/inquiries/:id/messages/:messageId 200: 관리자 메시지 수정', async () => {
  const admin = await createAdminUser(
    'inquiry_update@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('수정유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');
  const messageId = await createInquiryMessage({
    inquiryId,
    senderType: 'ADMIN',
    senderAdminId: admin.id,
    content: '기존답변',
  });

  const res = await api.put(
    `/api/admin/inquiries/${inquiryId}/messages/${messageId}`,
    {
      headers: { Authorization: `Bearer ${login.accessToken}` },
      data: { content: '수정된답변' },
    },
  );

  expect(res.status()).toBe(200);
  const row = await client.query(
    'SELECT content FROM customer_service_messages WHERE id = $1',
    [messageId],
  );
  expect(row.rows[0].content).toBe('수정된답변');

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('DELETE /api/admin/inquiries/:id/messages/:messageId 200: 메시지 삭제', async () => {
  const admin = await createAdminUser(
    'inquiry_delete_msg@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('삭제유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');
  const messageId = await createInquiryMessage({
    inquiryId,
    senderType: 'USER',
    senderUserId: user.id,
    content: '삭제할 메시지',
  });

  const res = await api.delete(
    `/api/admin/inquiries/${inquiryId}/messages/${messageId}`,
    {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    },
  );

  expect(res.status()).toBe(200);
  const row = await client.query(
    'SELECT deleted_at FROM customer_service_messages WHERE id = $1',
    [messageId],
  );
  expect(row.rows[0].deleted_at).toBeTruthy();

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('DELETE /api/admin/inquiries/:id 200: 문의방 삭제', async () => {
  const admin = await createAdminUser(
    'inquiry_delete@example.com',
    'password1234',
  );
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('삭제방유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');
  await createInquiryMessage({
    inquiryId,
    senderType: 'USER',
    senderUserId: user.id,
    content: '삭제메시지',
  });

  const res = await api.delete(`/api/admin/inquiries/${inquiryId}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });

  expect(res.status()).toBe(200);
  const inquiryRow = await client.query(
    'SELECT deleted_at FROM customer_services WHERE id = $1',
    [inquiryId],
  );
  const messageRow = await client.query(
    'SELECT deleted_at FROM customer_service_messages WHERE customer_service_id = $1',
    [inquiryId],
  );
  expect(inquiryRow.rows[0].deleted_at).toBeTruthy();
  expect(messageRow.rows.length).toBeGreaterThan(0);
  expect(messageRow.rows[0].deleted_at).toBeTruthy();

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});

test('WebSocket: admin -> user 메시지 실시간 수신', async () => {
  const admin = await createAdminUser('inquiry_ws@example.com', 'password1234');
  const login = await loginAdmin(admin.email, 'password1234');
  expect(login.status).toBe(200);

  const user = await createUser('ws유저');
  const inquiryId = await createInquiry(user.id, 'PENDING');

  const adminSocket = await connectSocket('/admin-chat', login.accessToken);
  const userSocket = await connectSocket('/user-chat', user.token);

  const joinRoom = (socket: Socket, roomId: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit('join_room', { roomId }, (ack: { success?: boolean }) => {
        if (ack?.success) {
          resolve();
        } else {
          reject(new Error('join_room failed'));
        }
      });
    });

  await joinRoom(adminSocket, inquiryId);
  await joinRoom(userSocket, inquiryId);

  const received = new Promise<{ content: string }>((resolve) => {
    userSocket.on('receive_message', (payload: { content: string }) =>
      resolve(payload),
    );
  });

  adminSocket.emit('send_message', {
    roomId: inquiryId,
    content: '실시간메시지',
  });
  const payload = await received;
  expect(payload.content).toBe('실시간메시지');

  adminSocket.disconnect();
  userSocket.disconnect();

  await cleanupInquiry(inquiryId);
  await cleanupUser(user.id);
  await cleanupAdminUser(admin.id);
});
