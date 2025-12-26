import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTossPaymentFields1700000000000 implements MigrationInterface {
  name = 'AddTossPaymentFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN "payment_key" varchar(200),
      ADD COLUMN "order_no" varchar(100),
      ADD COLUMN "order_name" varchar(100),
      ADD COLUMN "toss_status" varchar(30),
      ADD COLUMN "method" varchar(30),
      ADD COLUMN "currency" varchar(10) DEFAULT 'KRW',
      ADD COLUMN "balance_amount" integer,
      ADD COLUMN "supplied_amount" integer,
      ADD COLUMN "vat" integer,
      ADD COLUMN "tax_free_amount" integer,
      ADD COLUMN "tax_exemption_amount" integer,
      ADD COLUMN "requested_at" timestamptz,
      ADD COLUMN "receipt_url" varchar(200),
      ADD COLUMN "last_transaction_key" varchar(100),
      ADD COLUMN "easy_pay_provider" varchar(50),
      ADD COLUMN "card_meta" jsonb,
      ADD COLUMN "virtual_account" jsonb,
      ADD COLUMN "fail_code" varchar(100),
      ADD COLUMN "fail_message" varchar(510);
    `);

    // ensure unique payment_key
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD CONSTRAINT "UQ_payments_payment_key" UNIQUE ("payment_key");
    `);

    // widen approved_at to timestamptz
    await queryRunner.query(`
      ALTER TABLE "payments"
      ALTER COLUMN "approved_at"
      TYPE timestamptz
      USING "approved_at"::timestamptz;
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_cancels" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "payment_id" uuid NOT NULL,
        "transaction_key" varchar(100) NOT NULL,
        "cancel_amount" integer NOT NULL,
        "cancel_reason" varchar(200),
        "cancel_status" varchar(30),
        "canceled_at" timestamptz,
        "tax_free_amount" integer,
        "tax_exemption_amount" integer,
        "refundable_amount" integer,
        "easy_pay_discount_amount" integer,
        "transfer_discount_amount" integer,
        "receipt_key" varchar(200),
        "raw_response" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_cancels_transaction_key" UNIQUE ("transaction_key"),
        CONSTRAINT "FK_payment_cancels_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "payment_cancels";
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP CONSTRAINT "UQ_payments_payment_key";
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      ALTER COLUMN "approved_at"
      TYPE timestamp
      USING "approved_at"::timestamp;
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN "fail_message",
      DROP COLUMN "fail_code",
      DROP COLUMN "virtual_account",
      DROP COLUMN "card_meta",
      DROP COLUMN "easy_pay_provider",
      DROP COLUMN "last_transaction_key",
      DROP COLUMN "receipt_url",
      DROP COLUMN "requested_at",
      DROP COLUMN "tax_exemption_amount",
      DROP COLUMN "tax_free_amount",
      DROP COLUMN "vat",
      DROP COLUMN "supplied_amount",
      DROP COLUMN "balance_amount",
      DROP COLUMN "currency",
      DROP COLUMN "method",
      DROP COLUMN "toss_status",
      DROP COLUMN "order_name",
      DROP COLUMN "order_no",
      DROP COLUMN "payment_key";
    `);
  }
}
