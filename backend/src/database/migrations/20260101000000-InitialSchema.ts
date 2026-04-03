import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration — captures the full schema as of 2026-04-03.
 *
 * On a fresh database this migration is run first (timestamp 20260101000000),
 * followed by the incremental patch migrations which use IF NOT EXISTS guards
 * and are therefore safe no-ops when the schema already exists.
 *
 * On the original dev database this record is inserted directly into the
 * migrations table without executing up(), because synchronize:true already
 * built the schema before migrations were introduced.
 */
export class InitialSchema20260101000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public`);

    // Enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE public.onboarding_progress_currentstep_enum AS ENUM (
          'signup', 'business_created', 'type_selected', 'plan_selected',
          'provisioned', 'wizard_complete', 'live'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── Core tables (no FK deps) ──────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.platform_owners (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        email        VARCHAR     NOT NULL UNIQUE,
        "firebaseUid" VARCHAR    NOT NULL UNIQUE,
        "displayName" VARCHAR,
        "createdAt"  TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.businesses (
        id                  UUID         PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        name                VARCHAR      NOT NULL,
        slug                VARCHAR      NOT NULL UNIQUE,
        "businessType"      VARCHAR(20)  NOT NULL,
        "subscriptionPlan"  VARCHAR(20)  NOT NULL DEFAULT 'free',
        status              VARCHAR(20)  NOT NULL DEFAULT 'onboarding',
        "ownerUserId"       VARCHAR,
        "defaultLanguage"   VARCHAR      NOT NULL DEFAULT 'en',
        country             VARCHAR,
        currency            VARCHAR,
        phone               VARCHAR,
        address             VARCHAR,
        "logoUrl"           VARCHAR,
        "platformOwnerId"   VARCHAR,
        "createdAt"         TIMESTAMP    NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.permissions (
        id          UUID    PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        code        VARCHAR NOT NULL UNIQUE,
        module      VARCHAR NOT NULL,
        description VARCHAR
      )
    `);

    // ── Tables that depend on businesses ─────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.branches (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId" UUID      NOT NULL REFERENCES public.businesses(id),
        name         VARCHAR   NOT NULL,
        address      VARCHAR,
        timezone     VARCHAR   NOT NULL DEFAULT 'UTC',
        phone        VARCHAR,
        "isActive"   BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id                  UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"        UUID        NOT NULL REFERENCES public.businesses(id),
        "firebaseUid"       VARCHAR     NOT NULL UNIQUE,
        email               VARCHAR     NOT NULL,
        "displayName"       VARCHAR,
        "createdBy"         VARCHAR,
        "inviteStatus"      VARCHAR(20) NOT NULL DEFAULT 'active',
        "inviteToken"       VARCHAR,
        "inviteExpiresAt"   TIMESTAMPTZ,
        "preferredLanguage" VARCHAR     NOT NULL DEFAULT 'en',
        "isActive"          BOOLEAN     NOT NULL DEFAULT true,
        "createdAt"         TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.pos_terminals (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        business_id  UUID      NOT NULL REFERENCES public.businesses(id),
        "branchId"   VARCHAR   NOT NULL,
        name         VARCHAR   NOT NULL,
        "deviceType" VARCHAR   NOT NULL DEFAULT 'web',
        "isActive"   BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.business_modules (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "businessId" UUID        NOT NULL REFERENCES public.businesses(id),
        "moduleCode" VARCHAR     NOT NULL,
        status       VARCHAR     NOT NULL DEFAULT 'disabled',
        "trialEndsAt" TIMESTAMPTZ,
        "enabledAt"  TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "IDX_4798a94ac5c770b6a35b3fb541" UNIQUE ("businessId", "moduleCode")
      )
    `);

    // ── RBAC ──────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.roles (
        id             UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"   VARCHAR   NOT NULL,
        name           VARCHAR   NOT NULL,
        description    VARCHAR,
        "isSystemRole" BOOLEAN   NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.role_permissions (
        id             UUID    PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "roleId"       VARCHAR NOT NULL,
        "permissionId" VARCHAR NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.user_roles (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "userId"     VARCHAR   NOT NULL,
        "roleId"     VARCHAR   NOT NULL,
        "branchId"   VARCHAR,
        "assignedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.user_branches (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "userId"     VARCHAR   NOT NULL,
        "branchId"   VARCHAR   NOT NULL,
        "assignedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ── Onboarding & settings ─────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.onboarding_progress (
        id                    UUID                                           PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"          VARCHAR                                        NOT NULL UNIQUE,
        "currentStep"         public.onboarding_progress_currentstep_enum   NOT NULL DEFAULT 'signup',
        "hasAddedItems"       BOOLEAN NOT NULL DEFAULT false,
        "hasAddedStaff"       BOOLEAN NOT NULL DEFAULT false,
        "hasConfiguredReceipt" BOOLEAN NOT NULL DEFAULT false,
        "hasSetBranchDetails" BOOLEAN NOT NULL DEFAULT false,
        "hasAddedOpeningStock" BOOLEAN NOT NULL DEFAULT false,
        "hasTestedTransaction" BOOLEAN NOT NULL DEFAULT false,
        metadata              JSONB,
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId" VARCHAR   NOT NULL,
        "branchId"   VARCHAR,
        key          VARCHAR   NOT NULL,
        value        TEXT      NOT NULL,
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ── HR ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.employees (
        id               UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"     VARCHAR     NOT NULL,
        "branchId"       VARCHAR     NOT NULL,
        "userId"         VARCHAR,
        "firstName"      VARCHAR     NOT NULL,
        "lastName"       VARCHAR     NOT NULL,
        "employeeCode"   VARCHAR     UNIQUE,
        "position"       VARCHAR,
        phone            VARCHAR,
        status           VARCHAR(20) NOT NULL DEFAULT 'active',
        "hireDate"       DATE,
        "terminationDate" DATE,
        "createdAt"      TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    // ── Catalog ───────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.categories (
        id           UUID      PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId" VARCHAR   NOT NULL,
        "parentId"   VARCHAR,
        name         VARCHAR   NOT NULL,
        description  VARCHAR,
        "isActive"   BOOLEAN   NOT NULL DEFAULT true,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.items (
        id              UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"    VARCHAR     NOT NULL,
        "categoryId"    VARCHAR,
        name            VARCHAR     NOT NULL,
        description     VARCHAR,
        sku             VARCHAR,
        barcode         VARCHAR,
        "itemType"      VARCHAR(20) NOT NULL DEFAULT 'product',
        price           NUMERIC(12,2) NOT NULL,
        unit            VARCHAR     NOT NULL DEFAULT 'pcs',
        "trackInventory" BOOLEAN   NOT NULL DEFAULT true,
        "imageUrl"      VARCHAR,
        "isActive"      BOOLEAN     NOT NULL DEFAULT true,
        "createdAt"     TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.item_variants (
        id              UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "itemId"        UUID          NOT NULL REFERENCES public.items(id),
        name            VARCHAR       NOT NULL,
        sku             VARCHAR,
        barcode         VARCHAR,
        "priceOverride" NUMERIC(12,2),
        "isActive"      BOOLEAN       NOT NULL DEFAULT true,
        "createdAt"     TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    // ── Inventory ─────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.inventory (
        id                 UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "branchId"         VARCHAR       NOT NULL,
        "itemId"           VARCHAR       NOT NULL,
        "variantId"        VARCHAR,
        quantity           NUMERIC(12,3) NOT NULL DEFAULT 0,
        "reservedQuantity" NUMERIC(12,3) NOT NULL DEFAULT 0,
        "reorderLevel"     NUMERIC(12,3) NOT NULL DEFAULT 0,
        "lastMovementAt"   TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_movements (
        id               UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"     VARCHAR       NOT NULL,
        "branchId"       VARCHAR       NOT NULL,
        "itemId"         VARCHAR       NOT NULL,
        "variantId"      VARCHAR,
        "movementType"   VARCHAR(30)   NOT NULL,
        direction        VARCHAR(3)    NOT NULL,
        quantity         NUMERIC(12,3) NOT NULL,
        "quantityBefore" NUMERIC(12,3) NOT NULL,
        "quantityAfter"  NUMERIC(12,3) NOT NULL,
        "referenceType"  VARCHAR,
        "referenceId"    VARCHAR,
        "transferPairId" VARCHAR,
        status           VARCHAR(20)   NOT NULL DEFAULT 'approved',
        reason           VARCHAR,
        notes            VARCHAR,
        "approvedBy"     VARCHAR,
        "approvedAt"     TIMESTAMPTZ,
        "createdBy"      VARCHAR       NOT NULL,
        "createdAt"      TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
        id            UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"  VARCHAR     NOT NULL,
        "branchId"    VARCHAR     NOT NULL,
        "reasonCode"  VARCHAR     NOT NULL,
        notes         VARCHAR,
        status        VARCHAR(20) NOT NULL DEFAULT 'pending',
        "requestedBy" VARCHAR     NOT NULL,
        "approvedBy"  VARCHAR,
        "requestedAt" TIMESTAMP   NOT NULL DEFAULT now(),
        "approvedAt"  TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_transfers (
        id             UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"   VARCHAR     NOT NULL,
        "fromBranchId" VARCHAR     NOT NULL,
        "toBranchId"   VARCHAR     NOT NULL,
        status         VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes          VARCHAR,
        "createdBy"    VARCHAR     NOT NULL,
        "createdAt"    TIMESTAMP   NOT NULL DEFAULT now(),
        "completedAt"  TIMESTAMPTZ
      )
    `);

    // ── Transactions ──────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.transactions (
        id                  UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "businessId"        VARCHAR       NOT NULL,
        "branchId"          VARCHAR       NOT NULL,
        "posTerminalId"     VARCHAR       NOT NULL,
        "contactId"         VARCHAR,
        "createdBy"         VARCHAR       NOT NULL,
        "transactionNumber" VARCHAR       NOT NULL UNIQUE,
        "transactionType"   VARCHAR(20)   NOT NULL DEFAULT 'sale',
        status              VARCHAR(20)   NOT NULL DEFAULT 'open',
        "tableId"           VARCHAR,
        "orderType"         VARCHAR,
        subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
        "discountAmount"    NUMERIC(12,2) NOT NULL DEFAULT 0,
        "taxAmount"         NUMERIC(12,2) NOT NULL DEFAULT 0,
        "totalAmount"       NUMERIC(12,2) NOT NULL DEFAULT 0,
        notes               VARCHAR,
        "createdAt"         TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP     NOT NULL DEFAULT now(),
        "completedAt"       TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.transaction_lines (
        id                    UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "transactionId"       VARCHAR       NOT NULL,
        "itemId"              VARCHAR       NOT NULL,
        "variantId"           VARCHAR,
        "itemNameSnapshot"    VARCHAR       NOT NULL,
        "variantNameSnapshot" VARCHAR,
        "skuSnapshot"         VARCHAR,
        "unitPrice"           NUMERIC(12,2) NOT NULL,
        quantity              NUMERIC(10,3) NOT NULL,
        "discountAmount"      NUMERIC(12,2) NOT NULL DEFAULT 0,
        "lineTotal"           NUMERIC(12,2) NOT NULL,
        "createdAt"           TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.payments (
        id               UUID          PRIMARY KEY DEFAULT public.uuid_generate_v4(),
        "transactionId"  VARCHAR       NOT NULL,
        "paymentMethod"  VARCHAR(30)   NOT NULL,
        amount           NUMERIC(12,2) NOT NULL,
        "amountTendered" NUMERIC(12,2),
        "changeAmount"   NUMERIC(12,2),
        status           VARCHAR(20)   NOT NULL DEFAULT 'completed',
        reference        VARCHAR,
        notes            VARCHAR,
        "paidAt"         TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse FK dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS public.payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.transaction_lines CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.transactions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.inventory_transfers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.inventory_adjustments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.inventory_movements CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.inventory CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.item_variants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.categories CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.employees CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.settings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.onboarding_progress CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.user_branches CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.user_roles CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.role_permissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.roles CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.business_modules CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.pos_terminals CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.users CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.branches CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.permissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.businesses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.platform_owners CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS public.onboarding_progress_currentstep_enum CASCADE`);
  }
}
