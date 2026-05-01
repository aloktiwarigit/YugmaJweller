// Web-side Firebase init. Mirrors the RN-side `firebase.ts` but uses the `firebase` Web SDK.
// Direct import of `firebase/*` here is allowed by ops/semgrep/no-firebase-client-outside-auth-client.yaml
// (the rule excludes packages/auth-client/**).
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

export interface WebFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function initWebFirebase(config: WebFirebaseConfig): Auth {
  if (!cachedApp) {
    const opts: FirebaseOptions = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      ...(config.appId ? { appId: config.appId } : {}),
    };
    cachedApp = getApps()[0] ?? initializeApp(opts);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  return cachedAuth;
}
