import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 핫픽스: EASTER_EGG_VIEWED enum 값 추가
 * 배포 환경에서 누락된 enum 값을 추가하는 핫픽스 마이그레이션
 */
export class HotfixEasterEggViewedEnum1736571600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // EASTER_EGG_VIEWED enum 값이 없으면 추가
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'notification_type_enum' 
          AND e.enumlabel = 'EASTER_EGG_VIEWED'
        ) THEN
          ALTER TYPE notification_type_enum ADD VALUE 'EASTER_EGG_VIEWED';
        END IF;
      END $$;
    `);

    // EGG_DISCOVERED enum 값이 없으면 추가 (필요할 수 있음)
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'notification_type_enum' 
          AND e.enumlabel = 'EGG_DISCOVERED'
        ) THEN
          ALTER TYPE notification_type_enum ADD VALUE 'EGG_DISCOVERED';
        END IF;
      END $$;
    `);

    // EGG_DELETED enum 값이 없으면 추가 (필요할 수 있음)
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'notification_type_enum' 
          AND e.enumlabel = 'EGG_DELETED'
        ) THEN
          ALTER TYPE notification_type_enum ADD VALUE 'EGG_DELETED';
        END IF;
      END $$;
    `);

    // FRIEND_ADD enum 값이 없으면 추가 (필요할 수 있음)
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'notification_type_enum' 
          AND e.enumlabel = 'FRIEND_ADD'
        ) THEN
          ALTER TYPE notification_type_enum ADD VALUE 'FRIEND_ADD';
        END IF;
      END $$;
    `);

    // 컬럼 comment 업데이트
    await queryRunner.query(`
      COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_ADD, FRIEND_ACCEPTED, EGG_DISCOVERED, EASTER_EGG_VIEWED, EGG_DELETED, SYSTEM, MARKETING'
    `);
  }

  public down(): Promise<void> {
    // enum 값 제거는 복잡하므로 down 마이그레이션은 생략
    // 필요시 enum 타입 재생성 필요
    console.warn(
      '[Migration] 이 마이그레이션의 rollback은 지원되지 않습니다. enum 값은 수동으로 제거해야 합니다.',
    );
    return Promise.resolve();
  }
}
