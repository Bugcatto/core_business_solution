export { PlatformOwner } from './platform-owner.entity';
export { Business } from './business.entity';
export type { BusinessType, BusinessStatus, SubscriptionPlan } from './business.entity';
export { User } from './user.entity';
export {
  Branch,
  UserBranch,
  Role,
  Permission,
  UserRole,
  RolePermission,
} from './branch.entity';
export {
  Employee,
  OnboardingProgress,
  Setting,
} from './employee.entity';
export type { OnboardingStep } from './employee.entity';

// Phase 2 — catalog
export { Category, Item, ItemVariant, PosTerminal } from './catalog.entity';

// Phase 2 — transactions
export { Transaction, TransactionLine, Payment } from './transaction.entity';

// Phase 2/3 — inventory
export {
  Inventory,
  InventoryMovement,
  InventoryAdjustment,
  InventoryTransfer,
} from './inventory.entity';

// Module enablement
export { BusinessModule } from './business-module.entity';
export type { ModuleStatus } from './business-module.entity';
