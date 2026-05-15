'use client';
import { useRef, useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';

interface ImpersonationState {
  sessionId: string;
  token: string;
  expiresAt: string;
}

export function ImpersonateButton({ token, tenant }: { token: string; tenant: Tenant }) {
  const [sess, setSess] = useState<ImpersonationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);

  function openForm() {
    setShowForm(true);
    setReason('');
    setError(null);
    setTimeout(() => reasonRef.current?.focus(), 0);
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setShowForm(false);
    try {
      setSess(await adminApi.startImpersonation(token, tenant.id, trimmed));
    } catch (err) {
      // Log full error for debugging; expose only a generic message to avoid leaking API details.
      console.error('[ImpersonateButton] start failed:', err);
      setError('Impersonation failed — see DevTools console for details.');
    } finally {
      setBusy(false);
      setReason('');
    }
  }

  async function handleEnd() {
    if (!sess) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.endImpersonation(token, sess.sessionId);
      setSess(null);
    } catch (err) {
      console.error('[ImpersonateButton] end failed:', err);
      setError('Could not end session — see DevTools console.');
    } finally {
      setBusy(false);
    }
  }

  // Token is NEVER rendered in the DOM. Copy-to-clipboard is the only way to retrieve it.
  async function copyToken() {
    if (!sess) return;
    try {
      await navigator.clipboard.writeText(sess.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access denied — use DevTools > Application > localStorage to retrieve token.');
    }
  }

  if (sess) {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={handleEnd}
          disabled={busy}
          className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50 text-sm"
        >
          End impersonation
        </button>
        <span className="text-xs text-slate-500">
          expires {new Date(sess.expiresAt).toLocaleTimeString()}
        </span>
        <button
          onClick={copyToken}
          className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs hover:bg-slate-300"
          aria-label="Copy session token to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy token'}
        </button>
        {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
      </div>
    );
  }

  if (showForm) {
    return (
      <form onSubmit={handleStart} className="flex flex-col gap-1">
        <label className="text-xs text-slate-600" htmlFor={`imp-reason-${tenant.id}`}>
          Reason (required):
        </label>
        <input
          id={`imp-reason-${tenant.id}`}
          ref={reasonRef}
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. customer support call #1234"
          className="border border-slate-300 rounded px-2 py-1 text-xs w-44"
        />
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={busy || !reason.trim()}
            className="px-2 py-1 bg-slate-700 text-white rounded disabled:opacity-50 text-xs"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setReason(''); }}
            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={openForm}
        disabled={busy}
        className="px-2 py-1 bg-slate-700 text-white rounded disabled:opacity-50 text-sm"
      >
        Impersonate
      </button>
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </div>
  );
}
