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
};

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'banny-banny-jwt-secret-key-2025';

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

/**
 * 테스트용 사용자 생성
 */
async function createUser(nickname = 'e2e-viewer-user') {
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
  return { id, token, nickname };
}

/**
 * 테스트용 캡슐 생성
 */
async function createCapsule(
  ownerId: string,
  lat = 37.5665,
  lng = 126.978,
  viewLimit = 10,
) {
  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, content, latitude, longitude, view_limit, view_count, open_at, is_locked, created_at)
    VALUES ($1, $2, 'e2e-capsule', 'test content', $3, $4, $5, 0, NOW() + INTERVAL '1 day', true, NOW())
    `,
    [capsuleId, ownerId, lat, lng, viewLimit],
  );
  return capsuleId;
}

/**
 * 테스트 후 정리
 */
async function cleanupUser(id: string) {
  await client.query('DELETE FROM capsule_access_logs WHERE viewer_id = $1', [
    id,
  ]);
  await client.query('DELETE FROM capsules WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

async function cleanupCapsule(id: string) {
  await client.query('DELETE FROM capsule_access_logs WHERE capsule_id = $1', [
    id,
  ]);
  await client.query('DELETE FROM capsules WHERE id = $1', [id]);
}

test.describe('POST /api/capsules/:id/viewers - 이스터에그 발견 기록', () => {
  test('첫 발견 시 is_first_view가 true이고 view_count가 증가한다', async () => {
    // given: 캡슐 생성
    const owner = await createUser('owner');
    const viewer = await createUser('viewer');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 발견 기록
      const response = await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // then: 201 Created
      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.is_first_view).toBe(true);
      expect(body.message).toContain('발견');

      // view_count가 증가했는지 확인
      const { rows } = await client.query(
        'SELECT view_count FROM capsules WHERE id = $1',
        [capsuleId],
      );
      expect(rows[0].view_count).toBe(1);

      // access_log가 생성되었는지 확인
      const { rows: logs } = await client.query(
        'SELECT * FROM capsule_access_logs WHERE capsule_id = $1 AND viewer_id = $2',
        [capsuleId, viewer.id],
      );
      expect(logs.length).toBe(1);
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('중복 발견 시 is_first_view가 false이고 view_count는 증가하지 않는다', async () => {
    // given: 캡슐 생성 및 첫 발견
    const owner = await createUser('owner');
    const viewer = await createUser('viewer');
    const capsuleId = await createCapsule(owner.id);

    try {
      // 첫 번째 발견
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // when: 두 번째 발견 (중복)
      const response = await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // then: 201 Created, is_first_view = false
      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.is_first_view).toBe(false);
      expect(body.message).toContain('이미');

      // view_count가 1로 유지되는지 확인
      const { rows } = await client.query(
        'SELECT view_count FROM capsules WHERE id = $1',
        [capsuleId],
      );
      expect(rows[0].view_count).toBe(1);
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('여러 사용자가 발견하면 각각 기록되고 view_count가 증가한다', async () => {
    // given: 캡슐 생성 및 3명의 사용자
    const owner = await createUser('owner');
    const viewer1 = await createUser('viewer1');
    const viewer2 = await createUser('viewer2');
    const viewer3 = await createUser('viewer3');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 3명이 순서대로 발견
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer1.token}` },
      });
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer2.token}` },
      });
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer3.token}` },
      });

      // then: view_count = 3
      const { rows } = await client.query(
        'SELECT view_count FROM capsules WHERE id = $1',
        [capsuleId],
      );
      expect(rows[0].view_count).toBe(3);

      // access_log가 3개 생성되었는지 확인
      const { rows: logs } = await client.query(
        'SELECT * FROM capsule_access_logs WHERE capsule_id = $1',
        [capsuleId],
      );
      expect(logs.length).toBe(3);
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer1.id);
      await cleanupUser(viewer2.id);
      await cleanupUser(viewer3.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('존재하지 않는 캡슐은 404를 반환한다', async () => {
    // given: 사용자만 생성
    const viewer = await createUser('viewer');
    const fakeId = crypto.randomUUID();

    try {
      // when: 존재하지 않는 캡슐 발견 시도
      const response = await api.post(`/api/capsules/${fakeId}/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // then: 404 Not Found
      expect(response.status()).toBe(404);
    } finally {
      await cleanupUser(viewer.id);
    }
  });

  test('삭제된 캡슐은 404를 반환한다', async () => {
    // given: 캡슐 생성 후 삭제
    const owner = await createUser('owner');
    const viewer = await createUser('viewer');
    const capsuleId = await createCapsule(owner.id);

    try {
      // 캡슐 soft delete
      await client.query(
        'UPDATE capsules SET deleted_at = NOW() WHERE id = $1',
        [capsuleId],
      );

      // when: 삭제된 캡슐 발견 시도
      const response = await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // then: 404 Not Found
      expect(response.status()).toBe(404);
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('인증 토큰이 없으면 401을 반환한다', async () => {
    // given: 캡슐만 생성
    const owner = await createUser('owner');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 토큰 없이 요청
      const response = await api.post(`/api/capsules/${capsuleId}/viewers`);

      // then: 401 Unauthorized
      expect(response.status()).toBe(401);
    } finally {
      await cleanupUser(owner.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('잘못된 UUID 형식은 400을 반환한다', async () => {
    // given: 사용자만 생성
    const viewer = await createUser('viewer');

    try {
      // when: 잘못된 UUID로 요청
      const response = await api.post(`/api/capsules/invalid-uuid/viewers`, {
        headers: {
          Authorization: `Bearer ${viewer.token}`,
        },
      });

      // then: 400 Bad Request
      expect(response.status()).toBe(400);
    } finally {
      await cleanupUser(viewer.id);
    }
  });

  test('작성자 본인도 자신의 캡슐을 발견 기록할 수 있다', async () => {
    // given: 캡슐 생성
    const owner = await createUser('owner');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 작성자가 자신의 캡슐 발견
      const response = await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: 201 Created
      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.is_first_view).toBe(true);
    } finally {
      await cleanupUser(owner.id);
      await cleanupCapsule(capsuleId);
    }
  });
});

test.describe('GET /api/capsules/:id/viewers - 이스터에그 발견자 목록 조회', () => {
  test('발견자 목록을 조회 시각 오름차순으로 반환한다', async () => {
    // given: 캡슐 생성 및 3명의 사용자가 순서대로 발견
    const owner = await createUser('owner');
    const viewer1 = await createUser('viewer1');
    const viewer2 = await createUser('viewer2');
    const viewer3 = await createUser('viewer3');
    const capsuleId = await createCapsule(owner.id);

    try {
      // 순서대로 발견
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer1.token}` },
      });
      await new Promise((resolve) => setTimeout(resolve, 100)); // 시간 차이 보장

      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer2.token}` },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer3.token}` },
      });

      // when: 발견자 목록 조회
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: 200 OK
      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.capsule_id).toBe(capsuleId);
      expect(body.total_viewers).toBe(3);
      expect(body.view_limit).toBe(10);
      expect(Array.isArray(body.viewers)).toBe(true);
      expect(body.viewers.length).toBe(3);

      // 조회 시각 오름차순 확인
      const viewedTimes = body.viewers.map((v) =>
        new Date(v.viewed_at).getTime(),
      );
      for (let i = 1; i < viewedTimes.length; i++) {
        expect(viewedTimes[i]).toBeGreaterThanOrEqual(viewedTimes[i - 1]);
      }

      // 각 발견자 정보 확인
      const viewer1Data = body.viewers.find((v) => v.id === viewer1.id);
      expect(viewer1Data).toBeTruthy();
      expect(viewer1Data.nickname).toBe('viewer1');
      expect(viewer1Data.viewed_at).toBeTruthy();
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer1.id);
      await cleanupUser(viewer2.id);
      await cleanupUser(viewer3.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('발견자가 없는 캡슐은 빈 배열을 반환한다', async () => {
    // given: 캡슐만 생성 (아무도 발견하지 않음)
    const owner = await createUser('owner');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 발견자 목록 조회
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: 200 OK, 빈 배열
      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.capsule_id).toBe(capsuleId);
      expect(body.total_viewers).toBe(0);
      expect(body.viewers).toEqual([]);
    } finally {
      await cleanupUser(owner.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('발견자 정보에 프로필 이미지가 포함된다', async () => {
    // given: 프로필 이미지가 있는 사용자 생성
    const owner = await createUser('owner');
    const viewer = await createUser('viewer');
    const capsuleId = await createCapsule(owner.id);

    // 프로필 이미지 추가
    await client.query(
      'UPDATE users SET profile_img = $1 WHERE id = $2',
      ['https://example.com/profile.jpg', viewer.id],
    );

    try {
      // 발견 기록
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer.token}` },
      });

      // when: 발견자 목록 조회
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: 프로필 이미지 포함
      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.viewers.length).toBe(1);
      expect(body.viewers[0].profile_img).toBe(
        'https://example.com/profile.jpg',
      );
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('존재하지 않는 캡슐은 404를 반환한다', async () => {
    // given: 사용자만 생성
    const user = await createUser('user');
    const fakeId = crypto.randomUUID();

    try {
      // when: 존재하지 않는 캡슐의 발견자 조회
      const response = await api.get(`/api/capsules/${fakeId}/viewers`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      // then: 404 Not Found
      expect(response.status()).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test('삭제된 캡슐은 404를 반환한다', async () => {
    // given: 캡슐 생성 후 삭제
    const owner = await createUser('owner');
    const capsuleId = await createCapsule(owner.id);

    try {
      await client.query(
        'UPDATE capsules SET deleted_at = NOW() WHERE id = $1',
        [capsuleId],
      );

      // when: 삭제된 캡슐의 발견자 조회
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: 404 Not Found
      expect(response.status()).toBe(404);
    } finally {
      await cleanupUser(owner.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('인증 토큰이 없으면 401을 반환한다', async () => {
    // given: 캡슐만 생성
    const owner = await createUser('owner');
    const capsuleId = await createCapsule(owner.id);

    try {
      // when: 토큰 없이 요청
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`);

      // then: 401 Unauthorized
      expect(response.status()).toBe(401);
    } finally {
      await cleanupUser(owner.id);
      await cleanupCapsule(capsuleId);
    }
  });

  test('잘못된 UUID 형식은 400을 반환한다', async () => {
    // given: 사용자만 생성
    const user = await createUser('user');

    try {
      // when: 잘못된 UUID로 요청
      const response = await api.get(`/api/capsules/invalid-uuid/viewers`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      // then: 400 Bad Request
      expect(response.status()).toBe(400);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test('view_limit과 total_viewers를 함께 반환한다', async () => {
    // given: view_limit이 5인 캡슐 생성 및 3명 발견
    const owner = await createUser('owner');
    const viewer1 = await createUser('viewer1');
    const viewer2 = await createUser('viewer2');
    const viewer3 = await createUser('viewer3');
    const capsuleId = await createCapsule(owner.id, 37.5665, 126.978, 5);

    try {
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer1.token}` },
      });
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer2.token}` },
      });
      await api.post(`/api/capsules/${capsuleId}/viewers`, {
        headers: { Authorization: `Bearer ${viewer3.token}` },
      });

      // when: 발견자 목록 조회
      const response = await api.get(`/api/capsules/${capsuleId}/viewers`, {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      });

      // then: view_limit = 5, total_viewers = 3
      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.view_limit).toBe(5);
      expect(body.total_viewers).toBe(3);
    } finally {
      await cleanupUser(owner.id);
      await cleanupUser(viewer1.id);
      await cleanupUser(viewer2.id);
      await cleanupUser(viewer3.id);
      await cleanupCapsule(capsuleId);
    }
  });
});

