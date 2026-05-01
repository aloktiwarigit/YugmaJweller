import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { makeTenant } from '../../test/factories';
import * as SecureStore from 'expo-secure-store';
import { CustomerAuthProvider } from './CustomerAuthProvider';

describe('CustomerAuthProvider', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
    useTenantStore.setState({ tenant: makeTenant(), slug: 'anchor-dev', etag: null, loading: false, error: null });
    (SecureStore as unknown as { __reset: () => void }).__reset();
    vi.clearAllMocks();
    // Reset devAuth to false (the setup.ts default) before each test
    (Constants as unknown as { expoConfig: { extra: { devAuth: boolean } } }).expoConfig.extra.devAuth = false;
  });

  it('does NOT inject a session when devAuth is false', async () => {
    render(<CustomerAuthProvider><span>x</span></CustomerAuthProvider>);
    // Allow effect to flush
    await new Promise((r) => setTimeout(r, 50));
    expect(useCustomerSessionStore.getState().customer).toBeNull();
  });

  it('injects a mock session when devAuth=true AND tenant resolved', async () => {
    // Override devAuth for this test
    (Constants as unknown as { expoConfig: { extra: { devAuth: boolean } } }).expoConfig.extra.devAuth = true;
    render(<CustomerAuthProvider><span>x</span></CustomerAuthProvider>);
    await waitFor(() => {
      expect(useCustomerSessionStore.getState().customer).not.toBeNull();
    });
    const s = useCustomerSessionStore.getState();
    expect(s.bearer).toMatch(/^DEV-MOCK-/);
    expect(s.customer?.shopId).toBe(makeTenant().id);
  });
});
