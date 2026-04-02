import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Business, Branch, UserBranch, User,
  Role, UserRole, OnboardingProgress, Setting,
} from '../database/entities/index';
import { PlatformOwner } from '../database/entities/platform-owner.entity';
import { RbacModule } from '../rbac/rbac.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlatformModule } from '../platform/platform.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business, Branch, UserBranch, User,
      Role, UserRole, OnboardingProgress, Setting, PlatformOwner,
    ]),
    RbacModule,
    BusinessesModule,
    PlatformModule,
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
