import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 알림 타입 Enum 업데이트 마이그레이션
 * - EGG_DISCOVERED, EGG_DELETED 추가
 * - FRIEND_ADD 추가 (FRIEND_ACCEPTED는 유지)
 *
 * 참고: FRIEND_ACCEPTED, EASTER_EGG_VIEWED는 이미 AddPushNotificationSupport에서 추가됨
 */
export class UpdateNotificationTypeEnum1768046710742 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. EGG_DISCOVERED 추가
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'EGG_DISCOVERED'
    `);

    // 2. EGG_DELETED 추가
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'EGG_DELETED'
    `);

    // 3. FRIEND_ADD 추가 (FRIEND_ACCEPTED와 별도로 유지)
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FRIEND_ADD'
    `);

    // 4. 컬럼 comment 업데이트
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, FRIEND_ACCEPTED, EGG_DISCOVERED, EASTER_EGG_VIEWED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ENUM에서 값을 제거하려면 타입을 재생성해야 함

    // 1. 이전 버전의 enum 타입 생성 (EGG_DISCOVERED, EGG_DELETED, FRIEND_ADD 제외)
    await queryRunner.query(`
      CREATE TYPE notification_type_enum_old AS ENUM (
        'CAPSULE_OPEN',
        'FRIEND_REQUEST',
        'FRIEND_ACCEPTED',
        'EASTER_EGG_VIEWED',
        'SYSTEM',
        'MARKETING'
      )
    `);

    // 2. 데이터 변환 (EGG_* 타입을 SYSTEM으로, FRIEND_ADD를 FRIEND_ACCEPTED로 변환)
    await queryRunner.query(`
      ALTER TABLE notifications 
      ALTER COLUMN type TYPE notification_type_enum_old 
      USING (
        CASE 
          WHEN type IN ('EGG_DISCOVERED', 'EGG_DELETED') THEN 'SYSTEM'::notification_type_enum_old
          WHEN type = 'FRIEND_ADD' THEN 'FRIEND_ACCEPTED'::notification_type_enum_old
          ELSE type::text::notification_type_enum_old
        END
      )
    `);

    // 3. 기존 enum 타입 삭제
    await queryRunner.query(`DROP TYPE IF EXISTS notification_type_enum`);

    // 4. 새 enum 타입 이름 변경
    await queryRunner.query(`
      ALTER TYPE notification_type_enum_old RENAME TO notification_type_enum
    `);

    // 5. 컬럼 comment 복원
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, FRIEND_ACCEPTED, EGG_DISCOVERED, EASTER_EGG_VIEWED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }
}
