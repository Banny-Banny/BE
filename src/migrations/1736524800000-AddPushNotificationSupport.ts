import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 푸시 알림 지원 마이그레이션
 * - users 테이블에 push_token 컬럼 추가
 * - notification_type_enum에 FRIEND_ACCEPTED, EASTER_EGG_VIEWED 추가
 */
export class AddPushNotificationSupport1736524800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. users 테이블에 push_token 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN push_token VARCHAR(255) NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN users.push_token IS 'Expo Push 알림 토큰'
    `);

    // 2. 기존 notification_type_enum에 새로운 타입 추가
    // PostgreSQL enum에 값을 추가하는 방법
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED'
    `);

    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'EASTER_EGG_VIEWED'
    `);

    // 3. 컬럼 comment 업데이트
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, FRIEND_ACCEPTED, EGG_DISCOVERED, EASTER_EGG_VIEWED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. push_token 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN push_token
    `);

    // 2. enum 값 제거는 PostgreSQL에서 직접 지원하지 않으므로 전체 재생성 필요
    // 먼저 FRIEND_ACCEPTED, EASTER_EGG_VIEWED 타입 사용하는 데이터를 다른 타입으로 변환
    await queryRunner.query(`
      UPDATE notifications 
      SET type = 'FRIEND_ADD' 
      WHERE type = 'FRIEND_ACCEPTED'
    `);

    await queryRunner.query(`
      UPDATE notifications 
      SET type = 'EGG_DISCOVERED' 
      WHERE type = 'EASTER_EGG_VIEWED'
    `);

    // 3. 새 enum 타입 생성 (FRIEND_ACCEPTED, EASTER_EGG_VIEWED 제외)
    await queryRunner.query(`
      CREATE TYPE notification_type_enum_old AS ENUM (
        'CAPSULE_OPEN',
        'FRIEND_ADD',
        'EGG_DISCOVERED',
        'EGG_DELETED',
        'SYSTEM',
        'MARKETING'
      )
    `);

    // 4. 기존 컬럼 타입 변경
    await queryRunner.query(`
      ALTER TABLE notifications 
      ALTER COLUMN type TYPE notification_type_enum_old 
      USING type::text::notification_type_enum_old
    `);

    // 5. 기존 enum 타입 삭제
    await queryRunner.query(`DROP TYPE notification_type_enum`);

    // 6. 새 enum 타입 이름 변경
    await queryRunner.query(`
      ALTER TYPE notification_type_enum_old RENAME TO notification_type_enum
    `);

    // 7. 컬럼 comment 복원
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, EGG_DISCOVERED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }
}
