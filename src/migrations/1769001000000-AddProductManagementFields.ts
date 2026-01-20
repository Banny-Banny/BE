import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * 상품 관리용 컬럼 확장 (썸네일/카테고리/수정일/삭제일)
 */
export class AddProductManagementFields1769001000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('products', [
      new TableColumn({
        name: 'thumbnail_url',
        type: 'text',
        isNullable: true,
        comment: '상품 썸네일 URL',
      }),
      new TableColumn({
        name: 'category_id',
        type: 'uuid',
        isNullable: true,
        comment: '상품 카테고리 ID',
      }),
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp',
        isNullable: true,
        comment: '수정일',
      }),
      new TableColumn({
        name: 'deleted_at',
        type: 'timestamp',
        isNullable: true,
        comment: '삭제일(soft delete)',
      }),
    ]);

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'idx_products_category_id',
        columnNames: ['category_id'],
      }),
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'idx_products_is_active',
        columnNames: ['is_active'],
      }),
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'idx_products_deleted_at',
        columnNames: ['deleted_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('products', 'idx_products_deleted_at');
    await queryRunner.dropIndex('products', 'idx_products_is_active');
    await queryRunner.dropIndex('products', 'idx_products_category_id');

    await queryRunner.dropColumns('products', [
      'thumbnail_url',
      'category_id',
      'updated_at',
      'deleted_at',
    ]);
  }
}
