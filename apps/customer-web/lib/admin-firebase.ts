'use client';

// Lazy-initialised Firebase Web SDK + Google sign-in for the platform admin console.
// All calls go through @goldsmith/auth-client/web so the project's "no firebase/* outside
// auth-client" semgrep rule stays clean.
import { initWebFirebase, type WebFirebaseConfig } from '@goldsmith/auth-client/web';
import type { Auth } from 'firebase/auth';

function readConfigFromEnv(): WebFirebaseConfig {
  // NEXT_PUBLIC_* are exposed to the browser by Next.js. Configure these in
  // apps/customer-web/.env.local — values come from Firebase console → Project settings → Web app.
  const apiKey     = process.env['NEXT_PUBLIC_FIREBASE_API_KEY'];
  const authDomain = process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'];
  const projectId  = process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
  const appId      = process.env['NEXT_PUBLIC_FIREBASE_APP_ID'];

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      'Firebase Web SDK missing config — set NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID} in .env.local',
    );
  }
  return appId ? { apiKey, authDomain, projectId, appId } : { apiKey, authDomain, projectId };
}

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = initWebFirebase(readConfigFromEnv());
  return cachedAuth;
}
