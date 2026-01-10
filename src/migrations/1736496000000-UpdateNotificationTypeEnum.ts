import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 알림 타입 Enum 업데이트 마이그레이션
 * - FRIEND_REQUEST, FRIEND_ACCEPTED → FRIEND_ADD로 통합
 * - EGG_DISCOVERED, EGG_DELETED 신규 추가
 */
export class UpdateNotificationTypeEnum1736496000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 기존 데이터 마이그레이션 (FRIEND_REQUEST, FRIEND_ACCEPTED → FRIEND_ADD)
    await queryRunner.query(`
      UPDATE notifications 
      SET type = 'FRIEND_ADD' 
      WHERE type IN ('FRIEND_REQUEST', 'FRIEND_ACCEPTED')
    `);

    // 2. 새 enum 타입 생성 (임시)
    await queryRunner.query(`
      CREATE TYPE notification_type_enum_new AS ENUM (
        'CAPSULE_OPEN',
        'FRIEND_ADD',
        'EGG_DISCOVERED',
        'EGG_DELETED',
        'SYSTEM',
        'MARKETING'
      )
    `);

    // 3. 기존 컬럼 타입 변경
    await queryRunner.query(`
      ALTER TABLE notifications 
      ALTER COLUMN type TYPE notification_type_enum_new 
      USING type::text::notification_type_enum_new
    `);

    // 4. 기존 enum 타입 삭제
    await queryRunner.query(`DROP TYPE notification_type_enum`);

    // 5. 새 enum 타입 이름 변경
    await queryRunner.query(`
      ALTER TYPE notification_type_enum_new RENAME TO notification_type_enum
    `);

    // 6. 컬럼 comment 업데이트
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, EGG_DISCOVERED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 새 enum 타입 생성 (이전 버전)
    await queryRunner.query(`
      CREATE TYPE notification_type_enum_old AS ENUM (
        'CAPSULE_OPEN',
        'FRIEND_REQUEST',
        'FRIEND_ACCEPTED',
        'SYSTEM',
        'MARKETING'
      )
    `);

    // 2. 기존 컬럼 타입 변경 (FRIEND_ADD → FRIEND_REQUEST로 기본 변환)
    await queryRunner.query(`
      ALTER TABLE notifications 
      ALTER COLUMN type TYPE notification_type_enum_old 
      USING (
        CASE 
          WHEN type = 'FRIEND_ADD' THEN 'FRIEND_REQUEST'::notification_type_enum_old
          WHEN type IN ('EGG_DISCOVERED', 'EGG_DELETED') THEN 'SYSTEM'::notification_type_enum_old
          ELSE type::text::notification_type_enum_old
        END
      )
    `);

    // 3. 기존 enum 타입 삭제
    await queryRunner.query(`DROP TYPE notification_type_enum`);

    // 4. 새 enum 타입 이름 변경
    await queryRunner.query(`
      ALTER TYPE notification_type_enum_old RENAME TO notification_type_enum
    `);

    // 5. 컬럼 comment 복원
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_REQUEST, FRIEND_ACCEPTED, SYSTEM, MARKETING'
    `);
  }
}
