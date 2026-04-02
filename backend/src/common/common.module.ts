import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard, PermissionsGuard, BranchAccessGuard } from './guards/index';
import { TenantContextInterceptor, ResponseTransformInterceptor } from './interceptors/index';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlatformModule } from '../platform/platform.module';

// @Global() — exported providers are available everywhere without re-importing.
// Feature modules just UseGuards / UseInterceptors without needing to import CommonModule.
@Global()
@Module({
  imports: [UsersModule, BusinessesModule, PlatformModule],
  providers: [
    Reflector,
    FirebaseAuthGuard,
    PermissionsGuard,
    BranchAccessGuard,
    TenantContextInterceptor,
    ResponseTransformInterceptor,
    TenantMiddleware,
  ],
  exports: [
    Reflector,
    FirebaseAuthGuard,
    PermissionsGuard,
    BranchAccessGuard,
    TenantContextInterceptor,
    ResponseTransformInterceptor,
    TenantMiddleware,
  ],
})
export class CommonModule {}
