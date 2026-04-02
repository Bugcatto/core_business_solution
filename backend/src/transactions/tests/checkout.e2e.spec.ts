/**
 * checkout.e2e.spec.ts
 *
 * End-to-end test for the full MVA critical path a new business owner follows
 * in their first 15 minutes on the platform:
 *
 *   Sign up → Provision → Create item → Set opening stock
 *     → Checkout → Verify receipt (thermal)
 *
 * Every HTTP call goes through the real controller stack (auth, interceptors,
 * validation pipes, services, TypeORM).  Only Firebase token verification is
 * stubbed.  The database used is pos_platform_test.
 *
 * Run with:
 *   DATABASE_URL=postgres://...pos_platform_test NODE_ENV=test jest checkout.e2e
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { FirebaseAuthGuard } from '../../common/guards/index';
import { ResponseTransformInterceptor } from '../../common/interceptors/index';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  TEST_JWT_SECRET,
  getMockFirebaseToken,
  cleanupTenant,
} from './checkout.helpers';

// ── Mock FirebaseAuthGuard (same as integration spec) ─────────────────────────
const mockFirebaseAuthGuard = {
  canActivate: (ctx: any) => {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      const { UnauthorizedException } = require('@nestjs/common');
      throw new UnauthorizedException('Missing auth token');
    }
    try {
      const decoded = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as { uid: string };
      req.firebaseUid = decoded.uid;
      return true;
    } catch {
      const { UnauthorizedException } = require('@nestjs/common');
      throw new UnauthorizedException('Invalid or expired token');
    }
  },
};

// ── E2E Suite ─────────────────────────────────────────────────────────────────

describe('E2E: Full new-business onboarding → first checkout', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // IDs accumulated during the test — used for cleanup
  let createdBusinessId: string;

  const FIREBASE_UID = `e2e-owner-${Date.now()}`;
  const BUSINESS_NAME = `E2E Test Retail Co ${Date.now()}`;
  const BRANCH_NAME_EXPECTED = 'Main Branch';
  const ITEM_NAME = 'Premium Widget';
  const ITEM_PRICE = 250;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();

    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    // Clean up everything created during this e2e run
    if (createdBusinessId) {
      await cleanupTenant(dataSource.manager, createdBusinessId);
    }
    await app.close();
  });

  // ── Step 1: POST /onboarding/business ──────────────────────────────────────
  let ownerToken: string;
  let defaultBranchId: string;
  let defaultTerminalId: string;

  it('Step 1 — POST /onboarding/business creates the business and owner user', async () => {
    ownerToken = getMockFirebaseToken(FIREBASE_UID);

    const res = await request(app.getHttpServer())
      .post('/onboarding/business')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name:         BUSINESS_NAME,
        businessType: 'retail',
        country:      'US',
        currency:     'USD',
        language:     'en',
        email:        `owner-e2e-${Date.now()}@example.com`,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.businessId).toBeDefined();
    createdBusinessId = res.body.data.businessId;
  });

  // ── Step 2: POST /onboarding/plan (triggers automatic provisioning) ────────
  it('Step 2 — POST /onboarding/plan provisions a branch, terminal, and RBAC roles', async () => {
    const res = await request(app.getHttpServer())
      .post('/onboarding/plan')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ plan: 'starter' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.provisioned).toBe(true);
    defaultBranchId = res.body.data.defaultBranchId;
    expect(defaultBranchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  // ── Step 3: Discover the default POS terminal ──────────────────────────────
  it('Step 3 — The provisioned branch has a default POS terminal (Terminal 1)', async () => {
    // We query the database directly here because there is no public
    // GET /pos-terminals endpoint in the current API surface.
    const terminals = await dataSource.query(
      `SELECT id FROM pos_terminals WHERE branch_id = $1 AND is_active = true LIMIT 1`,
      [defaultBranchId],
    );
    expect(terminals).toHaveLength(1);
    defaultTerminalId = terminals[0].id;
  });

  // ── Step 4: POST /items ────────────────────────────────────────────────────
  let createdItemId: string;

  it('Step 4 — POST /items creates an item in the business catalog', async () => {
    const res = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', defaultBranchId)
      .send({
        name:           ITEM_NAME,
        price:          ITEM_PRICE,
        itemType:       'product',
        trackInventory: true,
        unit:           'pcs',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    createdItemId = res.body.data.id;
    expect(createdItemId).toBeDefined();
    expect(res.body.data.name).toBe(ITEM_NAME);
    expect(Number(res.body.data.price)).toBe(ITEM_PRICE);
  });

  // ── Step 5: PATCH /inventory/opening-stock ─────────────────────────────────
  it('Step 5 — PATCH /inventory/opening-stock sets 20 units of opening stock', async () => {
    const res = await request(app.getHttpServer())
      .patch('/inventory/opening-stock')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', defaultBranchId)
      .send({
        itemId:       createdItemId,
        quantity:     20,
        reorderLevel: 3,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.quantity)).toBe(20);
    expect(Number(res.body.data.reorderLevel)).toBe(3);
  });

  // ── Step 6: POST /transactions/checkout ───────────────────────────────────
  let transactionId: string;
  let transactionNumber: string;

  it('Step 6 — POST /transactions/checkout completes the first sale', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions/checkout')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', defaultBranchId)
      .send({
        posTerminalId:  defaultTerminalId,
        lines: [
          { itemId: createdItemId, quantity: 2, discountAmount: 0 },
        ],
        payments: [
          { method: 'cash', amount: 500, amountTendered: 500 },
        ],
        discountAmount: 0,
        taxRate:        0,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const txn = res.body.data;
    expect(txn.status).toBe('completed');
    expect(txn.transactionType).toBe('sale');
    expect(Number(txn.subtotal)).toBe(500);      // 250 × 2
    expect(Number(txn.totalAmount)).toBe(500);
    expect(txn.transactionNumber).toMatch(/^TXN-\d{8}-\d{4}$/);

    transactionId     = txn.id;
    transactionNumber = txn.transactionNumber;

    // Inventory must now be 18 (20 - 2)
    const invRows = await dataSource.query(
      `SELECT quantity FROM inventory WHERE branch_id = $1 AND item_id = $2`,
      [defaultBranchId, createdItemId],
    );
    expect(invRows).toHaveLength(1);
    expect(Number(invRows[0].quantity)).toBe(18);
  });

  // ── Step 7: GET /transactions/:id/receipt/thermal ─────────────────────────
  it('Step 7 — GET /transactions/:id/receipt/thermal returns a valid receipt with real names', async () => {
    const res = await request(app.getHttpServer())
      .get(`/transactions/${transactionId}/receipt/thermal`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', defaultBranchId)
      .expect(200);

    expect(res.body.success).toBe(true);
    const thermalText: string = res.body.data;

    // Must contain the real business name (not a placeholder like 'Business')
    expect(thermalText.toUpperCase()).toContain(BUSINESS_NAME.toUpperCase());

    // Must contain the real branch name provisioned by onboarding
    expect(thermalText).toContain(BRANCH_NAME_EXPECTED);

    // Must contain the item name
    expect(thermalText).toContain(ITEM_NAME);

    // Must contain the transaction number
    expect(thermalText).toContain(transactionNumber);

    // Must contain the correct total
    expect(thermalText).toContain('500.00');

    // The footer setting is set during provisioning
    expect(thermalText).toContain('Thank you');
  });

  // ── Step 8: GET /transactions/:id/receipt (structured JSON receipt) ─────────
  it('Step 8 — GET /transactions/:id/receipt returns structured receipt with correct data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/transactions/${transactionId}/receipt`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-branch-id', defaultBranchId)
      .expect(200);

    expect(res.body.success).toBe(true);
    const receipt = res.body.data;

    // Header assertions
    expect(receipt.header.businessName).toBe(BUSINESS_NAME);
    expect(receipt.header.branchName).toBe(BRANCH_NAME_EXPECTED);
    expect(receipt.header.transactionNumber).toBe(transactionNumber);

    // Lines assertions
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.lines[0].name).toBe(ITEM_NAME);
    expect(receipt.lines[0].qty).toBe(2);
    expect(receipt.lines[0].unitPrice).toBe(ITEM_PRICE);
    expect(receipt.lines[0].lineTotal).toBe(500);

    // Totals assertions
    expect(receipt.totals.subtotal).toBe(500);
    expect(receipt.totals.total).toBe(500);
    expect(receipt.totals.discount).toBe(0);
    expect(receipt.totals.tax).toBe(0);

    // Payments assertions
    expect(receipt.payments).toHaveLength(1);
    expect(receipt.payments[0].method).toBe('cash');
    expect(receipt.payments[0].amount).toBe(500);
  });
});
