import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessIdToPosTerminals20260331000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pos_terminals
        ADD COLUMN business_id UUID NOT NULL REFERENCES businesses(id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_pos_terminals_business ON pos_terminals(business_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pos_terminals_business
    `);

    await queryRunner.query(`
      ALTER TABLE pos_terminals DROP COLUMN business_id
    `);
  }
}
