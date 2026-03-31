import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Business, Branch, UserBranch, User,
  Role, UserRole, OnboardingProgress, Setting,
} from '../database/entities/index';
import { RbacModule } from '../rbac/rbac.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business, Branch, UserBranch, User,
      Role, UserRole, OnboardingProgress, Setting,
    ]),
    RbacModule,
    BusinessesModule,
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
