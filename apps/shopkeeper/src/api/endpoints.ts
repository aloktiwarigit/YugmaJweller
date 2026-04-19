import { api } from './client';
import type { Tenant } from '../stores/tenantStore';
import type { AuthenticatedUser } from '../stores/authStore';

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  tenant: Pick<Tenant, 'id' | 'slug' | 'displayName'>;
  requires_token_refresh: boolean;
}

export async function postAuthSession(idToken: string): Promise<AuthSessionResponse> {
  const res = await api.post<AuthSessionResponse>('/auth/session', { idToken });
  return res.data;
}

export async function getAuthMe(): Promise<AuthenticatedUser> {
  const res = await api.get<{ user: AuthenticatedUser }>('/auth/me');
  return res.data.user;
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
