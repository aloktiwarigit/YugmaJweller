// apps/customer-web/app/profile/delete-account/delete-account-page-client.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
// Per Semgrep rule ops/semgrep/no-firebase-client-outside-auth-client.yaml,
// firebase/auth must NOT be imported directly from apps/customer-web/app/**.
// The per-app wrapper is permitted via the rule's exclude list.
import {
  getCustomerAuth,
  createInvisibleRecaptcha,
  sendOtp,
  type ConfirmationResult,
  type User,
} from '../../../src/auth/firebase-customer';
import type { RecaptchaVerifier } from 'firebase/auth';  // type-only is OK

const CONFIRM_PHRASE = 'मेरा डेटा मिटाएँ';

type Reason = 'no-need' | 'privacy' | 'other-jeweller' | 'other';

const REASON_OPTIONS: Array<{ value: Reason; label: string }> = [
  { value: 'no-need',         label: 'मुझे ज़रूरत नहीं' },
  { value: 'privacy',         label: 'गोपनीयता की चिंता' },
  { value: 'other-jeweller',  label: 'दूसरे जौहरी से खरीद रहा' },
  { value: 'other',           label: 'अन्य' },
];

function errorMessage(code: string | undefined): string {
  switch (code) {
    case 'crm.deletion.open_invoices':
      return 'खुले बिल होने के कारण अभी हटाने का अनुरोध नहीं हो सकता। कृपया दुकान से संपर्क करें।';
    case 'crm.deletion.already_requested':
      return 'हटाने का अनुरोध पहले से चल रहा है।';
    case 'crm.deletion.try_at_home_in_flight':
      return 'घर पर ट्राय का सामान अभी आपके पास है — पहले लौटाएँ।';
    case 'customer.token_invalid':
    case 'customer.auth_missing':
      return 'कृपया फिर से OTP से साइन इन करें।';
    default:
      return 'हटाने का अनुरोध नहीं हो सका। कृपया फिर कोशिश करें।';
  }
}

interface PageProps { resolvedShopId: string }

export function DeleteAccountPageClient({ resolvedShopId }: PageProps): React.ReactElement {
  const router = useRouter();
  const auth   = getCustomerAuth();

  // OTP gate state
  const [stage, setStage] = useState<'otp' | 'form'>(auth.currentUser ? 'form' : 'otp');
  const [phone, setPhone] = useState('');
  const [code,  setCode]  = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy,  setOtpBusy]  = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef  = useRef<RecaptchaVerifier | null>(null);

  // Form state
  const [reason, setReason]         = useState<Reason | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirm, setConfirm]       = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [busy,  setBusy]            = useState(false);

  // Lazy-init the invisible reCAPTCHA verifier (only once, only when at OTP stage).
  useEffect(() => {
    if (stage !== 'otp' || verifierRef.current !== null || recaptchaRef.current === null) return;
    verifierRef.current = createInvisibleRecaptcha(recaptchaRef.current);
  }, [stage]);

  const handleSendOtp = async (): Promise<void> => {
    if (otpBusy || !verifierRef.current) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const result = await sendOtp(phone, verifierRef.current);
      setConfirmation(result);
    } catch {
      setOtpError('OTP नहीं भेज पाए। नंबर जाँचें या कुछ देर बाद फिर कोशिश करें।');
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmOtp = async (): Promise<void> => {
    if (otpBusy || confirmation === null) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      await confirmation.confirm(code);
      setStage('form');
    } catch {
      setOtpError('OTP गलत है। कृपया फिर कोशिश करें।');
    } finally {
      setOtpBusy(false);
    }
  };

  const canSubmit = useMemo(
    () => reason !== null && confirm === CONFIRM_PHRASE && !busy,
    [reason, confirm, busy],
  );

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit || reason === null) return;
    const user: User | null = auth.currentUser;
    if (user === null) {
      setError('कृपया फिर से OTP से साइन इन करें।');
      setStage('otp');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const idToken = await user.getIdToken(/* forceRefresh */ false);
      // Dot-access — Next.js only inlines NEXT_PUBLIC_* values read with dot
      // syntax into the client bundle. Bracket access returns undefined in the
      // browser. Verified in this repo per `apps/customer-web/lib/env.ts`.
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const res = await fetch(`${apiBase}/api/v1/crm/customer/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Tenant-Id':   resolvedShopId,
        },
        body: JSON.stringify({
          reason,
          reasonText: reason === 'other' && reasonText.trim().length > 0 ? reasonText.trim() : undefined,
        }),
      });
      if (res.status === 202) {
        await auth.signOut().catch(() => undefined);
        router.push('/profile/delete-account/done');
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { code?: string };
      setError(errorMessage(json.code));
    } catch {
      setError('हटाने का अनुरोध नहीं हो सका। कृपया फिर कोशिश करें।');
    } finally {
      setBusy(false);
    }
  };

  // ── OTP gate ──────────────────────────────────────────────────────────────
  if (stage === 'otp') {
    return (
      <main className="max-w-md mx-auto px-4 py-10 md:py-14 font-prose">
        <h1 className="font-heading text-2xl text-ink mb-2">पहले अपनी पहचान सत्यापित करें</h1>
        <p className="text-sm text-inkMute mb-6">
          अपना खाता हटाने के लिए पहले OTP से अपनी पहचान सत्यापित करें।
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
              onClick={() => void handleSendOtp()}
              disabled={otpBusy || !/^\+?\d{10,15}$/.test(phone)}
              className="mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50"
            >
              {otpBusy ? 'भेजा जा रहा है...' : 'OTP भेजें'}
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
              onClick={() => void confirmOtp()}
              disabled={otpBusy || code.length !== 6}
              className="mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50"
            >
              {otpBusy ? 'जाँचा जा रहा है...' : 'पुष्टि करें'}
            </button>
          </>
        )}

        {otpError !== null && (
          <p role="alert" className="mt-3 text-sm text-[#8C2A1E]">{otpError}</p>
        )}

        <div ref={recaptchaRef} />
      </main>
    );
  }

  // ── Deletion form ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-2xl mx-auto px-4 py-10 md:py-14 font-prose">
      <h1 className="font-heading text-3xl text-ink md:text-[2.25rem]">
        क्या आप वाक़ई अपना खाता हटाना चाहते हैं?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-inkMute md:text-[15px]">
        हटाने के बाद आपका नाम, फ़ोन, पता, PAN और अन्य व्यक्तिगत जानकारी तुरंत मिटा दी जाएगी। पुराने बिल कर अनुपालन के लिए
        सुरक्षित रहेंगे, पर वे आपके नाम से जुड़े नहीं रहेंगे। यह कार्य पलटा नहीं जा सकता।
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink mb-2">हटाने का कारण</legend>
        <div role="radiogroup" className="flex flex-col gap-2">
          {REASON_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 py-2 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
                aria-label={opt.label}
                className="size-5 accent-primary"
              />
              <span className="text-base text-ink">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {reason === 'other' && (
        <div className="mt-2">
          <label htmlFor="reasonText" className="sr-only">कृपया कारण लिखें</label>
          <input
            id="reasonText"
            type="text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            maxLength={200}
            placeholder="कृपया कारण लिखें"
            className="w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base"
          />
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="confirmPhrase" className="block text-sm font-semibold text-ink mb-2">
          पुष्टि के लिए नीचे टाइप करें: <span className="text-[#8C2A1E]">{CONFIRM_PHRASE}</span>
        </label>
        <input
          id="confirmPhrase"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={CONFIRM_PHRASE}
          className="w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base"
        />
      </div>

      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-[#8C2A1E]">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full rounded-md bg-[#8C2A1E] text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'हटाया जा रहा है...' : 'हाँ, मेरा खाता हटाएँ'}
      </button>
    </form>
  );
}
