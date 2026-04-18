export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  config?: Record<string, unknown>;
}

export type ShopUserRole = 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';

interface BaseTenantContext {
  readonly shopId: string;
  readonly tenant: Tenant;
}

export interface AuthenticatedTenantContext extends BaseTenantContext {
  readonly authenticated: true;
  readonly userId: string;
  readonly role: ShopUserRole;
  readonly isImpersonating?: boolean;
  readonly impersonationAuditId?: string;
}

export interface UnauthenticatedTenantContext extends BaseTenantContext {
  readonly authenticated: false;
}

export type TenantContext = AuthenticatedTenantContext | UnauthenticatedTenantContext;
