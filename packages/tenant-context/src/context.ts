export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
}

export interface TenantContext {
  readonly shopId: string;
  readonly tenant: Tenant;
  /** @sinceStory 1.1 — populated by JWT verification in auth module */
  readonly userId?: string;
  /** @sinceStory 1.1 */
  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  /** @sinceStory 1.5 — platform-admin impersonation */
  readonly isImpersonating?: boolean;
  /** @sinceStory 1.5 */
  readonly impersonationAuditId?: string;
}
