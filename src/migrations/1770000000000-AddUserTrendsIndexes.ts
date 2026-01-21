import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * users 테이블에 created_at, deleted_at 인덱스 추가
 * user-trends API 성능 최적화를 위한 인덱스
 */
export class AddUserTrendsIndexes1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // created_at 인덱스: 가입 추이 조회 성능 향상
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_created_at',
        columnNames: ['created_at'],
      }),
    );

    // deleted_at 부분 인덱스: 탈퇴 추이 조회 성능 향상 (NULL이 아닌 값만 인덱싱)
    await queryRunner.query(`
      CREATE INDEX idx_users_deleted_at 
      ON users(deleted_at) 
      WHERE deleted_at IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 부분 인덱스는 queryRunner.query로 삭제
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_deleted_at;`);
    await queryRunner.dropIndex('users', 'idx_users_created_at');
  }
}
