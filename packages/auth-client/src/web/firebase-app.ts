// Web-side Firebase init. Mirrors the RN-side `firebase.ts` but uses the `firebase` Web SDK.
// Direct import of `firebase/*` here is allowed by ops/semgrep/no-firebase-client-outside-auth-client.yaml
// (the rule excludes packages/auth-client/**).
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from 'firebase/auth';

export interface WebFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

export interface InitOptions {
  /**
   * When true, forces in-memory persistence so the refresh token is wiped on tab close.
   * Use for privileged surfaces (platform admin) where leaving a session behind on a
   * shared/compromised browser is unacceptable. Default Firebase persistence is LOCAL
   * (IndexedDB), which survives reload. Default false.
   */
  inMemoryOnly?: boolean;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let persistencePromise: Promise<void> | null = null;

export function initWebFirebase(config: WebFirebaseConfig, opts: InitOptions = {}): Auth {
  if (!cachedApp) {
    const fbOpts: FirebaseOptions = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      ...(config.appId ? { appId: config.appId } : {}),
    };
    cachedApp = getApps()[0] ?? initializeApp(fbOpts);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
    if (opts.inMemoryOnly) {
      // Fire and remember the promise — callers that await sign-in will hit setPersistence
      // first (Firebase serializes auth-state operations), so we don't need to block here.
      persistencePromise = setPersistence(cachedAuth, inMemoryPersistence);
    }
  }
  return cachedAuth;
}

/** Awaitable handle for any pending in-memory-persistence init, for tests. */
export function getPendingPersistence(): Promise<void> | null {
  return persistencePromise;
}
