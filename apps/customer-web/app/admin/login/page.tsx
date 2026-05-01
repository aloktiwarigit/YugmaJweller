'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@goldsmith/auth-client/web';
import { getAdminAuth } from '../../../lib/admin-firebase';

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      const auth = getAdminAuth();
      const { user } = await signInWithGoogle(auth);
      // Token claim verification happens server-side; we only need to know the sign-in
      // succeeded before redirecting back to /admin. The page will pull the ID token via
      // user.getIdToken() and the API will reject if role !== platform_admin.
      const claims = (await user.getIdTokenResult()).claims;
      if (claims['role'] !== 'platform_admin') {
        throw new Error(
          `Signed-in user ${user.email ?? user.uid} is not provisioned as platform_admin. ` +
          `See docs/runbook.md §15.`,
        );
      }
      router.replace('/admin');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-lg font-semibold mb-2">Sign in</h2>
        <p className="text-sm text-slate-700">
          Use your Google account that has been provisioned with the
          <code className="mx-1 px-1 bg-slate-200 rounded">platform_admin</code> role.
        </p>
      </div>
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="px-4 py-2 bg-slate-900 text-white rounded disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">{error}</p>}
    </div>
  );
}
