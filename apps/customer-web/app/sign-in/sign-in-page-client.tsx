// apps/customer-web/app/sign-in/sign-in-page-client.tsx
//
// Three-tab sign-in: Phone OTP / Google / Email+Password.
// After any provider succeeds, calls POST /api/v1/customer/auth/session to
// provision the DB record before routing to returnTo.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCustomerAuth,
  getCustomerAuthOrNull,
  getCustomerIdToken,
  createInvisibleRecaptcha,
  sendOtp,
  signInWithGoogle,
  signInWithEmail,
  createEmailAccount,
  sendPasswordReset,
  type ConfirmationResult,
  type RecaptchaVerifier,
} from '../../src/auth/firebase-customer';
import { useTenant } from '../TenantContext';
import { callCustomerSessionEndpoint } from '../../lib/api';

function safeReturnTo(raw: string | null): string {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

interface Props { rawReturnTo: string | null }

type AuthTab = 'phone' | 'google' | 'email';

export function SignInPageClient({ rawReturnTo }: Props): JSX.Element {
  const router   = useRouter();
  const returnTo = safeReturnTo(rawReturnTo);
  const tenant   = useTenant();
  const [authAvailable, setAuthAvailable] = useState(true);

  useEffect(() => {
    const customerAuth = getCustomerAuthOrNull();
    if (customerAuth === null) { setAuthAvailable(false); return; }
    if (customerAuth.currentUser) router.replace(returnTo);
  }, [router, returnTo]);

  const [tab,         setTab]         = useState<AuthTab>('phone');
  const [phone,       setPhone]       = useState('');
  const [emailVal,    setEmailVal]    = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp,    setIsSignUp]    = useState(false);
  const [code,        setCode]        = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [resetSent,   setResetSent]   = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef  = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!authAvailable) return;
    if (verifierRef.current !== null || recaptchaRef.current === null) return;
    try {
      verifierRef.current = createInvisibleRecaptcha(recaptchaRef.current);
    } catch {
      setAuthAvailable(false);
      return;
    }
    return () => { verifierRef.current?.clear?.(); verifierRef.current = null; };
  }, [authAvailable]);

  const afterSignIn = async (): Promise<void> => {
    if (tenant?.shopId) {
      const idToken = await getCustomerIdToken();
      if (idToken) await callCustomerSessionEndpoint(idToken, tenant.shopId);
    }
    router.replace(returnTo);
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      await afterSignIn();
    } catch {
      setError('Google साइन इन विफल। पुनः प्रयास करें।');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        if (password !== confirmPass) { setError('पासवर्ड मेल नहीं खाते।'); return; }
        await createEmailAccount(emailVal, password, displayName);
      } else {
        await signInWithEmail(emailVal, password);
      }
      await afterSignIn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      const msgs: Record<string, string> = {
        'auth/invalid-credential':   'ईमेल या पासवर्ड गलत है।',
        'auth/email-already-in-use': 'यह ईमेल पहले से पंजीकृत है।',
        'auth/weak-password':        'पासवर्ड कम से कम 8 अक्षर का होना चाहिए।',
      };
      setError(msgs[code] ?? 'एक त्रुटि हुई। पुनः प्रयास करें।');
    } finally {
      setBusy(false);
    }
  };

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
      await afterSignIn();
    } catch {
      setError('OTP गलत है। कृपया फिर कोशिश करें।');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!emailVal) { setError('पहले ईमेल दर्ज करें।'); return; }
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(emailVal);
      setResetSent(true);
    } catch {
      setError('रीसेट ईमेल नहीं भेज पाए।');
    } finally {
      setBusy(false);
    }
  };

  if (!authAvailable) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 md:py-14 font-prose">
        <h1 className="font-heading text-2xl text-ink mb-2">Sign-in unavailable</h1>
        <p className="text-sm text-inkMute mb-6">
          Customer sign-in is temporarily unavailable. You can still browse products and contact the store for help.
        </p>
        <a href="/contact" className="inline-block rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px]">
          Contact store
        </a>
      </main>
    );
  }

  const btnCls = 'mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50';
  const inputCls = 'w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base mt-2';

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:py-14 font-prose">
      <h1 className="font-heading text-2xl text-ink mb-4">साइन इन करें</h1>

      {/* Tab switcher */}
      <div className="flex border-b border-borderSubtle mb-6" role="tablist">
        {([['phone', 'मोबाइल OTP'], ['google', 'Google'], ['email', 'ईमेल']] as const).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError(null); setResetSent(false); setConfirmation(null); }}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? 'border-primary text-ink' : 'border-transparent text-inkMute'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Phone OTP tab ──────────────────────────────────────────────── */}
      {tab === 'phone' && (
        <>
          {confirmation === null ? (
            <>
              <label htmlFor="phone" className="block text-sm font-semibold text-ink">मोबाइल नंबर</label>
              <input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone}
                onChange={(e) => setPhone(e.target.value.trim())} className={inputCls} />
              <button type="button" onClick={() => void handleSend()}
                disabled={busy || !/^\+?\d{10,15}$/.test(phone)} className={btnCls}>
                {busy ? 'भेजा जा रहा है...' : 'OTP भेजें'}
              </button>
            </>
          ) : (
            <>
              <label htmlFor="otpCode" className="block text-sm font-semibold text-ink">OTP कोड</label>
              <input id="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.trim())} className={`${inputCls} tracking-widest`} />
              <button type="button" onClick={() => void handleConfirm()}
                disabled={busy || code.length !== 6} className={btnCls}>
                {busy ? 'जाँचा जा रहा है...' : 'पुष्टि करें'}
              </button>
              <button type="button" onClick={() => { setConfirmation(null); setCode(''); setError(null); }}
                disabled={busy} className="mt-3 w-full rounded-md border border-borderSubtle text-ink px-4 py-3 min-h-[48px] disabled:opacity-50">
                नया OTP भेजें
              </button>
            </>
          )}
        </>
      )}

      {/* ── Google Sign-In tab ─────────────────────────────────────────── */}
      {tab === 'google' && (
        <div className="flex flex-col items-center py-4">
          <p className="text-sm text-inkMute mb-6">Google खाते से जारी रखें</p>
          <button type="button" onClick={() => void handleGoogleSignIn()} disabled={busy}
            className="w-full rounded-md border border-borderSubtle bg-white text-ink px-4 py-3 font-semibold min-h-[48px] flex items-center justify-center gap-3 disabled:opacity-50">
            {busy ? 'जारी है...' : <><span className="font-bold">G</span> Google से जारी रखें</>}
          </button>
        </div>
      )}

      {/* ── Email/Password tab ─────────────────────────────────────────── */}
      {tab === 'email' && (
        <>
          {resetSent ? (
            <p role="alert" className="text-sm text-green-700 mb-4">रीसेट ईमेल भेज दिया गया। इनबॉक्स जाँचें।</p>
          ) : null}

          <div className="flex gap-4 mb-4">
            <button type="button" onClick={() => { setIsSignUp(false); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold border ${!isSignUp ? 'bg-ink text-white border-ink' : 'border-borderSubtle text-inkMute'}`}>
              साइन इन
            </button>
            <button type="button" onClick={() => { setIsSignUp(true); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold border ${isSignUp ? 'bg-ink text-white border-ink' : 'border-borderSubtle text-inkMute'}`}>
              खाता बनाएं
            </button>
          </div>

          {isSignUp && (
            <>
              <label htmlFor="displayName" className="block text-sm font-semibold text-ink">नाम</label>
              <input id="displayName" type="text" placeholder="आपका नाम" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
            </>
          )}

          <label htmlFor="emailInput" className="block text-sm font-semibold text-ink mt-2">ईमेल</label>
          <input id="emailInput" type="email" autoComplete="email" placeholder="आपका ईमेल" value={emailVal}
            onChange={(e) => setEmailVal(e.target.value.trim())} className={inputCls} />

          <label htmlFor="passwordInput" className="block text-sm font-semibold text-ink mt-2">पासवर्ड</label>
          <input id="passwordInput" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="8+ अक्षर" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />

          {isSignUp && (
            <>
              <label htmlFor="confirmPass" className="block text-sm font-semibold text-ink mt-2">पासवर्ड पुनः दर्ज करें</label>
              <input id="confirmPass" type="password" autoComplete="new-password" placeholder="पासवर्ड पुनः दर्ज करें"
                value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputCls} />
            </>
          )}

          <button type="button" onClick={() => void handleEmailAuth()} disabled={busy} className={btnCls}>
            {busy ? 'जारी है...' : (isSignUp ? 'खाता बनाएं' : 'साइन इन')}
          </button>

          {!isSignUp && (
            <button type="button" onClick={() => void handleForgotPassword()} disabled={busy}
              className="mt-3 w-full text-sm text-accent underline text-center min-h-[44px] disabled:opacity-50">
              पासवर्ड भूल गए?
            </button>
          )}
        </>
      )}

      {error !== null && <p role="alert" className="mt-3 text-sm text-[#8C2A1E]">{error}</p>}
      <div ref={recaptchaRef} aria-hidden="true" />
    </main>
  );
}
