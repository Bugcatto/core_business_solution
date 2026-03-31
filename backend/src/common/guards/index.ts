import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../types/tenant-context.type';

// ─── FirebaseAuthGuard ────────────────────────────────────────────────────────
// Verifies the Firebase JWT from the Authorization header.
// Extracts the uid and attaches it to req.firebaseUid.
// Skips routes decorated with @Public().
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.firebaseUid = decoded.uid;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(req: any): string | null {
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
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
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const { isOwner, permissions } = req.tenantContext;

    if (isOwner) return true;
    if (required.every((p) => permissions.includes(p))) return true;

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
      req.headers['x-branch-id'] ?? (req as any).params?.branchId;

    if (!requestedBranchId) return true; // no branch context required on this route
    if (branchId === requestedBranchId) return true;

    throw new ForbiddenException('You do not have access to this branch');
  }
}
