import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';

// Platform layer
import { PlatformModule } from './platform/platform.module';

// Phase 1
import { BusinessesModule } from './businesses/businesses.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { OnboardingModule } from './onboarding/onboarding.module';

// Phase 2
import { CatalogModule } from './catalog/catalog.module';
import { TransactionsModule } from './transactions/transactions.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosTerminalsModule } from './pos-terminals/pos-terminals.module';

// Phase 3+ — uncomment as phases are built
// import { ContactsModule } from './contacts/contacts.module';
// import { HrModule } from './hr/hr.module';
// import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    CommonModule,
    // Platform layer
    PlatformModule,
    // Phase 1
    BusinessesModule,
    BranchesModule,
    UsersModule,
    RbacModule,
    OnboardingModule,
    // Phase 2
    CatalogModule,
    TransactionsModule,
    InventoryModule,
    PosTerminalsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
