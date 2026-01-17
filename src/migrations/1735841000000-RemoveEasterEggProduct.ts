import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEasterEggProduct1735841000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_easter_eggs_product'
        ) THEN
          ALTER TABLE "easter_eggs" DROP CONSTRAINT "fk_easter_eggs_product";
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "easter_eggs"
      DROP COLUMN IF EXISTS "product_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "easter_eggs"
      ADD COLUMN IF NOT EXISTS "product_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "easter_eggs"
      ADD CONSTRAINT "fk_easter_eggs_product"
      FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      ON DELETE SET NULL
    `);
  }
}
