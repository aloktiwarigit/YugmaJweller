export interface TenantAuditPort {
  claimConflict(args: {
    jwtShopId: string;
    headerShopId: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
  }): void;
}
