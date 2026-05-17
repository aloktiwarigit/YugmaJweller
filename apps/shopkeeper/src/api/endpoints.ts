import { api } from './client';
import type { Tenant } from '../stores/tenantStore';
import type { AuthenticatedUser } from '../stores/authStore';

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  tenant: Pick<Tenant, 'id' | 'slug' | 'displayName'>;
  requires_token_refresh: boolean;
}

export type AuthIdentityResponse = Pick<AuthSessionResponse, 'user' | 'tenant'>;

type RawAuthUser = {
  id: string;
  shopId?: string;
  shop_id?: string;
  role: string;
  displayName?: string;
  display_name?: string;
};

type RawAuthTenant = {
  id: string;
  slug: string;
  displayName?: string;
  display_name?: string;
};

type RawAuthSessionResponse = {
  user: RawAuthUser;
  tenant: RawAuthTenant;
  requires_token_refresh: boolean;
};

function normalizeTenant(raw: RawAuthTenant): Pick<Tenant, 'id' | 'slug' | 'displayName'> {
  return {
    id: raw.id,
    slug: raw.slug,
    displayName: raw.displayName ?? raw.display_name ?? raw.slug,
  };
}

function normalizeUser(raw: RawAuthUser, tenant?: RawAuthTenant): AuthenticatedUser {
  return {
    id: raw.id,
    shopId: raw.shopId ?? raw.shop_id ?? tenant?.id ?? '',
    role: raw.role,
    displayName: raw.displayName ?? raw.display_name ?? '',
  };
}

export async function postAuthSession(idToken: string): Promise<AuthSessionResponse> {
  const res = await api.post<RawAuthSessionResponse>('/api/v1/auth/session', { idToken });
  return {
    user: normalizeUser(res.data.user, res.data.tenant),
    tenant: normalizeTenant(res.data.tenant),
    requires_token_refresh: res.data.requires_token_refresh,
  };
}

export async function getAuthMe(): Promise<AuthIdentityResponse> {
  const res = await api.get<{ user: RawAuthUser; tenant?: RawAuthTenant }>('/api/v1/auth/me');
  if (!res.data.tenant) {
    throw new Error('auth.tenant_missing');
  }
  return {
    user: normalizeUser(res.data.user, res.data.tenant),
    tenant: normalizeTenant(res.data.tenant),
  };
}

export async function getTenantBoot(
  slug: string,
  etag?: string,
): Promise<{ tenant: Tenant; etag: string | null; notModified: boolean }> {
  const res = await api.get(`/api/v1/tenant/boot?slug=${encodeURIComponent(slug)}`, {
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (s: number) => s === 200 || s === 304,
  });
  if (res.status === 304) {
    return { tenant: null as unknown as Tenant, etag: etag ?? null, notModified: true };
  }
  return {
    tenant: res.data as Tenant,
    etag: (res.headers['etag'] as string | undefined) ?? null,
    notModified: false,
  };
}
