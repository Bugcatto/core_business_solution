import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { TenantContext, AuthenticatedRequest } from '../types/tenant-context.type';

// ─── @CurrentUser ─────────────────────────────────────────────────────────────
// Extracts the full TenantContext from the request.
// Usage: findAll(@CurrentUser() ctx: TenantContext)
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.tenantContext;
  },
);

// ─── @FirebaseUid ─────────────────────────────────────────────────────────────
// Used only on the onboarding/business creation endpoint where
// tenantContext doesn't exist yet (business hasn't been created).
export const FirebaseUid = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.firebaseUid;
  },
);

// ─── @Permissions ─────────────────────────────────────────────────────────────
// Marks a route with required permission codes.
// Usage: @Permissions('inventory.stock.adjust', 'inventory.stock.read')
export const Permissions = (...perms: string[]) =>
  SetMetadata('permissions', perms);

// ─── @Public ──────────────────────────────────────────────────────────────────
// Marks a route as public (skips FirebaseAuthGuard).
export const Public = () => SetMetadata('isPublic', true);

// ─── @RequireModule ───────────────────────────────────────────────────────────
// Marks a controller or route with a required module code.
// ModuleGuard will reject if the business has not enabled this module.
// Usage: @RequireModule('pos') or @RequireModule('inventory')
export const RequireModule = (moduleCode: string) =>
  SetMetadata('requiredModule', moduleCode);
