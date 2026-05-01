import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomerSession } from './useCustomerSession';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeCustomer } from '../../test/factories';
import * as secureStorage from '../lib/secure-storage';

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

  it('signOut wipes store and clears SecureStore', async () => {
    act(() => {
      useCustomerSessionStore.getState().setSession(makeCustomer(), 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    await act(async () => {
      await result.current.signOut();
    });
    expect(useCustomerSessionStore.getState().customer).toBeNull();
    expect(secureStorage.clearSecureSession).toHaveBeenCalledTimes(1);
  });
});
