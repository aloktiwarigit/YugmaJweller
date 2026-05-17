'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signOutOfFirebase,
  subscribeToIdToken,
} from '@goldsmith/auth-client/web';
import { getAdminAuth } from '../../lib/admin-firebase';
import { adminApi, type Tenant, type PlatformMetrics } from './_lib/admin-api';
import { TenantTable } from './_components/TenantTable';

export default function AdminHome() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [search, setSearch] = useState('');

  // Subscribe to Firebase ID-token rotation so admin-api always carries a fresh token.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const auth = getAdminAuth();
      unsubscribe = subscribeToIdToken(auth, (t) => {
        setToken(t);
        setAuthReady(true);
        if (!t) router.replace('/admin/login');
      });
    } catch (e) {
      // Misconfigured Firebase — surface the env-var error instead of a blank screen.
      setError((e as Error).message);
      setAuthReady(true);
    }
    return () => unsubscribe?.();
  }, [router]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const tList = await adminApi.listTenants(token, search ? { search } : undefined);
      setTenants(tList.items);
      setMetrics(await adminApi.metrics(token));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, search]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleSignOut() {
    try {
      await signOutOfFirebase(getAdminAuth());
    } finally {
      router.replace('/admin/login');
    }
  }

  if (!authReady) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }
  if (!token) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Redirecting to sign-in…</p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {metrics && (
        <div className="grid grid-cols-3 gap-4">
          <Card label="Total shops" value={metrics.totalShops} />
          <Card label="Active shops" value={metrics.activeShops} />
          <Card label="Invoices (30d)" value={metrics.invoicesLast30Days} />
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by slug or display name"
          className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
        />
        <button onClick={refresh} className="px-4 py-2 bg-slate-700 text-white rounded">Refresh</button>
        <button onClick={handleSignOut} className="px-4 py-2 bg-slate-300 text-slate-900 rounded">
          Sign out
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <TenantTable token={token} tenants={tenants} onMutate={refresh} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
