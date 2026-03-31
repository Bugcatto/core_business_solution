import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { BusinessesModule } from './businesses/businesses.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { OnboardingModule } from './onboarding/onboarding.module';

// Phase 2+ — uncomment as each phase is built
// import { CatalogModule } from './catalog/catalog.module';
// import { TransactionsModule } from './transactions/transactions.module';
// import { InventoryModule } from './inventory/inventory.module';
// import { ContactsModule } from './contacts/contacts.module';
// import { HrModule } from './hr/hr.module';
// import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    CommonModule,         // @Global — guards & interceptors available everywhere
    BusinessesModule,
    BranchesModule,
    UsersModule,
    RbacModule,
    OnboardingModule,
  ],
})
export class AppModule {}
