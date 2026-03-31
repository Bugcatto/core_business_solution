import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Permission } from '../database/entities/index';
import { Role, RolePermission, UserRole } from '../database/entities/index';

// ─── All system permissions ───────────────────────────────────────────────────
// Add new permissions here as new modules are built.
// Format: '<module>.<action>'
export const ALL_PERMISSIONS = [
  // POS
  { code: 'pos.create',          module: 'pos',       description: 'Create a transaction / sale' },
  { code: 'pos.void',            module: 'pos',       description: 'Void a transaction' },
  { code: 'pos.discount',        module: 'pos',       description: 'Apply manual discounts' },
  { code: 'pos.refund',          module: 'pos',       description: 'Issue a refund' },

  // Inventory
  { code: 'inventory.view',      module: 'inventory', description: 'View stock levels' },
  { code: 'inventory.adjust',    module: 'inventory', description: 'Create manual adjustments (pending approval)' },
  { code: 'inventory.approve',   module: 'inventory', description: 'Approve inventory adjustments' },
  { code: 'inventory.transfer',  module: 'inventory', description: 'Transfer stock between branches' },

  // Catalog
  { code: 'items.view',          module: 'catalog',   description: 'View items and categories' },
  { code: 'items.manage',        module: 'catalog',   description: 'Create, edit, delete items' },

  // Contacts
  { code: 'contacts.view',       module: 'contacts',  description: 'View contacts' },
  { code: 'contacts.manage',     module: 'contacts',  description: 'Create and edit contacts' },

  // Reports
  { code: 'reports.view',        module: 'reports',   description: 'View sales and inventory reports' },
  { code: 'reports.export',      module: 'reports',   description: 'Export reports to CSV / PDF' },

  // HR
  { code: 'hr.view',             module: 'hr',        description: 'View employee records' },
  { code: 'hr.manage',           module: 'hr',        description: 'Manage employee records' },

  // Users & access
  { code: 'users.invite',        module: 'users',     description: 'Invite new users' },
  { code: 'users.manage',        module: 'users',     description: 'Manage user accounts and roles' },

  // Settings
  { code: 'settings.view',       module: 'settings',  description: 'View business settings' },
  { code: 'settings.manage',     module: 'settings',  description: 'Update business settings' },

  // Branches
  { code: 'branches.view',       module: 'branches',  description: 'View branch list' },
  { code: 'branches.manage',     module: 'branches',  description: 'Create and edit branches' },

  // Roles
  { code: 'roles.manage',        module: 'rbac',      description: 'Manage roles and permissions' },

  // Subscription
  { code: 'subscription.manage', module: 'billing',   description: 'Manage subscription and billing' },
] as const;

// ─── Role → permission map ────────────────────────────────────────────────────
// Owner has isOwner=true and bypasses PermissionsGuard entirely.
// All other roles list their permissions explicitly here.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SysAdmin: [
    'settings.manage', 'users.manage', 'branches.manage',
    'roles.manage', 'reports.view', 'reports.export',
    'subscription.manage', 'items.manage', 'hr.manage',
  ],
  Manager: [
    'pos.create', 'pos.void', 'pos.discount', 'pos.refund',
    'inventory.view', 'inventory.adjust', 'inventory.approve', 'inventory.transfer',
    'items.view', 'items.manage',
    'contacts.view', 'contacts.manage',
    'reports.view', 'reports.export',
    'hr.view',
    'users.invite',
    'settings.view',
    'branches.view',
  ],
  'POS Staff': [
    'pos.create',
    'inventory.view',
    'items.view',
    'contacts.view',
  ],
  'Inventory Staff': [
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'items.view',
    'reports.view',
  ],
  HR: [
    'hr.view', 'hr.manage',
    'users.invite',
    'reports.view',
    'branches.view',
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
