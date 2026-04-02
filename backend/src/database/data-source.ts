import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  PlatformOwner,
  Business, Branch, User, UserBranch,
  Role, Permission, UserRole, RolePermission,
  Employee, OnboardingProgress, Setting,
  Category, Item, ItemVariant, PosTerminal,
  Transaction, TransactionLine, Payment,
  Inventory, InventoryMovement, InventoryAdjustment, InventoryTransfer,
} from './entities/index';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    PlatformOwner,
    Business, Branch, User, UserBranch,
    Role, Permission, UserRole, RolePermission,
    Employee, OnboardingProgress, Setting,
    Category, Item, ItemVariant, PosTerminal,
    Transaction, TransactionLine, Payment,
    Inventory, InventoryMovement, InventoryAdjustment, InventoryTransfer,
  ],
  migrations: [__dirname + '/migrations/*.ts'],
});
