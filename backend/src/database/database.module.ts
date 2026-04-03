import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  PlatformOwner,
  Business, Branch, User, UserBranch,
  Role, Permission, UserRole, RolePermission,
  Employee, OnboardingProgress, Setting,
  Category, Item, ItemVariant, PosTerminal,
  Transaction, TransactionLine, Payment,
  Inventory, InventoryMovement, InventoryAdjustment, InventoryTransfer,
  BusinessModule,
} from './entities/index';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          // Phase 1
          PlatformOwner,
          Business, Branch, User, UserBranch,
          Role, Permission, UserRole, RolePermission,
          Employee, OnboardingProgress, Setting,
          // Phase 2
          Category, Item, ItemVariant, PosTerminal,
          Transaction, TransactionLine, Payment,
          // Phase 2/3
          Inventory, InventoryMovement, InventoryAdjustment, InventoryTransfer,
          // Module enablement
          BusinessModule,
        ],
        migrations: [__dirname + '/migrations/*.ts'],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
