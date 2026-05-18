// apps/customer-web/app/sign-in/sign-in-page-client.tsx
//
// OTP sign-in form — receives rawReturnTo from the server component
// so useSearchParams() is not needed here (avoids Suspense requirement).
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCustomerAuth,
  createInvisibleRecaptcha,
  sendOtp,
  type ConfirmationResult,
  type RecaptchaVerifier,
} from '../../../src/auth/firebase-customer';

function safeReturnTo(raw: string | null): string {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

interface Props { rawReturnTo: string | null }

export function SignInPageClient({ rawReturnTo }: Props): JSX.Element {
  const router   = useRouter();
  const returnTo = safeReturnTo(rawReturnTo);

  useEffect(() => {
    if (getCustomerAuth().currentUser) router.replace(returnTo);
  }, [router, returnTo]);

  const [phone,        setPhone]        = useState('');
  const [code,         setCode]         = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [busy,         setBusy]         = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef  = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (verifierRef.current !== null || recaptchaRef.current === null) return;
    verifierRef.current = createInvisibleRecaptcha(recaptchaRef.current);
    return () => {
      verifierRef.current?.clear?.();
      verifierRef.current = null;
    };
  }, []);

  const handleSend = async (): Promise<void> => {
    if (busy || !verifierRef.current) return;
    setBusy(true);
    setError(null);
    try {
      setConfirmation(await sendOtp(phone, verifierRef.current));
    } catch {
      setError('OTP नहीं भेज पाए। नंबर जाँचें या कुछ देर बाद फिर कोशिश करें।');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (busy || confirmation === null) return;
    setBusy(true);
    setError(null);
    try {
      await confirmation.confirm(code);
      router.replace(returnTo);
    } catch {
      setError('OTP गलत है। कृपया फिर कोशिश करें।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:py-14 font-prose">
      <h1 className="font-heading text-2xl text-ink mb-2">साइन इन करें</h1>
      <p className="text-sm text-inkMute mb-6">
        अपने खाते तक पहुँचने के लिए OTP से पहचान सत्यापित करें।
      </p>

      {confirmation === null ? (
        <>
          <label htmlFor="phone" className="block text-sm font-semibold text-ink mb-2">
            मोबाइल नंबर
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            className="w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={busy || !/^\+?\d{10,15}$/.test(phone)}
            className="mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50"
          >
            {busy ? 'भेजा जा रहा है...' : 'OTP भेजें'}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="otpCode" className="block text-sm font-semibold text-ink mb-2">
            OTP कोड
          </label>
          <input
            id="otpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            className="w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base tracking-widest"
          />
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || code.length !== 6}
            className="mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50"
          >
            {busy ? 'जाँचा जा रहा है...' : 'पुष्टि करें'}
          </button>
          <button
            type="button"
            onClick={() => { setConfirmation(null); setCode(''); setError(null); }}
            disabled={busy}
            className="mt-3 w-full rounded-md border border-borderSubtle text-ink px-4 py-3 min-h-[48px] disabled:opacity-50"
          >
            नया OTP भेजें
          </button>
        </>
      )}

      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-[#8C2A1E]">{error}</p>
      )}

      <div ref={recaptchaRef} aria-hidden="true" />
    </main>
  );
}
