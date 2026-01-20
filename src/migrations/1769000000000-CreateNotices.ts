import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 공지사항(Notice) 테이블 생성 마이그레이션
 */
export class CreateNotices1769000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
            comment: '공지사항 ID',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '200',
            isNullable: false,
            comment: '공지 제목',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
            comment: '공지 본문',
          },
          {
            name: 'image_url',
            type: 'text',
            isNullable: true,
            comment: '공지 이미지 URL',
          },
          {
            name: 'is_pinned',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: '상단 고정 여부',
          },
          {
            name: 'is_visible',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: '노출 여부',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: '생성일',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: true,
            comment: '수정일',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            comment: '삭제일(soft delete)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notices',
      new TableIndex({
        name: 'idx_notices_is_pinned_created_at',
        columnNames: ['is_pinned', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'notices',
      new TableIndex({
        name: 'idx_notices_is_visible_created_at',
        columnNames: ['is_visible', 'created_at'],
      }),
    );

    await queryRunner.query(`COMMENT ON TABLE notices IS '공지사항 관리 테이블'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('notices', 'idx_notices_is_visible_created_at');
    await queryRunner.dropIndex('notices', 'idx_notices_is_pinned_created_at');
    await queryRunner.dropTable('notices', true);
  }
}
