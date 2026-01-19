import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 알림(Notifications) 테이블 생성 마이그레이션
 * 사용자에게 발송되는 알림 정보를 저장
 */
export class CreateNotificationsTable1736179200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. NotificationType Enum 생성
    await queryRunner.query(`
      CREATE TYPE notification_type_enum AS ENUM (
        'CAPSULE_OPEN',
        'FRIEND_REQUEST',
        'FRIEND_ACCEPTED',
        'SYSTEM',
        'MARKETING'
      )
    `);

    // 2. notifications 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
            comment: '알림 고유 ID',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
            comment: '알림 수신자',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: '알림 제목',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
            comment: '알림 내용',
          },
          {
            name: 'type',
            type: 'notification_type_enum',
            isNullable: false,
            comment:
              '알림 타입: CAPSULE_OPEN, FRIEND_REQUEST, FRIEND_ACCEPTED, SYSTEM, MARKETING',
          },
          {
            name: 'is_read',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: '읽음 여부',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: '알림 생성일',
          },
        ],
        foreignKeys: [
          {
            name: 'fk_notifications_user_id',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // 3. 인덱스 생성 (조회 성능 최적화)
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notifications_user_id_created_at',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notifications_user_id_is_read',
        columnNames: ['user_id', 'is_read'],
      }),
    );

    // 4. 테이블 코멘트 추가
    await queryRunner.query(`
      COMMENT ON TABLE notifications IS '사용자 알림 관리 테이블'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 인덱스 삭제
    await queryRunner.dropIndex(
      'notifications',
      'idx_notifications_user_id_is_read',
    );
    await queryRunner.dropIndex(
      'notifications',
      'idx_notifications_user_id_created_at',
    );

    // 2. 테이블 삭제
    await queryRunner.dropTable('notifications', true);

    // 3. Enum 타입 삭제
    await queryRunner.query(`DROP TYPE IF EXISTS notification_type_enum`);
  }
}
