import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessModules20260402000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_modules" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "businessId"   UUID NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "moduleCode"   VARCHAR NOT NULL,
        "status"       VARCHAR NOT NULL DEFAULT 'disabled',
        "enabledAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "trialEndsAt"  TIMESTAMPTZ,
        CONSTRAINT "uq_business_module" UNIQUE ("businessId", "moduleCode")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_business_modules_businessId"
      ON "business_modules" ("businessId");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_modules";`);
  }
}
