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
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  type Auth,
  type ConfirmationResult,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let unavailableReason: string | null = null;

function cleanEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unavailable(error: unknown): null {
  if (unavailableReason === null) {
    unavailableReason = error instanceof Error ? error.message : String(error);
  }
  return null;
}

function firebaseConfig(): { apiKey: string; authDomain: string; projectId: string; appId?: string } | null {
  const apiKey     = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId  = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const appId      = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (!apiKey || !authDomain || !projectId) {
    return unavailable('missing customer Firebase web config');
  }

  return {
    apiKey,
    authDomain,
    projectId,
    ...(appId ? { appId } : {}),
  };
}

function getFirebaseAppOrNull(): FirebaseApp | null {
  if (app !== null) return app;
  try {
    const existing = getApps();
    if (existing.length > 0) {
      app = existing[0]!;
      return app;
    }
    const config = firebaseConfig();
    if (config === null) return null;
    app = initializeApp(config);
    return app;
  } catch (error) {
    return unavailable(error);
  }
}

export function getCustomerAuthOrNull(): Auth | null {
  if (auth !== null) return auth;
  const firebaseApp = getFirebaseAppOrNull();
  if (firebaseApp === null) return null;
  try {
    auth = getAuth(firebaseApp);
    return auth;
  } catch (error) {
    return unavailable(error);
  }
}

export function isCustomerFirebaseAuthAvailable(): boolean {
  return getCustomerAuthOrNull() !== null;
}

export function getCustomerAuth(): Auth {
  const customerAuth = getCustomerAuthOrNull();
  if (customerAuth === null) {
    throw new Error(unavailableReason ?? 'customer Firebase auth is unavailable');
  }
  return customerAuth;
}

export function createInvisibleRecaptcha(container: HTMLElement): RecaptchaVerifier {
  const customerAuth = getCustomerAuthOrNull();
  if (customerAuth === null) {
    throw new Error(unavailableReason ?? 'customer Firebase auth is unavailable');
  }
  return new RecaptchaVerifier(customerAuth, container, { size: 'invisible' });
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
  const customerAuth = getCustomerAuthOrNull();
  if (customerAuth === null) {
    throw new Error(unavailableReason ?? 'customer Firebase auth is unavailable');
  }
  return signInWithPhoneNumber(customerAuth, toE164(phone), verifier);
}

export type { ConfirmationResult, User, RecaptchaVerifier };

export async function getCustomerIdToken(): Promise<string | null> {
  const user = getCustomerAuthOrNull()?.currentUser ?? null;
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
  const customerAuth = getCustomerAuthOrNull();
  if (customerAuth === null) {
    queueMicrotask(() => cb(null));
    return () => {};
  }

  try {
    return onAuthStateChanged(
      customerAuth,
      cb,
      (error) => {
        unavailable(error);
        cb(null);
      },
    );
  } catch (error) {
    unavailable(error);
    cb(null);
    return () => {};
  }
}

export type { Unsubscribe };

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(getCustomerAuth(), provider);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getCustomerAuth(), email, password);
}

export async function createEmailAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(getCustomerAuth(), email, password);
  await updateProfile(cred.user, { displayName });
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getCustomerAuth(), email);
}
