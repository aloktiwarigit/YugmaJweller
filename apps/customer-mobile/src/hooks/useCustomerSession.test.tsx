import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomerSession } from './useCustomerSession';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeCustomer } from '../../test/factories';
import * as secureStorage from '../lib/secure-storage';

// Re-mock @react-native-firebase/auth so this file owns its own signOut spy
// (the global setup.ts mock returns a fresh object per call, which makes
// assertions on call counts unreliable). The factory captures a singleton
// auth-instance object so production code calling `auth()` repeatedly hits
// the same mocked methods. vi.hoisted is required because vi.mock is itself
// hoisted to the top of the file by Vitest.
const { firebaseSignOut } = vi.hoisted(() => ({
  firebaseSignOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@react-native-firebase/auth', () => {
  const instance = {
    signInWithPhoneNumber: vi.fn(),
    signOut: firebaseSignOut,
    onAuthStateChanged: vi.fn((cb: (user: null) => void) => { cb(null); return (): void => undefined; }),
    onIdTokenChanged:   vi.fn((cb: (user: null) => void) => { cb(null); return (): void => undefined; }),
  };
  return { default: () => instance };
});

vi.mock('../lib/secure-storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/secure-storage')>('../lib/secure-storage');
  return {
    ...actual,
    clearSecureSession: vi.fn().mockResolvedValue(undefined),
  };
});

describe('useCustomerSession', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
    vi.mocked(secureStorage.clearSecureSession).mockClear();
    firebaseSignOut.mockReset();
    firebaseSignOut.mockResolvedValue(undefined);
  });

  it('reports unauthenticated when store is empty', () => {
    const { result } = renderHook(() => useCustomerSession());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.customer).toBeNull();
  });

  it('reports authenticated when store has a customer + bearer', () => {
    const c = makeCustomer();
    act(() => {
      useCustomerSessionStore.getState().setSession(c, 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.customer).toEqual(c);
  });

  it('signOut calls Firebase auth().signOut(), wipes store, clears SecureStore', async () => {
    act(() => {
      useCustomerSessionStore.getState().setSession(makeCustomer(), 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    await act(async () => {
      await result.current.signOut();
    });
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
    expect(useCustomerSessionStore.getState().customer).toBeNull();
    expect(secureStorage.clearSecureSession).toHaveBeenCalledTimes(1);
  });

  it('still clears local state when Firebase signOut throws (resilience invariant)', async () => {
    firebaseSignOut.mockRejectedValueOnce(new Error('firebase offline'));
    act(() => {
      useCustomerSessionStore.getState().setSession(makeCustomer(), 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    await act(async () => {
      await result.current.signOut();
    });
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
    // Local state MUST still be wiped — a failed Firebase call must not leave
    // the user signed in locally with a stale bearer.
    expect(useCustomerSessionStore.getState().customer).toBeNull();
    expect(useCustomerSessionStore.getState().bearer).toBeNull();
    expect(secureStorage.clearSecureSession).toHaveBeenCalledTimes(1);
  });
});
