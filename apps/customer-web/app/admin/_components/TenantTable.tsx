'use client';
import { useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';
import { ImpersonateButton } from './ImpersonateButton';

interface Props { token: string; tenants: Tenant[]; onMutate: () => void }

export function TenantTable({ token, tenants, onMutate }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Controlled suspend form state: which tenant is being suspended and the reason text.
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  function openSuspendForm(t: Tenant) {
    setSuspendTarget(t);
    setSuspendReason('');
    setError(null);
  }

  async function confirmSuspend(e: React.FormEvent) {
    e.preventDefault();
    const t = suspendTarget;
    const reason = suspendReason.trim();
    if (!t || !reason) return;
    setSuspendTarget(null);
    setSuspendReason('');
    setBusy(t.id);
    setError(null);
    try {
      await adminApi.suspend(token, t.id, reason);
      onMutate();
    } catch (err) {
      console.error('[TenantTable] suspend failed:', err);
      setError('Suspend failed — see DevTools console for details.');
    } finally {
      setBusy(null);
    }
  }

  async function unsuspend(t: Tenant) {
    setBusy(t.id);
    setError(null);
    try {
      await adminApi.unsuspend(token, t.id);
      onMutate();
    } catch (err) {
      console.error('[TenantTable] unsuspend failed:', err);
      setError('Unsuspend failed — see DevTools console.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-50 text-red-800 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Inline suspend confirmation form (replaces window.prompt) */}
      {suspendTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-dialog-title"
          className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded"
        >
          <h3 id="suspend-dialog-title" className="font-semibold text-sm text-slate-800 mb-2">
            Suspend "{suspendTarget.display_name}"?
          </h3>
          <form onSubmit={confirmSuspend} className="flex flex-col gap-2">
            <label htmlFor="suspend-reason" className="text-xs text-slate-600">
              Reason (required):
            </label>
            <input
              id="suspend-reason"
              type="text"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g. payment dispute pending investigation"
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!suspendReason.trim()}
                className="px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-50 text-sm"
              >
                Confirm suspend
              </button>
              <button
                type="button"
                onClick={() => { setSuspendTarget(null); setSuspendReason(''); }}
                className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table className="w-full border-collapse text-sm bg-white rounded shadow-sm">
        <thead className="bg-slate-100">
          <tr>
            <th scope="col" className="p-2 text-left">Display name</th>
            <th scope="col" className="p-2 text-left">Slug</th>
            <th scope="col" className="p-2 text-left">Status</th>
            <th scope="col" className="p-2 text-left">Actions</th>
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
                  t.status === 'ACTIVE'    ? 'bg-green-100 text-green-800'
                    : t.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>{t.status}</span>
              </td>
              <td className="p-2 flex gap-2 flex-wrap">
                {t.status === 'ACTIVE' ? (
                  <button
                    disabled={busy === t.id}
                    onClick={() => openSuspendForm(t)}
                    className="px-2 py-1 bg-amber-600 text-white rounded disabled:opacity-50 text-sm"
                  >
                    Suspend
                  </button>
                ) : t.status === 'SUSPENDED' ? (
                  <button
                    disabled={busy === t.id}
                    onClick={() => unsuspend(t)}
                    className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50 text-sm"
                  >
                    Unsuspend
                  </button>
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
