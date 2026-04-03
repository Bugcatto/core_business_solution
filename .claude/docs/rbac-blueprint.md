# Production-Grade RBAC Blueprint
## Multi-Tenant SME Operations Platform

> This document is the controlling reference for all access control decisions in this system.
> All backend engineers, guards, middleware, and service logic must conform to this blueprint.
> Do not modify without product-manager review.

---

## The Access Formula

```
Access = authenticate(token)
       AND isActive(user)
       AND isMemberOf(user, business)
       AND isAssignedTo(user, branch)      ← skip for business-wide roles
       AND moduleEnabled(business, module)
       AND hasPermission(user, permission)
       AND satisfiesPolicy(action, context, record)
```

Every AND is a hard gate. Failure at any step returns 401 or 403. Nothing proceeds on failure.

---

## 1. The Five Control Dimensions

| Dimension | Question | Controlled by |
|---|---|---|
| Identity | Who is this? Valid token? | Firebase Auth + account status |
| Membership | Do they belong to this tenant? | User ↔ Business relationship |
| Scope | Where are they allowed to act? | Branch assignment, business-wide flag |
| Permission | What action are they allowed? | Role → Permission codes |
| Policy | Does this specific action satisfy business rules? | Service-layer logic |

---

## 2. Access Evaluation — Strict Order

```
Step 1 → Authentication         (FirebaseAuthGuard + TenantMiddleware)
Step 2 → Account Status         (TenantMiddleware: isActive check)
Step 3 → Tenant Membership      (TenantMiddleware: businessId match)
Step 4 → Branch Assignment      (BranchAccessGuard)
Step 5 → Module Enablement      (ModuleGuard)
Step 6 → Permission Match       (PermissionsGuard)
Step 7 → Policy / Business Rule (Service layer)
Step 8 → Resource Ownership     (Service layer, if applicable)
```

---

## 3. Scope Definitions

| Scope | Definition | Who carries it |
|---|---|---|
| Platform-wide | Cross-tenant, read-only, audited | platform_owner, platform_admin, platform_support |
| Business-wide | All branches within one business | owner, sysadmin, functional managers |
| Branch-limited | Only assigned branches | branch_manager, cashier, staff, viewer |
| Self-only | Only own records | cashier (own shifts), staff (own profile) |
| Module-limited | Only enabled modules | All roles |

### Scope Inheritance Rules
- Scope does NOT automatically cascade — it is explicitly assigned
- Platform roles do NOT inherit business roles and vice versa
- Branch-limited users cannot self-expand to business-wide

### Cross-Branch Access

| Role | Cross-branch |
|---|---|
| owner | Full — all branches |
| sysadmin | Full — all branches |
| operations_manager | Read — all branches |
| finance_manager | Finance data — all branches |
| hr_manager | HR data — all branches |
| inventory_manager | Configurable at assignment |
| branch_manager | Own branch only |
| cashier / staff / viewer | Own assigned branch only |

---

## 4. Permission Naming Convention

```
<module>.<resource>.<action>
```

### Full Permission Set

```
# Platform
platform.business.read
platform.business.manage
platform.user.read
platform.billing.manage
platform.support.access

# Onboarding
onboarding.business.create
onboarding.branch.setup
onboarding.module.configure

# POS
pos.sale.create
pos.sale.read
pos.sale.void
pos.sale.refund
pos.discount.apply
pos.shift.open
pos.shift.close
pos.shift.read

# Inventory
inventory.item.read
inventory.item.manage
inventory.stock.read
inventory.stock.adjust
inventory.stock.approve
inventory.transfer.create
inventory.transfer.approve

# HR
hr.employee.read
hr.employee.manage
hr.schedule.read
hr.schedule.manage
hr.payroll.read
hr.payroll.manage

# Finance
finance.revenue.read
finance.expense.read
finance.expense.manage
finance.report.read
finance.report.export
finance.tax.manage

# Reports
reports.sales.read
reports.inventory.read
reports.hr.read
reports.finance.read
reports.export

# Settings
settings.general.read
settings.general.manage
settings.tax.manage
settings.module.manage
settings.receipt.manage
settings.billing.manage

# Users & Branches
user.invite
user.manage
user.role.assign
user.deactivate
branch.read
branch.create
branch.manage
```

---

## 5. Role Definitions and Boundaries

### Platform Roles

| Role | Controls | Never controls | Scope |
|---|---|---|---|
| platform_owner | Entire platform, all tenant read-only | Tenant business operations | Platform-wide |
| platform_admin | Platform config, tenant lifecycle | Tenant data (write) | Platform-wide |
| platform_support | Read-only tenant data (time-limited, audited) | Any write on tenant data | Per-incident |
| platform_billing | Subscription, billing, invoicing | Tenant operational data | Billing only |

### Business Roles

**owner**
- Full control of their business — all branches, all modules, all users, all settings
- Only one per business. Transfer requires current owner confirmation.
- Cannot access other businesses. Cannot access platform settings.
- Scope: business-wide

**sysadmin**
- Users, roles, settings, modules, branch management
- Can assign up to sysadmin level. Cannot promote to owner.
- Cannot access payroll, financial reports, or HR unless explicitly granted.
- Scope: business-wide

**hr_manager**
- Full HR module. Can invite ≤ staff level.
- Cannot access POS void/refund, financial statements, inventory approvals, settings.
- Scope: business-wide (HR data only)

**finance_manager**
- Financial reports, revenue, expense management, tax configuration.
- Cannot manage users, void POS, manage inventory, access HR records.
- Scope: business-wide (finance data only)

**inventory_manager**
- Full inventory: items, stock, adjustments, transfers, approvals.
- Cannot approve adjustments they created (policy rule).
- Cannot access HR, payroll, financial statements.
- Scope: configurable (business-wide or branch-limited at assignment)

**operations_manager**
- POS oversight, inventory oversight, staff assignment, operational reports.
- Cannot access payroll, financial statements, or business settings.
- Can assign roles up to branch_manager level.
- Scope: business-wide (operations data)

**branch_manager**
- Manages assigned branch: staff, POS, inventory, branch reports.
- Cannot access other branches, business settings, payroll, or financial reports.
- Can invite cashier/staff to their branch only.
- Scope: branch-limited

**cashier**
- POS terminal: create sales, apply pre-approved discounts, open/close shift.
- Can view own shift summary.
- Cannot void/refund unless explicitly granted. Cannot access reports, inventory management.
- Scope: branch-limited

**staff**
- No default capabilities beyond login. Granted explicitly at invite time.
- Cannot assign roles, manage users, access settings or financial data.
- Scope: branch-limited

**viewer**
- Read-only on explicitly granted modules. Cannot create, edit, delete, void, or approve anything.
- Scope: explicitly configured at assignment

---

## 6. Authority Matrix

| Action | owner | sysadmin | ops_mgr | hr_mgr | fin_mgr | inv_mgr | branch_mgr | cashier/staff |
|---|---|---|---|---|---|---|---|---|
| Invite users | ✅ any | ✅ ≤sysadmin | ✅ ≤branch_mgr | ✅ ≤staff | ❌ | ❌ | ✅ ≤cashier | ❌ |
| Assign roles | ✅ any | ✅ ≤sysadmin | ✅ ≤branch_mgr | ❌ | ❌ | ❌ | ✅ own branch | ❌ |
| Assign branch access | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ own branch | ❌ |
| Approve inventory adj. | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ own branch | ❌ |
| Cross-branch data | ✅ | ✅ | ✅ read | ✅ HR only | ✅ finance only | configurable | ❌ | ❌ |
| Access settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Access financial data | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | branch sales only | ❌ |
| Access HR / payroll | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enable/disable modules | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 7. Role Assignment Delegation Rules

### Authority Hierarchy (ordinal)
```
1. owner
2. sysadmin
3. operations_manager = hr_manager = finance_manager = inventory_manager (peers)
4. branch_manager
5. cashier = staff (peers)
6. viewer
```

### Delegation Table

| Assigner | May assign | May NOT assign |
|---|---|---|
| owner | Any business role | Platform roles |
| sysadmin | sysadmin and below | owner |
| operations_manager | branch_manager and below | sysadmin, functional managers, owner |
| hr_manager | staff and below (their branches) | Any manager role |
| branch_manager | cashier, staff, viewer (own branch) | Any manager or cross-branch role |
| cashier / staff / viewer | Nobody | Everyone |

### Hard Delegation Rules
1. Ownership transfer: current owner only. Confirmed explicitly. Audit logged.
2. Cannot assign roles at or above your own authority level.
3. Cannot grant branch access to branches you yourself are not assigned to.
4. Platform admins cannot assign or modify business roles.
5. Role changes take effect immediately on the next request.

---

## 8. RBAC vs Policy Rules

### RBAC Controls (Static)
- Can this user type perform this action at all?
- Is the user in the correct scope?
- Is the module enabled?

### Policy Controls (Dynamic — Service Layer)

| Policy Rule | Type |
|---|---|
| Refund > threshold requires manager approval | Threshold check |
| Cannot approve your own inventory adjustment | Self-approval check |
| Cannot edit a voided or closed transaction | State machine check |
| Cannot delete a finalized payroll record | Archival protection |
| Platform support access is time-limited | Temporal check |
| Discount cannot exceed branch-configured maximum | Constraint check |

### Enforcement Pattern
```
Step 1: RBAC gate → does user have the required permission? If NO → 403
Step 2: Policy gate → does this specific instance satisfy business rules? If NO → 422/403
Step 3: Action executes
```

---

## 9. Backend Enforcement Architecture

```
Request
  │
  ├── TenantMiddleware
  │     ├── Verify Firebase token
  │     ├── Check user.isActive
  │     ├── Resolve business, branch, permissions, enabledModules
  │     └── Set req.tenantContext
  │
  ├── Guards
  │     ├── FirebaseAuthGuard
  │     ├── PermissionsGuard (OR logic on permission codes)
  │     ├── ModuleGuard (@RequireModule decorator)
  │     └── BranchAccessGuard
  │
  ├── Service Layer
  │     ├── Policy checks (state, threshold, self-approval)
  │     ├── Resource ownership checks
  │     ├── Scope-enforced queries
  │     └── Audit log writes for sensitive actions
  │
  └── Query Layer
        └── All queries carry businessId + branchId WHERE clauses
```

### Branch-Scoped Query Pattern
```typescript
// Always enforce scope at query level
const branchFilter = ctx.isOwner
  ? { businessId: ctx.businessId }
  : { businessId: ctx.businessId, branchId: ctx.branchId };

return this.repo.find({ where: branchFilter });
```

### Actions That Must Be Audit Logged
- Role assignment and revocation
- User deactivation and reactivation
- Ownership transfer
- Module enable/disable
- Platform support access
- Any void or refund above threshold
- Payroll access
- Financial report export
- Settings changes

---

## 10. Anti-Abuse Protections

| Protection | Enforcement point |
|---|---|
| Cannot grant scope beyond own ceiling | Service layer |
| All queries scoped to businessId | Query layer (mandatory) |
| Branch leakage prevention | Query layer (branchId filter) |
| Platform support is never silent | Audit log before data returned |
| Disabled users lose access immediately | TenantMiddleware isActive check + Firebase disabled |
| Frontend visibility is not security | Policy: backend enforces everything |
| Role changes invalidate session context | TenantMiddleware resolves from DB on every request |
| Self-approval is always blocked | Service layer policy check |
| Platform roles cannot masquerade as business roles | Separate code paths in TenantMiddleware |

---

## 11. Role → Permission Map (Seeded per Business)

```typescript
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
```

---

*Document version: 1.0 — 2026-04-02*
*Owner: product-manager*
*Next review: after Phase 2 completion*
