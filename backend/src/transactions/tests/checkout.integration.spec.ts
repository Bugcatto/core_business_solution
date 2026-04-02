/**
 * checkout.integration.spec.ts
 *
 * Primary integration test suite for POST /transactions/checkout.
 * Uses a real PostgreSQL test database (pos_platform_test).
 * Only Firebase token verification is mocked — all DB and business logic is real.
 *
 * Test isolation strategy: each test creates its own tenant data via helpers
 * and cleans up in afterEach.  No test shares state with another test.
 *
 * Run with:
 *   DATABASE_URL=postgres://...pos_platform_test NODE_ENV=test jest checkout.integration
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { DataSource, EntityManager } from 'typeorm';
import { AppModule } from '../../app.module';
import { FirebaseAuthGuard } from '../../common/guards/index';
import { ResponseTransformInterceptor } from '../../common/interceptors/index';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Transaction,
  TransactionLine,
  Payment,
  Inventory,
  InventoryMovement,
} from '../../database/entities/index';
import {
  TEST_JWT_SECRET,
  getMockFirebaseToken,
  createTestTenant,
  createTestUser,
  createTestItem,
  buildCheckoutDto,
  cleanupTenant,
  TestTenant,
} from './checkout.helpers';

// ── Mock FirebaseAuthGuard ─────────────────────────────────────────────────────
// Accepts a JWT signed with TEST_JWT_SECRET instead of calling firebase-admin.
// Sets req.firebaseUid exactly as the real guard does.
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

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('POST /transactions/checkout', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let em: EntityManager;

  // Tenants created per-test — cleaned up in afterEach
  const tenantsToClean: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts setup so validation and response envelope work identically
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();

    dataSource = moduleRef.get(DataSource);
    em = dataSource.manager;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Clean up all tenants created during this test
    for (const businessId of tenantsToClean) {
      await cleanupTenant(em, businessId);
    }
    tenantsToClean.length = 0;
  });

  // Helper: register a tenant for cleanup and return it
  async function setupTenant(suffix?: string): Promise<TestTenant> {
    const tenant = await createTestTenant(em, suffix);
    tenantsToClean.push(tenant.business.id);
    return tenant;
  }

  // ── HAPPY PATH ───────────────────────────────────────────────────────────────

  describe('Happy path', () => {
    it('should complete a single-item cash checkout and deduct inventory', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          100,
        trackInventory: true,
        initialQty:     10,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 100,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      // Response envelope
      expect(res.body.success).toBe(true);
      const txn = res.body.data;
      expect(txn.status).toBe('completed');
      expect(txn.transactionType).toBe('sale');

      // Transaction number format: TXN-YYYYMMDD-NNNN
      expect(txn.transactionNumber).toMatch(/^TXN-\d{8}-\d{4}$/);

      // Totals
      expect(Number(txn.subtotal)).toBe(100);
      expect(Number(txn.totalAmount)).toBe(100);

      // Database: inventory must be 9
      const inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(inv).not.toBeNull();
      expect(Number(inv!.quantity)).toBe(9);

      // Database: one inventory movement written
      const movement = await em.findOne(InventoryMovement, {
        where: { referenceId: txn.id, itemId: item.id },
      });
      expect(movement).not.toBeNull();
      expect(movement!.movementType).toBe('sale');
      expect(movement!.direction).toBe('out');
      expect(Number(movement!.quantityBefore)).toBe(10);
      expect(Number(movement!.quantityAfter)).toBe(9);
    });

    it('should complete a multi-item checkout with correct subtotal and deduct all inventories', async () => {
      const tenant = await setupTenant();
      const [ti1, ti2, ti3] = await Promise.all([
        createTestItem(em, tenant.business.id, tenant.branch.id, { price: 50,  trackInventory: true, initialQty: 5 }),
        createTestItem(em, tenant.business.id, tenant.branch.id, { price: 75,  trackInventory: true, initialQty: 8 }),
        createTestItem(em, tenant.business.id, tenant.branch.id, { price: 120, trackInventory: true, initialQty: 3 }),
      ]);

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items: [
          { itemId: ti1.item.id, quantity: 2 },   // 100
          { itemId: ti2.item.id, quantity: 1 },   //  75
          { itemId: ti3.item.id, quantity: 1 },   // 120
        ],
        paymentMethod: 'card',
        paymentAmount: 295,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      const txn = res.body.data;
      expect(Number(txn.subtotal)).toBe(295);
      expect(Number(txn.totalAmount)).toBe(295);

      // Fetch the full transaction to check lines
      const detailRes = await request(app.getHttpServer())
        .get(`/transactions/${txn.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .expect(200);

      const lines: any[] = detailRes.body.data.lines;
      expect(lines).toHaveLength(3);

      // Inventory check
      const [inv1, inv2, inv3] = await Promise.all([
        em.findOne(Inventory, { where: { branchId: tenant.branch.id, itemId: ti1.item.id } }),
        em.findOne(Inventory, { where: { branchId: tenant.branch.id, itemId: ti2.item.id } }),
        em.findOne(Inventory, { where: { branchId: tenant.branch.id, itemId: ti3.item.id } }),
      ]);
      expect(Number(inv1!.quantity)).toBe(3); // 5 - 2
      expect(Number(inv2!.quantity)).toBe(7); // 8 - 1
      expect(Number(inv3!.quantity)).toBe(2); // 3 - 1
    });

    it('should apply a transaction-level flat discount and produce correct total', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          200,
        trackInventory: true,
        initialQty:     5,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:     tenant.terminal.id,
        items:          [{ itemId: item.id, quantity: 1 }],
        paymentMethod:  'cash',
        paymentAmount:  180,
        discountAmount: 20,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      const txn = res.body.data;
      expect(Number(txn.subtotal)).toBe(200);
      expect(Number(txn.discountAmount)).toBe(20);
      expect(Number(txn.totalAmount)).toBe(180);
    });

    it('should complete checkout for a non-tracked item without requiring an inventory row', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          50,
        trackInventory: false,
        // No initialQty — no inventory row created
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 3 }],
        paymentMethod: 'cash',
        paymentAmount: 150,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      const txn = res.body.data;
      expect(txn.status).toBe('completed');
      expect(Number(txn.totalAmount)).toBe(150);

      // No inventory row and no movement record should have been written
      const inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(inv).toBeNull();

      const movement = await em.findOne(InventoryMovement, {
        where: { referenceId: txn.id, itemId: item.id },
      });
      expect(movement).toBeNull();
    });

    it('should record split payments and sum to the transaction total', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          300,
        trackInventory: false,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      // 100 cash + 200 card
      const dto = {
        posTerminalId: tenant.terminal.id,
        lines:         [{ itemId: item.id, quantity: 1, discountAmount: 0 }],
        payments: [
          { method: 'cash', amount: 100, amountTendered: 100 },
          { method: 'card', amount: 200 },
        ],
        discountAmount: 0,
        taxRate:        0,
      };

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      const txn = res.body.data;
      expect(txn.status).toBe('completed');

      // Verify both payment rows in the database
      const payments = await em.find(Payment, { where: { transactionId: txn.id } });
      expect(payments).toHaveLength(2);
      const methods = payments.map((p) => p.paymentMethod).sort();
      expect(methods).toEqual(['card', 'cash']);
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
      expect(totalPaid).toBe(300);
    });
  });

  // ── INVENTORY EDGE CASES ──────────────────────────────────────────────────────

  describe('Inventory edge cases', () => {
    it('should block checkout and NOT create a transaction when stock is insufficient', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          50,
        trackInventory: true,
        initialQty:     2,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 3 }],  // qty 3 > stock 2
        paymentMethod: 'cash',
        paymentAmount: 150,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(400);

      // No transaction must have been saved
      const txnCount = await em.count(Transaction, {
        where: { businessId: tenant.business.id },
      });
      expect(txnCount).toBe(0);

      // Inventory must be unchanged
      const inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(Number(inv!.quantity)).toBe(2);
    });

    it('should succeed and set inventory to 0 when buying the exact last unit', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          99,
        trackInventory: true,
        initialQty:     1,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 99,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      expect(res.body.data.status).toBe('completed');

      const inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(Number(inv!.quantity)).toBe(0);
    });

    it('should deduct inventory atomically when two concurrent requests race for the last unit', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          50,
        trackInventory: true,
        initialQty:     1,  // only 1 in stock
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 50,
      });

      // Fire both requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/transactions/checkout')
          .set('Authorization', `Bearer ${token}`)
          .set('x-branch-id', tenant.branch.id)
          .send(dto),
        request(app.getHttpServer())
          .post('/transactions/checkout')
          .set('Authorization', `Bearer ${token}`)
          .set('x-branch-id', tenant.branch.id)
          .send(dto),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one must succeed and exactly one must fail
      expect(statuses).toEqual([201, 400]);

      // Inventory must be exactly 0 — not -1
      const inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(Number(inv!.quantity)).toBe(0);

      // Only one transaction record must exist
      const txnCount = await em.count(Transaction, {
        where: { businessId: tenant.business.id },
      });
      expect(txnCount).toBe(1);
    });
  });

  // ── TENANT ISOLATION ──────────────────────────────────────────────────────────

  describe('Tenant isolation (security critical)', () => {
    it('should return HTTP 404 — not 403 — when checking out with a product from another business', async () => {
      const tenantA = await setupTenant();
      const tenantB = await setupTenant();

      // Create item in Tenant B's catalog
      const { item: itemB } = await createTestItem(
        em, tenantB.business.id, tenantB.branch.id,
        { price: 100, trackInventory: false },
      );

      const token = getMockFirebaseToken(tenantA.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenantA.terminal.id,   // Tenant A terminal
        items:         [{ itemId: itemB.id, quantity: 1 }],  // Tenant B item
        paymentMethod: 'cash',
        paymentAmount: 100,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenantA.branch.id)
        .send(dto)
        .expect(404);

      // No transaction created for either tenant
      const txnCountA = await em.count(Transaction, { where: { businessId: tenantA.business.id } });
      const txnCountB = await em.count(Transaction, { where: { businessId: tenantB.business.id } });
      expect(txnCountA).toBe(0);
      expect(txnCountB).toBe(0);
    });

    it('should return HTTP 404 when using a terminal belonging to another business', async () => {
      const tenantA = await setupTenant();
      const tenantB = await setupTenant();

      const { item } = await createTestItem(
        em, tenantA.business.id, tenantA.branch.id,
        { price: 50, trackInventory: false },
      );

      const token = getMockFirebaseToken(tenantA.firebaseUid);

      // Use Tenant B's terminal with Tenant A's item
      const dto = buildCheckoutDto({
        terminalId:    tenantB.terminal.id,  // wrong tenant terminal
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 50,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenantA.branch.id)
        .send(dto)
        .expect(404);
    });

    it('should return 404 when a cashier from Branch 1 uses a terminal from Branch 2 of the same business', async () => {
      const tenant = await setupTenant();

      // Create a second branch and terminal for the same business
      const branch2 = em.create(require('../../database/entities/index').Branch, {
        businessId: tenant.business.id,
        name:       'Second Branch',
        timezone:   'UTC',
        isActive:   true,
      });
      await em.save(branch2);

      const terminal2 = em.create(require('../../database/entities/index').PosTerminal, {
        businessId: tenant.business.id,
        branchId:   branch2.id,
        name:       'Counter 2',
        isActive:   true,
      });
      await em.save(terminal2);

      const { item } = await createTestItem(
        em, tenant.business.id, tenant.branch.id,
        { price: 50, trackInventory: false },
      );

      // Branch 1 token but using Branch 2's terminal — the terminal's branchId check
      // inside checkout.service.ts uses ctx.branchId (from x-branch-id header) to validate
      // the terminal.  Providing Branch 1 context + Branch 2 terminal must fail.
      const token = getMockFirebaseToken(tenant.firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    terminal2.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 50,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)  // Branch 1 context
        .send(dto);

      expect([404, 403]).toContain(res.status);

      // Cleanup extra branch/terminal
      await em.query(`DELETE FROM pos_terminals WHERE id = $1`, [terminal2.id]);
      await em.query(`DELETE FROM branches WHERE id = $1`, [branch2.id]);
    });
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('should allow checkout for a user with POS Staff role', async () => {
      const tenant = await setupTenant();
      const { firebaseUid } = await createTestUser(em, tenant, 'POS Staff');
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          80,
        trackInventory: false,
      });

      const token = getMockFirebaseToken(firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 80,
      });

      const res = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(201);

      expect(res.body.data.status).toBe('completed');
    });

    it('should deny checkout with HTTP 403 for a user with HR role (no pos.create permission)', async () => {
      const tenant = await setupTenant();
      const { firebaseUid } = await createTestUser(em, tenant, 'HR');
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          80,
        trackInventory: false,
      });

      const token = getMockFirebaseToken(firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 80,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(403);
    });

    it('should deny checkout with HTTP 403 for a user with Inventory Staff role', async () => {
      const tenant = await setupTenant();
      const { firebaseUid } = await createTestUser(em, tenant, 'Inventory Staff');
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          40,
        trackInventory: false,
      });

      const token = getMockFirebaseToken(firebaseUid);

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 40,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(dto)
        .expect(403);
    });

    it('should return HTTP 401 for an unauthenticated request (no Authorization header)', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          50,
        trackInventory: false,
      });

      const dto = buildCheckoutDto({
        terminalId:    tenant.terminal.id,
        items:         [{ itemId: item.id, quantity: 1 }],
        paymentMethod: 'cash',
        paymentAmount: 50,
      });

      await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('x-branch-id', tenant.branch.id)
        // Intentionally no Authorization header
        .send(dto)
        .expect(401);
    });
  });

  // ── VOID AND REFUND ───────────────────────────────────────────────────────────

  describe('Void and refund', () => {
    it('should void a completed transaction and restore inventory to original quantity', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          100,
        trackInventory: true,
        initialQty:     10,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      // First: complete a checkout
      const checkoutRes = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(buildCheckoutDto({
          terminalId:    tenant.terminal.id,
          items:         [{ itemId: item.id, quantity: 2 }],
          paymentMethod: 'cash',
          paymentAmount: 200,
        }))
        .expect(201);

      const txnId = checkoutRes.body.data.id;

      // Verify inventory is now 8
      let inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(Number(inv!.quantity)).toBe(8);

      // Now void it
      const voidRes = await request(app.getHttpServer())
        .patch(`/transactions/${txnId}/void`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send({ reason: 'Customer changed mind' })
        .expect(200);

      expect(voidRes.body.data.status).toBe('voided');

      // Database: transaction must be voided
      const dbTxn = await em.findOne(Transaction, { where: { id: txnId } });
      expect(dbTxn!.status).toBe('voided');

      // Database: inventory must be restored to 10
      inv = await em.findOne(Inventory, {
        where: { branchId: tenant.branch.id, itemId: item.id },
      });
      expect(Number(inv!.quantity)).toBe(10);

      // A return_in movement must have been written
      const returnMovement = await em.findOne(InventoryMovement, {
        where: { referenceId: txnId, movementType: 'return_in' },
      });
      expect(returnMovement).not.toBeNull();
      expect(Number(returnMovement!.quantity)).toBe(2);
    });

    it('should return HTTP 400 when attempting to void an already voided transaction', async () => {
      const tenant = await setupTenant();
      const { item } = await createTestItem(em, tenant.business.id, tenant.branch.id, {
        price:          50,
        trackInventory: false,
      });

      const token = getMockFirebaseToken(tenant.firebaseUid);

      // Checkout
      const checkoutRes = await request(app.getHttpServer())
        .post('/transactions/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send(buildCheckoutDto({
          terminalId:    tenant.terminal.id,
          items:         [{ itemId: item.id, quantity: 1 }],
          paymentMethod: 'cash',
          paymentAmount: 50,
        }))
        .expect(201);

      const txnId = checkoutRes.body.data.id;

      // First void — must succeed
      await request(app.getHttpServer())
        .patch(`/transactions/${txnId}/void`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send({ reason: 'First void' })
        .expect(200);

      // Second void — must fail with 400
      await request(app.getHttpServer())
        .patch(`/transactions/${txnId}/void`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-branch-id', tenant.branch.id)
        .send({ reason: 'Trying to void again' })
        .expect(400);
    });
  });
});
