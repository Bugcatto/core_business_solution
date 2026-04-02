import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticatedRequest, TenantContext } from '../types/tenant-context.type';
import { UsersService } from '../../users/users.service';
import { BusinessesService } from '../../businesses/businesses.service';

// ─── TenantContextInterceptor ─────────────────────────────────────────────────
// Runs after FirebaseAuthGuard on every protected route.
// Delegates DB lookups to UsersService + BusinessesService — no raw repos here.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    // @Public() routes have no firebaseUid — skip context resolution
    if (!req.firebaseUid) return next.handle();

    // User may not exist yet (e.g. POST /onboarding/business — first call after Firebase signup)
    let user: Awaited<ReturnType<typeof this.usersService.findByFirebaseUid>>;
    try {
      user = await this.usersService.findByFirebaseUid(req.firebaseUid);
    } catch {
      return next.handle();
    }

    const business = await this.businessesService.findById(user.businessId);

    const branchId =
      ((req.headers as any)['x-branch-id'] as string | undefined) ??
      (await this.usersService.getDefaultBranchId(user.id));

    const permissions = await this.usersService.getPermissions(user.id, branchId);

    req.tenantContext = {
      platformOwnerId: '',   // not resolved in interceptor — TenantMiddleware handles this
      userId:          user.id,
      businessId:      user.businessId,
      branchId,
      firebaseUid:     req.firebaseUid,
      permissions,
      isOwner:         business.ownerUserId === user.id,
      businessType:    business.businessType,
      plan:            business.subscriptionPlan,
    } satisfies TenantContext;

    return next.handle();
  }
}

// ─── ResponseTransformInterceptor ─────────────────────────────────────────────
// Wraps every successful response in a standard envelope:
// { success: true, data: <payload>, timestamp: "..." }
@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
