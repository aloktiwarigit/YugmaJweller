'use client';
import { useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';
import { ImpersonateButton } from './ImpersonateButton';

interface Props { token: string; tenants: Tenant[]; onMutate: () => void }

export function TenantTable({ token, tenants, onMutate }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function suspend(t: Tenant) {
    const reason = window.prompt(`Suspend ${t.display_name}? Enter reason:`);
    if (!reason) return;
    setBusy(t.id); setError(null);
    try { await adminApi.suspend(token, t.id, reason); onMutate(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function unsuspend(t: Tenant) {
    setBusy(t.id); setError(null);
    try { await adminApi.unsuspend(token, t.id); onMutate(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <div>
      {error && <div role="alert" className="mb-3 p-3 bg-red-50 text-red-800 border border-red-200 rounded">{error}</div>}
      <table className="w-full border-collapse text-sm bg-white rounded shadow-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Display name</th>
            <th className="p-2 text-left">Slug</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-500">No tenants yet.</td></tr>
          )}
          {tenants.map((t) => (
            <tr key={t.id} className="border-b border-slate-200">
              <td className="p-2">{t.display_name}</td>
              <td className="p-2 font-mono">{t.slug}</td>
              <td className="p-2">
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                  t.status === 'ACTIVE' ? 'bg-green-100 text-green-800'
                    : t.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>{t.status}</span>
              </td>
              <td className="p-2 flex gap-2">
                {t.status === 'ACTIVE' ? (
                  <button disabled={busy === t.id} onClick={() => suspend(t)}
                    className="px-2 py-1 bg-amber-600 text-white rounded disabled:opacity-50">Suspend</button>
                ) : t.status === 'SUSPENDED' ? (
                  <button disabled={busy === t.id} onClick={() => unsuspend(t)}
                    className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50">Unsuspend</button>
                ) : null}
                <ImpersonateButton token={token} tenant={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
