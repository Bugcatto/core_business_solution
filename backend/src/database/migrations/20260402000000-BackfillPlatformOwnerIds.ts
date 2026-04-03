import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill: link pre-Sprint-1 businesses to platform_owners rows.
 *
 * Before Sprint 1 the platform_owners table didn't exist, so businesses
 * created during that period have platform_owner_id = NULL.
 *
 * Strategy:
 *   1. Insert a platform_owners row for every owner-user who doesn't have one yet
 *      (keyed on firebase_uid — idempotent via ON CONFLICT DO NOTHING).
 *   2. Set businesses.platform_owner_id where it is still NULL by joining
 *      through the owner_user_id → users → platform_owners chain.
 */
export class BackfillPlatformOwnerIds20260402000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Create platform_owners table if it doesn't exist yet
    //    (dev databases using synchronize=true may not have it if PlatformOwner
    //     entity was missing from DatabaseModule when the app first started)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_owners" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "firebase_uid" VARCHAR NOT NULL UNIQUE,
        "email"        VARCHAR NOT NULL UNIQUE,
        "display_name" VARCHAR,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 1 & 2. Backfill only if owner_user_id column exists on businesses
    //        (fresh dev databases using synchronize may not have it yet — nothing to backfill)
    const [{ exists }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'businesses' AND column_name = 'owner_user_id'
      ) AS exists
    `);

    if (exists) {
      await queryRunner.query(`
        INSERT INTO platform_owners (id, firebase_uid, email, created_at, updated_at)
        SELECT
          gen_random_uuid(),
          u.firebase_uid,
          u.email,
          NOW(),
          NOW()
        FROM businesses b
        JOIN users u ON u.id = b.owner_user_id
        WHERE b.platform_owner_id IS NULL
          AND u.firebase_uid IS NOT NULL
        ON CONFLICT (firebase_uid) DO NOTHING
      `);

      await queryRunner.query(`
        UPDATE businesses b
        SET    platform_owner_id = po.id
        FROM   users u
        JOIN   platform_owners po ON po.firebase_uid = u.firebase_uid
        WHERE  b.owner_user_id    = u.id
          AND  b.platform_owner_id IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NULL-out only the businesses whose platform_owner was created by this
    // migration.  Businesses onboarded through the normal Sprint-1 flow keep
    // their platform_owner_id intact.
    //
    // Heuristic: a platform_owner whose businesses all have status 'active'
    // and were created before Sprint 1 was introduced (2026-04-01) were
    // backfilled.  This is approximate — run down only in dev/test.
    await queryRunner.query(`
      UPDATE businesses
      SET    platform_owner_id = NULL
      WHERE  platform_owner_id IN (
        SELECT po.id
        FROM   platform_owners po
        WHERE  NOT EXISTS (
          SELECT 1 FROM businesses b2
          WHERE  b2.platform_owner_id = po.id
            AND  b2.created_at >= '2026-04-01'
        )
      )
    `);
  }
}
