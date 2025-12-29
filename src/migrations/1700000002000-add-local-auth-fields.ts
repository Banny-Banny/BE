import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocalAuthFields1700000002000 implements MigrationInterface {
  name = 'AddLocalAuthFields1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'password_hash',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: '로컬 회원가입용 bcrypt 해시',
      }),
    );
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'token_version',
        type: 'int',
        default: '0',
        comment: '로그아웃/토큰 무효화를 위한 버전',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'token_version');
    await queryRunner.dropColumn('users', 'password_hash');
  }
}

