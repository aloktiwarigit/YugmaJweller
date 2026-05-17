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
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type Auth,
  type ConfirmationResult,
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

export async function sendOtp(phone: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getCustomerAuth(), phone, verifier);
}

export type { ConfirmationResult, User };
