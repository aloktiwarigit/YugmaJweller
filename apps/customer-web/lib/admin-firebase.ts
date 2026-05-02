'use client';

// Lazy-initialised Firebase Web SDK + Google sign-in for the platform admin console.
// All calls go through @goldsmith/auth-client/web so the project's "no firebase/* outside
// auth-client" semgrep rule stays clean.
import { initWebFirebase, type WebFirebaseConfig } from '@goldsmith/auth-client/web';
import type { Auth } from 'firebase/auth';

function readConfigFromEnv(): WebFirebaseConfig {
  // NEXT_PUBLIC_* are exposed to the browser by Next.js — but ONLY via static dot-property
  // access (process.env.NEXT_PUBLIC_FOO). Bracket access (process.env['NEXT_PUBLIC_FOO']) is
  // left as runtime in the client bundle and reads as undefined in the browser, so deployed
  // /admin would silently fail Firebase init even with the env vars set.
  const apiKey     = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId  = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId      = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Firebase Web SDK missing config — set NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID} in .env.local',
    );
  }
  return appId ? { apiKey, authDomain, projectId, appId } : { apiKey, authDomain, projectId };
}

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  // inMemoryOnly: platform admin is a privileged surface. Refusing default LOCAL
  // (IndexedDB) persistence ensures the refresh token does not survive tab close on
  // shared/compromised browsers. Trade-off: page reload re-popups the Google sign-in
  // — acceptable UX cost for a platform-admin audience.
  if (!cachedAuth) cachedAuth = initWebFirebase(readConfigFromEnv(), { inMemoryOnly: true });
  return cachedAuth;
}
