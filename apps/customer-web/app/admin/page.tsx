'use client';
import { useEffect, useState } from 'react';
import { adminApi, type Tenant, type PlatformMetrics } from './_lib/admin-api';
import { TenantTable } from './_components/TenantTable';

export default function AdminHome() {
  const [token, setToken] = useState('');
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [search, setSearch] = useState('');

  async function refresh() {
    if (!armed || !token) return;
    setError(null);
    try {
      const tList = await adminApi.listTenants(token, search ? { search } : undefined);
      setTenants(tList.items);
      setMetrics(await adminApi.metrics(token));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void refresh(); }, [armed, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!armed) {
    return (
      <div className="space-y-4 max-w-xl">
        <p className="text-sm text-slate-700">
          Paste your Firebase ID token (with <code>role=platform_admin</code> custom claim).
          Token is held in memory only.
        </p>
        <textarea
          className="w-full border border-slate-300 rounded p-2 font-mono text-xs h-28"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOi..."
        />
        <button
          onClick={() => setArmed(Boolean(token))}
          disabled={!token}
          className="px-4 py-2 bg-slate-900 text-white rounded disabled:opacity-50"
        >
          Use token
        </button>
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
        <button onClick={() => { setArmed(false); setToken(''); }} className="px-4 py-2 bg-slate-300 text-slate-900 rounded">
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
