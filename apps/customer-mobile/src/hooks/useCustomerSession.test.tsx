import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomerSession } from './useCustomerSession';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeCustomer } from '../../test/factories';

describe('useCustomerSession', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
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

  it('signOut clears store', () => {
    act(() => {
      useCustomerSessionStore.getState().setSession(makeCustomer(), 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    act(() => {
      void result.current.signOut();
    });
    expect(useCustomerSessionStore.getState().customer).toBeNull();
  });
});
