// apps/customer-web/src/auth/firebase-customer.ts
//
// Per-app Firebase Auth wrapper for the customer-web app. This is the only
// module in apps/customer-web/ permitted to import from 'firebase/auth' —
// see ops/semgrep/no-firebase-client-outside-auth-client.yaml. The wrapper
// exists so that the lint/security gate's intent (centralised Firebase Auth
// surface per app) is preserved even though the broader auth-client package
// doesn't have web phone-OTP helpers today.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type Auth,
  type ConfirmationResult,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app !== null) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }
  app = initializeApp({
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return app;
}

export function getCustomerAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function createInvisibleRecaptcha(container: HTMLElement): RecaptchaVerifier {
  return new RecaptchaVerifier(getCustomerAuth(), container, { size: 'invisible' });
}

/**
 * Normalise a customer-entered phone to E.164. Firebase Web phone auth
 * rejects anything else — and the customer-web UI's permissive
 * `/^\+?\d{10,15}$/` validator can let a bare 10-digit Indian number
 * through. We default to +91 for 10-digit input; otherwise we require
 * a leading + and pass through.
 */
function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  // Bare 10-digit → India default. Anything longer/shorter without a +
  // prefix is rejected by Firebase anyway; pass through and let it error.
  if (/^\d{10}$/.test(trimmed)) return '+91' + trimmed;
  return trimmed;
}

export async function sendOtp(phone: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getCustomerAuth(), toE164(phone), verifier);
}

export type { ConfirmationResult, User };

export async function getCustomerIdToken(): Promise<string | null> {
  const user = getCustomerAuth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function onCustomerAuthChanged(
  cb: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(getCustomerAuth(), cb);
}

export type { Unsubscribe };
