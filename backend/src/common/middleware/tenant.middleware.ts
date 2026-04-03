import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { UsersService } from '../../users/users.service';
import { BusinessesService } from '../../businesses/businesses.service';
import { PlatformService } from '../../platform/platform.service';
import { AuthenticatedRequest } from '../types/tenant-context.type';

/**
 * Runs before all guards on every request.
 *
 * Resolution strategy:
 *
 * PATH A — Platform Owner accessing a business:
 *   Firebase UID → PlatformOwner found
 *   → resolve Business from X-Business-Id header OR default first active business
 *   → find User record within that business (for RBAC)
 *   → resolve branch + permissions
 *
 * PATH B — Staff member accessing their assigned business:
 *   Firebase UID → no PlatformOwner found
 *   → find User by firebaseUid (staff path, unchanged from before)
 *   → resolve branch + permissions
 *
 * Skips gracefully if no auth header, invalid token, or mid-onboarding.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly platformService: PlatformService,
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const rawHeaders = (req as any).headers as Record<string, string | undefined>;
    const authHeader = rawHeaders['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return next();

    // 1. Verify Firebase token
    const token = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.firebaseUid = decoded.uid;
    } catch {
      return next();
    }

    // 2. Attempt PATH A — Platform Owner
    try {
      const platformOwner = await this.platformService.findByFirebaseUid(req.firebaseUid);

      if (platformOwner) {
        // Resolve which business to operate in
        const requestedBusinessId = rawHeaders['x-business-id'];
        let business = requestedBusinessId
          ? await this.businessesService.findById(requestedBusinessId).catch(() => null)
          : await this.platformService.getDefaultBusiness(platformOwner.id);

        // Verify ownership if a specific business was requested
        if (business && business.platformOwnerId !== platformOwner.id) {
          business = null; // not owned by this platform owner
        }

        if (!business) {
          // Platform owner exists but has no business yet — mid-onboarding
          return next();
        }

        // Find the owner's User record within this business for RBAC
        const user = await this.usersService
          .findByFirebaseUidAndBusiness(req.firebaseUid, business.id)
          .catch(() => null);

        const branchId =
          rawHeaders['x-branch-id'] ??
          (user ? await this.usersService.getDefaultBranchId(user.id) : '');

        const permissions = user
          ? await this.usersService.getPermissions(user.id, branchId)
          : [];

        const enabledModules = await this.businessesService
          .getEnabledModules(business.id)
          .catch(() => []);

        req.tenantContext = {
          platformOwnerId: platformOwner.id,
          userId:          user?.id ?? '',
          businessId:      business.id,
          branchId,
          firebaseUid:     req.firebaseUid,
          permissions,
          enabledModules,
          isOwner:         !!user && business.ownerUserId === user.id,
          businessType:    business.businessType,
          plan:            business.subscriptionPlan,
        };

        return next();
      }
    } catch (err: unknown) {
      const isExpected =
        (err as { status?: number })?.status === 404 ||
        (err as { name?: string })?.name === 'EntityNotFoundError';
      if (!isExpected) {
        console.error('[TenantMiddleware] PATH A error:', err);
      }
    }

    // 3. PATH B — Staff member
    try {
      const user = await this.usersService.findByFirebaseUid(req.firebaseUid);
      const business = await this.businessesService.findById(user.businessId);
      const branchId =
        rawHeaders['x-branch-id'] ??
        (await this.usersService.getDefaultBranchId(user.id));
      const permissions = await this.usersService.getPermissions(user.id, branchId);

      // Find the platform owner for this business (for context propagation)
      const platformOwner = business.platformOwnerId
        ? await this.platformService.findById(business.platformOwnerId).catch(() => null)
        : null;

      const enabledModules = await this.businessesService
        .getEnabledModules(user.businessId)
        .catch(() => []);

      req.tenantContext = {
        platformOwnerId: platformOwner?.id ?? '',
        userId:          user.id,
        businessId:      user.businessId,
        branchId,
        firebaseUid:     req.firebaseUid,
        permissions,
        enabledModules,
        isOwner:         business.ownerUserId === user.id,
        businessType:    business.businessType,
        plan:            business.subscriptionPlan,
      };
    } catch (err: unknown) {
      const isExpected =
        (err as { status?: number })?.status === 404 ||
        (err as { name?: string })?.name === 'EntityNotFoundError';
      if (!isExpected) {
        console.error('[TenantMiddleware] PATH B error:', err);
      }
    }

    next();
  }
}
