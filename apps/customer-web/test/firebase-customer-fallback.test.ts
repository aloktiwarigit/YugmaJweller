import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadFirebaseCustomer(options: {
  getApps?: () => unknown[];
  getAuth?: () => unknown;
  onAuthStateChanged?: (...args: unknown[]) => unknown;
  initializeApp?: (...args: unknown[]) => unknown;
} = {}) {
  vi.resetModules();

  const initializeApp = vi.fn(options.initializeApp ?? (() => ({})));
  const getApps = vi.fn(options.getApps ?? (() => [{}]));
  const getAuth = vi.fn(options.getAuth ?? (() => ({ currentUser: null })));
  const onAuthStateChanged = vi.fn(
    options.onAuthStateChanged ?? (() => vi.fn()),
  );

  vi.doMock('firebase/app', () => ({
    initializeApp,
    getApps,
  }));

  vi.doMock('firebase/auth', () => ({
    getAuth,
    onAuthStateChanged,
    signInWithPhoneNumber: vi.fn(),
    RecaptchaVerifier: vi.fn(),
  }));

  const mod = await import('../src/auth/firebase-customer');
  return { mod, initializeApp, getApps, getAuth, onAuthStateChanged };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock('firebase/app');
  vi.doUnmock('firebase/auth');
});

describe('firebase-customer graceful fallback', () => {
  it('treats missing web config as signed out instead of throwing', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');

    const { mod, initializeApp, getAuth } = await loadFirebaseCustomer({
      getApps: () => [],
    });

    const cb = vi.fn();
    const unsub = mod.onCustomerAuthChanged(cb);

    await Promise.resolve();

    expect(await mod.getCustomerIdToken()).toBeNull();
    expect(cb).toHaveBeenCalledWith(null);
    expect(typeof unsub).toBe('function');
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('converts Firebase auth init failures into signed-out state', async () => {
    const { mod } = await loadFirebaseCustomer({
      getAuth: () => {
        throw new Error('auth/invalid-api-key');
      },
    });

    const cb = vi.fn();
    mod.onCustomerAuthChanged(cb);

    expect(await mod.getCustomerIdToken()).toBeNull();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledWith(null);
  });

  it('handles onAuthStateChanged failures without escaping to React effects', async () => {
    const { mod } = await loadFirebaseCustomer({
      onAuthStateChanged: () => {
        throw new Error('auth/invalid-api-key');
      },
    });

    const cb = vi.fn();
    const unsub = mod.onCustomerAuthChanged(cb);

    expect(cb).toHaveBeenCalledWith(null);
    expect(typeof unsub).toBe('function');
  });
});
