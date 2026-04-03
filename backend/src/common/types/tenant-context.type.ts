// ─── common/types/tenant-context.type.ts ──────────────────────────────────────

export interface TenantContext {
  platformOwnerId: string;   // id of the PlatformOwner account
  userId:          string;   // id of the User record within the business
  businessId:      string;
  branchId:        string;
  firebaseUid:     string;
  permissions:     string[];
  enabledModules:  string[];
  isOwner:         boolean;
  businessType:    string;
  plan:            string;
}

export interface AuthenticatedRequest extends Request {
  firebaseUid:    string;
  tenantContext:  TenantContext;
}
