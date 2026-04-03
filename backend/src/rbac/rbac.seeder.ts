import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Permission } from '../database/entities/index';
import { Role, RolePermission, UserRole } from '../database/entities/index';

// ─── All system permissions ───────────────────────────────────────────────────
// Format: '<module>.<resource>.<action>'
export const ALL_PERMISSIONS = [
  // Platform
  { code: 'platform.business.read',    module: 'platform',   description: 'Read tenant businesses' },
  { code: 'platform.business.manage',  module: 'platform',   description: 'Manage tenant businesses' },
  { code: 'platform.user.read',        module: 'platform',   description: 'Read platform users' },
  { code: 'platform.billing.manage',   module: 'platform',   description: 'Manage platform billing' },
  { code: 'platform.support.access',   module: 'platform',   description: 'Access platform support tools' },

  // Onboarding
  { code: 'onboarding.business.create', module: 'onboarding', description: 'Create a business during onboarding' },
  { code: 'onboarding.branch.setup',    module: 'onboarding', description: 'Set up a branch during onboarding' },
  { code: 'onboarding.module.configure',module: 'onboarding', description: 'Configure modules during onboarding' },

  // POS
  { code: 'pos.sale.create',    module: 'pos', description: 'Create a sale / transaction' },
  { code: 'pos.sale.read',      module: 'pos', description: 'View transactions' },
  { code: 'pos.sale.void',      module: 'pos', description: 'Void a transaction' },
  { code: 'pos.sale.refund',    module: 'pos', description: 'Issue a refund' },
  { code: 'pos.discount.apply', module: 'pos', description: 'Apply a manual discount' },
  { code: 'pos.shift.open',     module: 'pos', description: 'Open a POS shift' },
  { code: 'pos.shift.close',    module: 'pos', description: 'Close a POS shift' },
  { code: 'pos.shift.read',     module: 'pos', description: 'View shift summaries' },

  // Inventory
  { code: 'inventory.item.read',        module: 'inventory', description: 'View inventory items' },
  { code: 'inventory.item.manage',      module: 'inventory', description: 'Create and edit inventory items' },
  { code: 'inventory.stock.read',       module: 'inventory', description: 'View stock levels' },
  { code: 'inventory.stock.adjust',     module: 'inventory', description: 'Create stock adjustments (pending approval)' },
  { code: 'inventory.stock.approve',    module: 'inventory', description: 'Approve stock adjustments' },
  { code: 'inventory.transfer.create',  module: 'inventory', description: 'Create stock transfers between branches' },
  { code: 'inventory.transfer.approve', module: 'inventory', description: 'Approve stock transfers' },

  // HR
  { code: 'hr.employee.read',    module: 'hr', description: 'View employee records' },
  { code: 'hr.employee.manage',  module: 'hr', description: 'Create and edit employee records' },
  { code: 'hr.schedule.read',    module: 'hr', description: 'View employee schedules' },
  { code: 'hr.schedule.manage',  module: 'hr', description: 'Manage employee schedules' },
  { code: 'hr.payroll.read',     module: 'hr', description: 'View payroll records' },
  { code: 'hr.payroll.manage',   module: 'hr', description: 'Manage payroll records' },

  // Finance
  { code: 'finance.revenue.read',    module: 'finance', description: 'View revenue data' },
  { code: 'finance.expense.read',    module: 'finance', description: 'View expense records' },
  { code: 'finance.expense.manage',  module: 'finance', description: 'Manage expense records' },
  { code: 'finance.report.read',     module: 'finance', description: 'View financial reports' },
  { code: 'finance.report.export',   module: 'finance', description: 'Export financial reports' },
  { code: 'finance.tax.manage',      module: 'finance', description: 'Manage tax configuration' },

  // Reports
  { code: 'reports.sales.read',     module: 'reports', description: 'View sales reports' },
  { code: 'reports.inventory.read', module: 'reports', description: 'View inventory reports' },
  { code: 'reports.hr.read',        module: 'reports', description: 'View HR reports' },
  { code: 'reports.finance.read',   module: 'reports', description: 'View finance reports' },
  { code: 'reports.export',         module: 'reports', description: 'Export any report' },

  // Settings
  { code: 'settings.general.read',   module: 'settings', description: 'View general settings' },
  { code: 'settings.general.manage', module: 'settings', description: 'Manage general settings' },
  { code: 'settings.tax.manage',     module: 'settings', description: 'Manage tax settings' },
  { code: 'settings.module.manage',  module: 'settings', description: 'Enable and disable modules' },
  { code: 'settings.receipt.manage', module: 'settings', description: 'Manage receipt templates' },
  { code: 'settings.billing.manage', module: 'settings', description: 'Manage subscription and billing' },

  // Users & Branches
  { code: 'user.invite',       module: 'users',    description: 'Invite new users' },
  { code: 'user.manage',       module: 'users',    description: 'Manage user accounts' },
  { code: 'user.role.assign',  module: 'users',    description: 'Assign roles to users' },
  { code: 'user.deactivate',   module: 'users',    description: 'Deactivate user accounts' },
  { code: 'branch.read',       module: 'branches', description: 'View branch list' },
  { code: 'branch.create',     module: 'branches', description: 'Create new branches' },
  { code: 'branch.manage',     module: 'branches', description: 'Manage branch settings' },
] as const;

// ─── Role → permission map ────────────────────────────────────────────────────
// Owner has isOwner=true and bypasses PermissionsGuard entirely.
// All other roles list their permissions explicitly here.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SysAdmin: [
    'settings.general.manage', 'settings.module.manage', 'settings.receipt.manage',
    'user.manage', 'user.invite', 'user.role.assign', 'user.deactivate',
    'branch.create', 'branch.manage', 'branch.read',
    'reports.sales.read', 'reports.inventory.read', 'reports.export',
  ],
  OperationsManager: [
    'pos.sale.read', 'pos.shift.read',
    'inventory.item.read', 'inventory.stock.read', 'inventory.stock.approve',
    'inventory.transfer.approve',
    'reports.sales.read', 'reports.inventory.read',
    'user.invite', 'branch.read',
  ],
  HRManager: [
    'hr.employee.read', 'hr.employee.manage',
    'hr.schedule.read', 'hr.schedule.manage',
    'hr.payroll.read', 'hr.payroll.manage',
    'reports.hr.read', 'user.invite', 'branch.read',
  ],
  FinanceManager: [
    'finance.revenue.read', 'finance.expense.read', 'finance.expense.manage',
    'finance.report.read', 'finance.report.export', 'finance.tax.manage',
    'reports.finance.read', 'reports.export', 'settings.tax.manage',
  ],
  InventoryManager: [
    'inventory.item.read', 'inventory.item.manage',
    'inventory.stock.read', 'inventory.stock.adjust', 'inventory.stock.approve',
    'inventory.transfer.create', 'inventory.transfer.approve',
    'reports.inventory.read',
  ],
  BranchManager: [
    'pos.sale.read', 'pos.sale.void', 'pos.shift.read',
    'inventory.item.read', 'inventory.stock.read', 'inventory.stock.adjust',
    'inventory.stock.approve',
    'reports.sales.read', 'reports.inventory.read',
    'user.invite', 'branch.read',
    'settings.general.read', 'settings.receipt.manage',
  ],
  Cashier: [
    'pos.sale.create', 'pos.sale.read',
    'pos.discount.apply', 'pos.shift.open', 'pos.shift.close', 'pos.shift.read',
    'inventory.item.read',
  ],
  Staff: [
    'pos.sale.create', 'inventory.item.read',
  ],
  Viewer: [
    'reports.sales.read', 'branch.read',
  ],
};

@Injectable()
export class RbacSeeder implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Permission)
    private permsRepo: Repository<Permission>,
  ) {}

  // Runs once on app startup — seeds global permissions table if empty
  async onApplicationBootstrap() {
    const existing = await this.permsRepo.count();
    if (existing > 0) return;

    const perms = ALL_PERMISSIONS.map((p) =>
      this.permsRepo.create(p),
    );
    await this.permsRepo.save(perms);
    console.log(`Seeded ${perms.length} permissions`);
  }

  // Called per-business during provisioning
  async seedForBusiness(em: EntityManager, businessId: string) {
    const allPerms = await em.find(Permission);
    const permsByCode = Object.fromEntries(allPerms.map((p) => [p.code, p]));

    // Owner role — no explicit permissions (bypassed via isOwner flag)
    await em.save(em.create(Role, {
      businessId,
      name: 'Owner',
      description: 'Full access to everything including billing',
      isSystemRole: true,
    }));

    for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await em.save(em.create(Role, {
        businessId,
        name: roleName,
        isSystemRole: true,
      }));

      const rolePerms = permCodes
        .filter((code) => permsByCode[code])
        .map((code) =>
          em.create(RolePermission, {
            roleId: role.id,
            permissionId: permsByCode[code].id,
          }),
        );

      await em.save(rolePerms);
    }
  }
}
