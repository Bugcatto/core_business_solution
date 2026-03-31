import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard, PermissionsGuard, BranchAccessGuard } from './guards/index';
import { TenantContextInterceptor, ResponseTransformInterceptor } from './interceptors/index';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';

// @Global() — exported providers are available everywhere without re-importing.
// Feature modules just UseGuards / UseInterceptors without needing to import CommonModule.
@Global()
@Module({
  imports: [UsersModule, BusinessesModule],
  providers: [
    Reflector,
    FirebaseAuthGuard,
    PermissionsGuard,
    BranchAccessGuard,
    TenantContextInterceptor,
    ResponseTransformInterceptor,
  ],
  exports: [
    Reflector,
    FirebaseAuthGuard,
    PermissionsGuard,
    BranchAccessGuard,
    TenantContextInterceptor,
    ResponseTransformInterceptor,
  ],
})
export class CommonModule {}
