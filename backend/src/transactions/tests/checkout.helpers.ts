/**
 * checkout.helpers.ts
 *
 * Shared helpers for checkout integration and e2e tests.
 * All helpers operate directly on the EntityManager so they work
 * inside/outside database transactions as the caller requires.
 */

import { EntityManager } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import {
  Business,
  Branch,
  User,
  UserBranch,
  Role,
  UserRole,
  RolePermission,
  Permission,
  PosTerminal,
  Item,
  Inventory,
  InventoryMovement,
  OnboardingProgress,
  Setting,
} from '../../database/entities/index';
import { CheckoutDto } from '../dto/index';

// ── JWT test secret ────────────────────────────────────────────────────────────
// The FirebaseAuthGuard checks NODE_ENV === 'test' and accepts tokens signed
// with this secret instead of calling firebase-admin.
export const TEST_JWT_SECRET = 'pos-platform-test-secret-do-not-use-in-prod';

/**
 * Returns a signed JWT that the mock FirebaseAuthGuard will accept in tests.
 * The `uid` becomes `req.firebaseUid` exactly as in production.
 */
export function getMockFirebaseToken(uid: string): string {
  return jwt.sign(
    { uid, iss: 'test', aud: 'test', sub: uid },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ── Domain types returned by helpers ──────────────────────────────────────────

export interface TestTenant {
  business:   Business;
  branch:     Branch;
  terminal:   PosTerminal;
  ownerUser:  User;
  /** Firebase UID that can be passed to getMockFirebaseToken() */
  firebaseUid: string;
}

export interface TestItem {
  item:      Item;
  inventory: Inventory | null;
}

// ── createTestTenant ───────────────────────────────────────────────────────────
/**
 * Creates a fully-provisioned tenant:
 *   business → branch → POS terminal → owner user
 *   Permissions table is seeded if empty; Owner role is created for the business.
 *
 * Each call uses a unique slug/email/firebaseUid so tests can run in parallel
 * without colliding.
 */
export async function createTestTenant(
  em: EntityManager,
  suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): Promise<TestTenant> {
  // 1. Business
  const business = em.getRepository(Business).create({
    name:             `Test Business ${suffix}`,
    slug:             `test-biz-${suffix}`,
    businessType:     'retail',
    subscriptionPlan: 'free',
    status:           'active',
    defaultLanguage:  'en',
    country:          'US',
    currency:         'USD',
  });
  await em.save(business);

  // 2. Default branch
  const branch = em.create(Branch, {
    businessId: business.id,
    name:       `Main Branch ${suffix}`,
    timezone:   'UTC',
    isActive:   true,
  });
  await em.save(branch);

  // 3. POS terminal
  const terminal = em.create(PosTerminal, {
    businessId: business.id,
    branchId:   branch.id,
    name:       'Counter 1',
    deviceType: 'web',
    isActive:   true,
  });
  await em.save(terminal);

  // 4. Owner user
  const firebaseUid = `test-uid-${suffix}`;
  const ownerUser = em.create(User, {
    businessId:   business.id,
    firebaseUid,
    email:        `owner-${suffix}@test.example`,
    displayName:  `Owner ${suffix}`,
    inviteStatus: 'active',
    isActive:     true,
    createdBy:    null,
  });
  await em.save(ownerUser);

  // Link owner → business
  business.ownerUserId = ownerUser.id;
  await em.save(business);

  // 5. Seed permissions if they do not exist yet (idempotent)
  await ensurePermissionsSeeded(em);

  // 6. Create Owner role for this business
  const ownerRole = em.create(Role, {
    businessId:   business.id,
    name:         'Owner',
    isSystemRole: true,
  });
  await em.save(ownerRole);

  // Assign owner role to the owner user
  await em.save(em.create(UserRole, {
    userId:   ownerUser.id,
    roleId:   ownerRole.id,
    branchId: branch.id,
  }));

  // Assign user to branch
  await em.save(em.create(UserBranch, {
    userId:   ownerUser.id,
    branchId: branch.id,
  }));

  // 7. Minimal onboarding progress record (required by TenantContextInterceptor path)
  await em.save(em.create(OnboardingProgress, {
    businessId:   business.id,
    currentStep:  'provisioned',
  }));

  // 8. Minimal settings
  await em.save(em.create(Setting, {
    businessId: business.id,
    branchId:   null,
    key:        'receipt.footer',
    value:      'Thank you for your business!',
  }));

  return { business, branch, terminal, ownerUser, firebaseUid };
}

// ── createTestUser ─────────────────────────────────────────────────────────────
/**
 * Creates a non-owner user with the specified system role name (e.g. 'POS Staff', 'HR').
 * Returns the user and its firebase UID.
 */
export async function createTestUser(
  em: EntityManager,
  tenant: TestTenant,
  roleName: string,
  suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): Promise<{ user: User; firebaseUid: string }> {
  const firebaseUid = `test-uid-${roleName.replace(/\s+/g, '-')}-${suffix}`;

  const user = em.create(User, {
    businessId:   tenant.business.id,
    firebaseUid,
    email:        `${roleName.toLowerCase().replace(/\s+/g, '-')}-${suffix}@test.example`,
    displayName:  `${roleName} User`,
    inviteStatus: 'active',
    isActive:     true,
    createdBy:    tenant.ownerUser.id,
  });
  await em.save(user);

  // Find or create the requested role for this business
  let role = await em.findOne(Role, {
    where: { businessId: tenant.business.id, name: roleName },
  });

  if (!role) {
    role = em.create(Role, {
      businessId:   tenant.business.id,
      name:         roleName,
      isSystemRole: true,
    });
    await em.save(role);

    // Assign the standard permission set for known system roles
    await seedRolePermissions(em, role.id, roleName);
  }

  await em.save(em.create(UserRole, {
    userId:   user.id,
    roleId:   role.id,
    branchId: tenant.branch.id,
  }));

  await em.save(em.create(UserBranch, {
    userId:   user.id,
    branchId: tenant.branch.id,
  }));

  return { user, firebaseUid };
}

// ── createTestItem ─────────────────────────────────────────────────────────────
/**
 * Creates an Item for a business, optionally seeding inventory for a branch.
 */
export async function createTestItem(
  em: EntityManager,
  businessId: string,
  branchId: string,
  opts: {
    price: number;
    trackInventory: boolean;
    initialQty?: number;
    sku?: string;
    name?: string;
  },
  suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): Promise<TestItem> {
  const item = em.create(Item, {
    businessId,
    name:           opts.name ?? `Test Item ${suffix}`,
    sku:            opts.sku  ?? `SKU-${suffix}`,
    itemType:       'product',
    price:          opts.price,
    unit:           'pcs',
    trackInventory: opts.trackInventory,
    isActive:       true,
  });
  await em.save(item);

  let inventory: Inventory | null = null;

  if (opts.trackInventory && opts.initialQty != null) {
    inventory = em.create(Inventory, {
      branchId,
      itemId:           item.id,
      variantId:        null,
      quantity:         opts.initialQty,
      reservedQuantity: 0,
      reorderLevel:     0,
    });
    await em.save(inventory);
  }

  return { item, inventory };
}

// ── buildCheckoutDto ───────────────────────────────────────────────────────────
/**
 * Builds a valid CheckoutDto.  Callers may spread and override fields as needed.
 */
export function buildCheckoutDto(opts: {
  terminalId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    unitPriceOverride?: number;
    discountAmount?: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'qr';
  paymentAmount: number;
  discountAmount?: number;
  taxRate?: number;
  notes?: string;
}): CheckoutDto {
  return {
    posTerminalId:  opts.terminalId,
    lines:          opts.items.map((i) => ({
      itemId:            i.itemId,
      quantity:          i.quantity,
      discountAmount:    i.discountAmount ?? 0,
      unitPriceOverride: i.unitPriceOverride,
    })),
    payments: [
      {
        method:  opts.paymentMethod,
        amount:  opts.paymentAmount,
        ...(opts.paymentMethod === 'cash'
          ? { amountTendered: opts.paymentAmount }
          : {}),
      },
    ],
    discountAmount: opts.discountAmount ?? 0,
    taxRate:        opts.taxRate        ?? 0,
    notes:          opts.notes,
  };
}

// ── cleanupTenant ──────────────────────────────────────────────────────────────
/**
 * Deletes all data created for a test tenant.
 * Call this in afterEach/afterAll to keep the test database clean.
 * Order matters due to FK constraints — delete children before parents.
 */
export async function cleanupTenant(
  em: EntityManager,
  businessId: string,
): Promise<void> {
  // Get all branch IDs for this business so we can delete branch-scoped rows
  const branches = await em.find(Branch, { where: { businessId } });
  const branchIds = branches.map((b) => b.id);

  if (branchIds.length) {
    // Inventory movements and inventory
    await em.query(
      `DELETE FROM inventory_movements WHERE branch_id = ANY($1)`,
      [branchIds],
    );
    await em.query(
      `DELETE FROM inventory WHERE branch_id = ANY($1)`,
      [branchIds],
    );
    // Transaction lines and payments (via transactions)
    const txns = await em.query(
      `SELECT id FROM transactions WHERE branch_id = ANY($1)`,
      [branchIds],
    );
    const txnIds = (txns as { id: string }[]).map((t) => t.id);
    if (txnIds.length) {
      await em.query(
        `DELETE FROM transaction_lines WHERE transaction_id = ANY($1)`,
        [txnIds],
      );
      await em.query(
        `DELETE FROM payments WHERE transaction_id = ANY($1)`,
        [txnIds],
      );
    }
    await em.query(
      `DELETE FROM transactions WHERE branch_id = ANY($1)`,
      [branchIds],
    );
    // POS terminals
    await em.query(
      `DELETE FROM pos_terminals WHERE branch_id = ANY($1)`,
      [branchIds],
    );
  }

  // Users and their roles/branch assignments
  const users = await em.find(User, { where: { businessId } });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    await em.query(
      `DELETE FROM user_roles WHERE user_id = ANY($1)`,
      [userIds],
    );
    await em.query(
      `DELETE FROM user_branches WHERE user_id = ANY($1)`,
      [userIds],
    );
  }

  // Roles and their permission maps
  const roles = await em.find(Role, { where: { businessId } });
  const roleIds = roles.map((r) => r.id);
  if (roleIds.length) {
    await em.query(
      `DELETE FROM role_permissions WHERE role_id = ANY($1)`,
      [roleIds],
    );
  }

  await em.query(`DELETE FROM roles WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM items WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM categories WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM users WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM branches WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM onboarding_progress WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM settings WHERE business_id = $1`, [businessId]);
  await em.query(`DELETE FROM businesses WHERE id = $1`, [businessId]);
}

// ── Internal: seed permissions table (idempotent) ──────────────────────────────
async function ensurePermissionsSeeded(em: EntityManager): Promise<void> {
  const count = await em.count(Permission);
  if (count > 0) return;

  const ALL_PERMISSIONS = [
    { code: 'pos.create',          module: 'pos' },
    { code: 'pos.void',            module: 'pos' },
    { code: 'pos.discount',        module: 'pos' },
    { code: 'pos.refund',          module: 'pos' },
    { code: 'inventory.view',      module: 'inventory' },
    { code: 'inventory.adjust',    module: 'inventory' },
    { code: 'inventory.approve',   module: 'inventory' },
    { code: 'inventory.transfer',  module: 'inventory' },
    { code: 'items.view',          module: 'catalog' },
    { code: 'items.manage',        module: 'catalog' },
    { code: 'contacts.view',       module: 'contacts' },
    { code: 'contacts.manage',     module: 'contacts' },
    { code: 'reports.view',        module: 'reports' },
    { code: 'reports.export',      module: 'reports' },
    { code: 'hr.view',             module: 'hr' },
    { code: 'hr.manage',           module: 'hr' },
    { code: 'users.invite',        module: 'users' },
    { code: 'users.manage',        module: 'users' },
    { code: 'settings.view',       module: 'settings' },
    { code: 'settings.manage',     module: 'settings' },
    { code: 'branches.view',       module: 'branches' },
    { code: 'branches.manage',     module: 'branches' },
    { code: 'roles.manage',        module: 'rbac' },
    { code: 'subscription.manage', module: 'billing' },
  ];

  await em.save(ALL_PERMISSIONS.map((p) => em.create(Permission, p)));
}

// ── Internal: seed role → permission links for known system roles ──────────────
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'POS Staff':        ['pos.create', 'inventory.view', 'items.view', 'contacts.view'],
  'Inventory Staff':  ['inventory.view', 'inventory.adjust', 'inventory.transfer', 'items.view', 'reports.view'],
  HR:                 ['hr.view', 'hr.manage', 'users.invite', 'reports.view', 'branches.view'],
  Manager: [
    'pos.create', 'pos.void', 'pos.discount', 'pos.refund',
    'inventory.view', 'inventory.adjust', 'inventory.approve', 'inventory.transfer',
    'items.view', 'items.manage',
    'contacts.view', 'contacts.manage',
    'reports.view', 'reports.export',
    'hr.view', 'users.invite', 'settings.view', 'branches.view',
  ],
  SysAdmin: [
    'settings.manage', 'users.manage', 'branches.manage',
    'roles.manage', 'reports.view', 'reports.export',
    'subscription.manage', 'items.manage', 'hr.manage',
  ],
};

async function seedRolePermissions(
  em: EntityManager,
  roleId: string,
  roleName: string,
): Promise<void> {
  const codes = ROLE_PERMISSIONS_MAP[roleName];
  if (!codes?.length) return;

  const perms = await em.find(Permission);
  const permsByCode = Object.fromEntries(perms.map((p) => [p.code, p]));

  const rolePerms = codes
    .filter((c) => permsByCode[c])
    .map((c) =>
      em.create(RolePermission, { roleId, permissionId: permsByCode[c].id }),
    );

  if (rolePerms.length) await em.save(rolePerms);
}
