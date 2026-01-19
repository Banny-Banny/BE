import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCapsuleTitleToOrders1735808404000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'capsule_title',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: '생성할 타임캡슐 제목',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'capsule_title');
  }
}
