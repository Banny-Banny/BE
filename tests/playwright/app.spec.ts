import { test, expect, request, APIRequestContext } from '@playwright/test';

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  });
});

test.afterAll(async () => {
  await api.dispose();
});

test('헬스 체크 /', async () => {
  const res = await api.get('/api');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Hello World');
});

