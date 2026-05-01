'use client';

export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: string;
}
export interface TenantList { items: Tenant[]; total: number }
export interface PlatformMetrics { totalShops: number; activeShops: number; invoicesLast30Days: number }
export interface ImpersonationSession { sessionId: string; token: string; expiresAt: string }

const BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? 'http://localhost:3001';

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const bodyText = await r.text().catch(() => '');
    throw new Error(`admin_api ${path} ${r.status}: ${bodyText}`);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const adminApi = {
  listTenants: (token: string, q?: { search?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (q?.search) params.set('search', q.search);
    if (q?.page) params.set('page', String(q.page));
    return call<TenantList>(token, `/platform/admin/tenants?${params.toString()}`);
  },
  metrics: (token: string) =>
    call<PlatformMetrics>(token, '/platform/admin/metrics'),
  suspend: (token: string, id: string, reason: string) =>
    call<void>(token, `/platform/admin/tenants/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  unsuspend: (token: string, id: string) =>
    call<void>(token, `/platform/admin/tenants/${id}/unsuspend`, { method: 'POST' }),
  startImpersonation: (token: string, targetShopId: string, reason: string) =>
    call<ImpersonationSession>(token, '/platform/admin/impersonate', {
      method: 'POST',
      body: JSON.stringify({ targetShopId, reason }),
    }),
  endImpersonation: (token: string, sessionId: string) =>
    call<void>(token, `/platform/admin/impersonate/${sessionId}`, { method: 'DELETE' }),
};
