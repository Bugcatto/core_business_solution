import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../types/tenant-context.type';

// ─── FirebaseAuthGuard ────────────────────────────────────────────────────────
// Verifies the Firebase JWT from the Authorization header.
// Extracts the uid and attaches it to req.firebaseUid.
// Skips routes decorated with @Public().
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    // Token was already verified and req.firebaseUid set by TenantMiddleware
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.firebaseUid) throw new UnauthorizedException('Missing or invalid auth token');
    return true;
  }
}

// ─── PermissionsGuard ─────────────────────────────────────────────────────────
// Checks that the resolved TenantContext includes every permission code
// listed in the @Permissions() decorator on the route.
// Owner bypasses all permission checks.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('permissions', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    // If this route requires permissions but tenant context wasn't resolved
    // (business lookup failed in TenantMiddleware), reject cleanly instead of
    // crashing with a TypeError that becomes a 500.
    if (required?.length && !req.tenantContext) {
      throw new UnauthorizedException('Tenant context not resolved — please re-authenticate');
    }

    if (!required?.length) return true;

    const { isOwner, permissions } = req.tenantContext;

    if (isOwner) return true;
    // OR logic: user needs any ONE of the listed permissions (not all of them).
    // This lets routes like @Permissions('items.view', 'pos.create') pass for
    // cashiers who have pos.create but not items.view.
    if (required.some((p) => permissions.includes(p))) return true;

    throw new ForbiddenException(
      `Required permissions: ${required.join(', ')}`,
    );
  }
}

// ─── BranchAccessGuard ────────────────────────────────────────────────────────
// Verifies the user is assigned to the branch_id in the request
// (from header X-Branch-Id or route param).
// Owners and SysAdmins with cross-branch access bypass this.
@Injectable()
export class BranchAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const { branchId, isOwner } = req.tenantContext;

    if (isOwner) return true;

    const requestedBranchId =
      (req.headers as any)['x-branch-id'] ?? (req as any).params?.branchId;

    if (!requestedBranchId) return true; // no branch context required on this route
    if (branchId === requestedBranchId) return true;

    throw new ForbiddenException('You do not have access to this branch');
  }
}
