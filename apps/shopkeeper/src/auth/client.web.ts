import ExpoConstants from 'expo-constants';
import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { normalizePhone } from '@goldsmith/auth-client';

type FirebaseUserLike = {
  uid: string;
  phoneNumber: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

type AuthLike = {
  currentUser: FirebaseUserLike | null;
  onAuthStateChanged: (listener: (user: FirebaseUserLike | null) => void) => () => void;
  signInWithPhoneNumber: (phone: string) => Promise<ConfirmationResult>;
};

let cachedAuth: Auth | null = null;
let cachedVerifier: RecaptchaVerifier | null = null;

function getFirebaseOptions(): FirebaseOptions {
  const extra = ExpoConstants.expoConfig?.extra as
    | {
        firebase?: {
          apiKey?: string;
          authDomain?: string;
          projectId?: string;
          appId?: string;
        };
      }
    | undefined;
  const firebase = extra?.firebase;

  if (!firebase?.apiKey || !firebase.projectId || !firebase.authDomain) {
    throw new Error('shopkeeper.firebase_web_config_missing');
  }

  return {
    apiKey: firebase.apiKey,
    authDomain: firebase.authDomain,
    projectId: firebase.projectId,
    ...(firebase.appId ? { appId: firebase.appId } : {}),
  };
}

function getWebAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = getApps()[0] ?? initializeApp(getFirebaseOptions());
  cachedAuth = getAuth(app);
  return cachedAuth;
}

function asFirebaseUserLike(user: User | null): FirebaseUserLike | null {
  if (!user) return null;
  return {
    uid: user.uid,
    phoneNumber: user.phoneNumber,
    getIdToken: (forceRefresh?: boolean) => user.getIdToken(forceRefresh),
  };
}

function getRecaptchaVerifier(authInstance: Auth): RecaptchaVerifier {
  if (cachedVerifier) return cachedVerifier;
  let container = document.getElementById('shopkeeper-firebase-recaptcha');
  if (!container) {
    container = document.createElement('div');
    container.id = 'shopkeeper-firebase-recaptcha';
    container.style.display = 'none';
    document.body.appendChild(container);
  }
  cachedVerifier = new RecaptchaVerifier(authInstance, container, { size: 'invisible' });
  return cachedVerifier;
}

export function auth(): AuthLike {
  const authInstance = getWebAuth();
  return {
    get currentUser() {
      return asFirebaseUserLike(authInstance.currentUser);
    },
    onAuthStateChanged(listener) {
      return onAuthStateChanged(authInstance, (user) => listener(asFirebaseUserLike(user)));
    },
    signInWithPhoneNumber(phone) {
      return signInWithPhoneNumber(authInstance, normalizePhone(phone), getRecaptchaVerifier(authInstance));
    },
  };
}

export async function sendOtp(phone: string): Promise<ConfirmationResult> {
  return auth().signInWithPhoneNumber(phone);
}

export async function verifyOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<{ idToken: string }> {
  const credential = await confirmation.confirm(code);
  const idToken = await credential.user.getIdToken();
  return { idToken };
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export { normalizePhone };
