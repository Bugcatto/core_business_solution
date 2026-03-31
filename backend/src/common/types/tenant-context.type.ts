// ─── common/types/tenant-context.type.ts ─────────────────────────────────────
export interface TenantContext {
  userId: string;
  businessId: string;
  branchId: string;
  firebaseUid: string;
  permissions: string[];
  isOwner: boolean;
  businessType: string;
}

export interface AuthenticatedRequest extends Request {
  firebaseUid: string;
  tenantContext: TenantContext;
}
