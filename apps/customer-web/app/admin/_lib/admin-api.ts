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

// Next only statically replaces NEXT_PUBLIC_* via dot-property access in the client bundle;
// bracket access stays as runtime `process.env[...]` and reads undefined in the browser.
function adminApiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE;
  if (!value) throw new Error('Admin API base is not configured.');

  const normalized = value.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    if (normalized.includes('localhost')) {
      throw new Error('Admin API base cannot point to localhost in production.');
    }
    if (!normalized.startsWith('https://')) {
      throw new Error('Admin API base must use https in production.');
    }
  }

  return normalized;
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${adminApiBase()}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const requestId = r.headers.get('x-request-id');
    throw new Error(
      `admin_api ${path} failed with ${r.status}${requestId ? ` requestId=${requestId}` : ''}`,
    );
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
