import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTossPaymentFields1700000000000 implements MigrationInterface {
  name = 'AddTossPaymentFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 컬럼 추가: 이미 존재하면 건너뛰도록 방어
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'payment_key'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "payment_key" varchar(200);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'order_no'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "order_no" varchar(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'order_name'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "order_name" varchar(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'toss_status'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "toss_status" varchar(30);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'method'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "method" varchar(30);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'currency'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "currency" varchar(10) DEFAULT 'KRW';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'balance_amount'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "balance_amount" integer;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'supplied_amount'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "supplied_amount" integer;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'vat'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "vat" integer;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'tax_free_amount'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "tax_free_amount" integer;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'tax_exemption_amount'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "tax_exemption_amount" integer;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'requested_at'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "requested_at" timestamptz;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'receipt_url'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "receipt_url" varchar(200);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'last_transaction_key'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "last_transaction_key" varchar(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'easy_pay_provider'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "easy_pay_provider" varchar(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'card_meta'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "card_meta" jsonb;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'virtual_account'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "virtual_account" jsonb;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'fail_code'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "fail_code" varchar(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'fail_message'
        ) THEN
          ALTER TABLE "payments" ADD COLUMN "fail_message" varchar(510);
        END IF;
      END
      $$;
    `);

    // ensure unique payment_key (존재 시 추가 생략)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_payments_payment_key'
        ) THEN
          ALTER TABLE "payments"
          ADD CONSTRAINT "UQ_payments_payment_key" UNIQUE ("payment_key");
        END IF;
      END
      $$;
    `);

    // widen approved_at to timestamptz (이미 변환돼 있으면 건너뜀)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments'
            AND column_name = 'approved_at'
            AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE "payments"
          ALTER COLUMN "approved_at"
          TYPE timestamptz
          USING "approved_at"::timestamptz;
        END IF;
      END
      $$;
    `);

    // payment_cancels 테이블 생성 (없을 때만)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_cancels" (
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
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_cancels";`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_payments_payment_key'
        ) THEN
          ALTER TABLE "payments" DROP CONSTRAINT "UQ_payments_payment_key";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments'
            AND column_name = 'approved_at'
            AND data_type = 'timestamp with time zone'
        ) THEN
          ALTER TABLE "payments"
          ALTER COLUMN "approved_at"
          TYPE timestamp
          USING "approved_at"::timestamp;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'fail_message') THEN
          ALTER TABLE "payments" DROP COLUMN "fail_message";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'fail_code') THEN
          ALTER TABLE "payments" DROP COLUMN "fail_code";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'virtual_account') THEN
          ALTER TABLE "payments" DROP COLUMN "virtual_account";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_meta') THEN
          ALTER TABLE "payments" DROP COLUMN "card_meta";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'easy_pay_provider') THEN
          ALTER TABLE "payments" DROP COLUMN "easy_pay_provider";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'last_transaction_key') THEN
          ALTER TABLE "payments" DROP COLUMN "last_transaction_key";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'receipt_url') THEN
          ALTER TABLE "payments" DROP COLUMN "receipt_url";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'requested_at') THEN
          ALTER TABLE "payments" DROP COLUMN "requested_at";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'tax_exemption_amount') THEN
          ALTER TABLE "payments" DROP COLUMN "tax_exemption_amount";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'tax_free_amount') THEN
          ALTER TABLE "payments" DROP COLUMN "tax_free_amount";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'vat') THEN
          ALTER TABLE "payments" DROP COLUMN "vat";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'supplied_amount') THEN
          ALTER TABLE "payments" DROP COLUMN "supplied_amount";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'balance_amount') THEN
          ALTER TABLE "payments" DROP COLUMN "balance_amount";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'currency') THEN
          ALTER TABLE "payments" DROP COLUMN "currency";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'method') THEN
          ALTER TABLE "payments" DROP COLUMN "method";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'toss_status') THEN
          ALTER TABLE "payments" DROP COLUMN "toss_status";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'order_name') THEN
          ALTER TABLE "payments" DROP COLUMN "order_name";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'order_no') THEN
          ALTER TABLE "payments" DROP COLUMN "order_no";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_key') THEN
          ALTER TABLE "payments" DROP COLUMN "payment_key";
        END IF;
      END
      $$;
    `);
  }
}
