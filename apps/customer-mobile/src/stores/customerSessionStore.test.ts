import { describe, it, expect, beforeEach } from 'vitest';
import { useCustomerSessionStore } from './customerSessionStore';
import { makeCustomer } from '../../test/factories';

describe('customerSessionStore', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
  });

  it('starts empty', () => {
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toBeNull();
    expect(s.bearer).toBeNull();
  });

  it('setSession stores both fields', () => {
    const c = makeCustomer();
    useCustomerSessionStore.getState().setSession(c, 'tok-1');
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toEqual(c);
    expect(s.bearer).toBe('tok-1');
  });

  it('clear wipes both', () => {
    const c = makeCustomer();
    useCustomerSessionStore.getState().setSession(c, 'tok-1');
    useCustomerSessionStore.getState().clear();
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toBeNull();
    expect(s.bearer).toBeNull();
  });
});
