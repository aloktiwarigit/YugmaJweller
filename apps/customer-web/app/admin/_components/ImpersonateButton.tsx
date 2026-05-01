'use client';
import { useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';

export function ImpersonateButton({ token, tenant }: { token: string; tenant: Tenant }) {
  const [sess, setSess] = useState<{ sessionId: string; token: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const reason = window.prompt(`Reason for impersonating ${tenant.display_name}?`);
    if (!reason) return;
    setBusy(true); setError(null);
    try { setSess(await adminApi.startImpersonation(token, tenant.id, reason)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function end() {
    if (!sess) return;
    setBusy(true); setError(null);
    try { await adminApi.endImpersonation(token, sess.sessionId); setSess(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      {sess ? (
        <>
          <button onClick={end} disabled={busy} className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50">
            End impersonation
          </button>
          <span className="text-xs text-slate-500">
            expires {new Date(sess.expiresAt).toLocaleTimeString()}
          </span>
          <code className="text-[10px] break-all bg-slate-100 p-1 rounded">{sess.token}</code>
        </>
      ) : (
        <button onClick={start} disabled={busy} className="px-2 py-1 bg-slate-700 text-white rounded disabled:opacity-50">
          Impersonate
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
