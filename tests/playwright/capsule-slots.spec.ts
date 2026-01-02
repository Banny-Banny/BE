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
 * @param eggSlots 초기 슬롯 개수 (기본 3개)
 */
async function createUser(eggSlots = 3) {
  const id = crypto.randomUUID();
  const phone = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  await client.query(
    `
    INSERT INTO users (id, nickname, phone_number, provider, egg_slots)
    VALUES ($1, $2, $3, 'LOCAL', $4)
    `,
    [id, 'e2e-slot-user', phone, eggSlots],
  );
  const token = jwt.sign({ sub: id, nickname: 'e2e-slot-user' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id, token };
}

/**
 * 테스트용 캡슐 생성 (슬롯 소비용)
 */
async function createCapsule(userId: string) {
  const capsuleId = crypto.randomUUID();
  await client.query(
    `
    INSERT INTO capsules (id, user_id, title, latitude, longitude, view_limit, created_at)
    VALUES ($1, $2, 'e2e-capsule', 37.5665, 126.9780, 0, NOW())
    `,
    [capsuleId, userId],
  );
  return capsuleId;
}

/**
 * 테스트 후 정리
 */
async function cleanupUser(id: string) {
  await client.query('DELETE FROM capsules WHERE user_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

test.describe('GET /api/capsules/slots - 남은 캡슐 슬롯 조회', () => {
  test('인증된 사용자는 슬롯 정보를 조회할 수 있다', async () => {
    // given: 슬롯 10개를 가진 사용자 생성
    const { id: userId, token } = await createUser(10);

    try {
      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: 200 OK 및 올바른 데이터 구조
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('totalSlots');
      expect(body).toHaveProperty('usedSlots');
      expect(body).toHaveProperty('remainingSlots');

      // totalSlots는 항상 3으로 고정
      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(0);
      // remainingSlots는 user.eggSlots 값 (10)
      expect(body.remainingSlots).toBe(10);

      // 모든 값이 number 타입인지 확인
      expect(typeof body.totalSlots).toBe('number');
      expect(typeof body.usedSlots).toBe('number');
      expect(typeof body.remainingSlots).toBe('number');
    } finally {
      await cleanupUser(userId);
    }
  });

  test('캡슐을 생성하면 usedSlots가 증가한다', async () => {
    // given: 슬롯 10개를 가진 사용자 생성 및 캡슐 5개 생성
    const { id: userId, token } = await createUser(10);

    try {
      // 캡슐 5개 생성 (eggSlots가 10 -> 5로 감소)
      for (let i = 0; i < 5; i++) {
        await createCapsule(userId);
        // eggSlots 차감은 API에서 처리하므로 수동으로 차감
        await client.query(
          'UPDATE users SET egg_slots = egg_slots - 1 WHERE id = $1',
          [userId],
        );
      }

      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (고정), usedSlots = 5, remainingSlots = 5
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(5);
      expect(body.remainingSlots).toBe(5);
    } finally {
      await cleanupUser(userId);
    }
  });

  test('슬롯을 모두 소진하면 remainingSlots가 0이 된다', async () => {
    // given: 슬롯 3개를 가진 사용자 생성 및 캡슐 3개 생성
    const { id: userId, token } = await createUser(3);

    try {
      // 캡슐 3개 생성 (모든 슬롯 소진)
      for (let i = 0; i < 3; i++) {
        await createCapsule(userId);
        await client.query(
          'UPDATE users SET egg_slots = egg_slots - 1 WHERE id = $1',
          [userId],
        );
      }

      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (고정), usedSlots = 3, remainingSlots = 0
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(3);
      expect(body.remainingSlots).toBe(0);
    } finally {
      await cleanupUser(userId);
    }
  });

  test('슬롯을 전혀 사용하지 않은 경우 usedSlots가 0이다', async () => {
    // given: 슬롯 10개를 가진 사용자 생성 (캡슐 생성하지 않음)
    const { id: userId, token } = await createUser(10);

    try {
      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (고정), usedSlots = 0, remainingSlots = 10
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(0);
      expect(body.remainingSlots).toBe(10);
    } finally {
      await cleanupUser(userId);
    }
  });

  test('추가 슬롯을 보유한 사용자는 정확한 슬롯 정보를 조회할 수 있다', async () => {
    // given: 슬롯 15개를 가진 사용자 생성 및 캡슐 8개 생성
    const { id: userId, token } = await createUser(15);

    try {
      // 캡슐 8개 생성
      for (let i = 0; i < 8; i++) {
        await createCapsule(userId);
        await client.query(
          'UPDATE users SET egg_slots = egg_slots - 1 WHERE id = $1',
          [userId],
        );
      }

      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (고정), usedSlots = 8, remainingSlots = 7
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(8);
      expect(body.remainingSlots).toBe(7);
    } finally {
      await cleanupUser(userId);
    }
  });

  test('삭제된 캡슐은 usedSlots에 포함되지 않는다', async () => {
    // given: 슬롯 10개를 가진 사용자 생성 및 캡슐 3개 생성
    const { id: userId, token } = await createUser(10);

    try {
      const capsuleIds = [];
      for (let i = 0; i < 3; i++) {
        capsuleIds.push(await createCapsule(userId));
        await client.query(
          'UPDATE users SET egg_slots = egg_slots - 1 WHERE id = $1',
          [userId],
        );
      }

      // 캡슐 1개 soft delete
      const deleteId = capsuleIds[0] as string;
      await client.query(
        'UPDATE capsules SET deleted_at = NOW() WHERE id = $1',
        [deleteId],
      );

      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (고정), usedSlots = 2 (삭제된 1개 제외), remainingSlots = 7
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(2); // 3개 생성했지만 1개 삭제됨
      expect(body.remainingSlots).toBe(7); // 10 - 3 = 7
    } finally {
      await cleanupUser(userId);
    }
  });

  test('인증 토큰이 없으면 401 에러를 반환한다', async () => {
    // when: 토큰 없이 요청
    const response = await api.get('/api/capsules/slots');

    // then: 401 Unauthorized
    expect(response.status()).toBe(401);
  });

  test('유효하지 않은 토큰으로 요청하면 401 에러를 반환한다', async () => {
    // when: 잘못된 토큰으로 요청
    const response = await api.get('/api/capsules/slots', {
      headers: {
        Authorization: 'Bearer invalid-token-123',
      },
    });

    // then: 401 Unauthorized
    expect(response.status()).toBe(401);
  });

  test('만료된 토큰으로 요청하면 401 에러를 반환한다', async () => {
    // given: 만료된 토큰 생성
    const expiredToken = jwt.sign(
      { sub: crypto.randomUUID(), nickname: 'expired-user' },
      JWT_SECRET,
      { expiresIn: '-1h' }, // 1시간 전에 만료
    );

    // when: 만료된 토큰으로 요청
    const response = await api.get('/api/capsules/slots', {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    // then: 401 Unauthorized
    expect(response.status()).toBe(401);
  });

  test('존재하지 않는 사용자의 토큰으로 요청하면 401 에러를 반환한다', async () => {
    // given: 존재하지 않는 사용자 ID로 토큰 생성
    const nonExistentUserId = crypto.randomUUID();
    const token = jwt.sign(
      { sub: nonExistentUserId, nickname: 'ghost-user' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // when: 존재하지 않는 사용자 토큰으로 요청
    const response = await api.get('/api/capsules/slots', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // then: 401 Unauthorized (JWT Guard에서 사용자 검증 실패)
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toContain('유효하지 않은 토큰');
  });

  test('기본 슬롯 개수는 3개이다', async () => {
    // given: 명시적으로 슬롯을 지정하지 않은 사용자 생성
    const { id: userId, token } = await createUser(); // 기본값 3

    try {
      // when: 슬롯 정보 조회
      const response = await api.get('/api/capsules/slots', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // then: totalSlots = 3 (기본값)
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.totalSlots).toBe(3);
      expect(body.usedSlots).toBe(0);
      expect(body.remainingSlots).toBe(3);
    } finally {
      await cleanupUser(userId);
    }
  });

  test('동시에 여러 요청을 보내도 정확한 결과를 반환한다', async () => {
    // given: 슬롯 10개를 가진 사용자 생성 및 캡슐 5개 생성
    const { id: userId, token } = await createUser(10);

    try {
      for (let i = 0; i < 5; i++) {
        await createCapsule(userId);
        await client.query(
          'UPDATE users SET egg_slots = egg_slots - 1 WHERE id = $1',
          [userId],
        );
      }

      // when: 동시에 3번 요청
      const promises = [
        api.get('/api/capsules/slots', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get('/api/capsules/slots', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get('/api/capsules/slots', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ];

      const responses = await Promise.all(promises);

      // then: 모든 요청이 동일한 결과를 반환
      for (const response of responses) {
        expect(response.ok()).toBeTruthy();
        const body = await response.json();

        expect(body.totalSlots).toBe(3);
        expect(body.usedSlots).toBe(5);
        expect(body.remainingSlots).toBe(5);
      }
    } finally {
      await cleanupUser(userId);
    }
  });
});
