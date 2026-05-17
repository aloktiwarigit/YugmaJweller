import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/providers/AuthProvider';
import { useAuthStore } from '../src/stores/authStore';
import { __setCurrentUser, __signOut } from './firebase-auth.mock';

const endpointMocks = vi.hoisted(() => ({
  getAuthMe: vi.fn(),
  postAuthSession: vi.fn(),
}));

vi.mock('../src/api/endpoints', () => ({
  getAuthMe: endpointMocks.getAuthMe,
  postAuthSession: endpointMocks.postAuthSession,
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ firebaseUser: null, user: null, idToken: null, loading: true });
    endpointMocks.getAuthMe.mockReset();
    endpointMocks.getAuthMe.mockResolvedValue({
      user: {
        id: 'u1',
        shopId: 's1',
        role: 'shop_staff',
        displayName: 'Test User',
      },
      tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
    });
    endpointMocks.postAuthSession.mockReset();
    endpointMocks.postAuthSession.mockResolvedValue({
      user: {
        id: 'u1',
        shopId: 's1',
        role: 'shop_staff',
        displayName: 'Test User',
      },
      tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
      requires_token_refresh: false,
    });
    __signOut.mockClear();
    // Reset listener by setting null so next render starts fresh
    __setCurrentUser(null);
  });

  it('sets firebaseUser + idToken when Firebase emits a user', async () => {
    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u1',
        phoneNumber: '+919999999999',
        getIdToken: async () => 'idtok',
      });
    });
    await waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toEqual({ uid: 'u1', phoneNumber: '+919999999999' });
    expect(s.idToken).toBe('idtok');
    expect(s.loading).toBe(false);
    expect(s.user).toEqual({
      id: 'u1',
      shopId: 's1',
      role: 'shop_staff',
      displayName: 'Test User',
    });
  });

  it('clears firebaseUser + idToken + user when Firebase emits null', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'u1', phoneNumber: null },
      idToken: 'x',
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test User' },
      loading: false,
    });
    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser(null);
    });
    await waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toBeNull();
    expect(s.idToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('clears app auth state and loading when getIdToken throws', async () => {
    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u2',
        phoneNumber: '+911234567890',
        getIdToken: async () => { throw new Error('token fetch failed'); },
      });
    });
    await waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toBeNull();
    expect(s.idToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('publishes the refreshed token after backend session provisioning', async () => {
    endpointMocks.getAuthMe.mockRejectedValueOnce(new Error('auth.claim_missing'));
    endpointMocks.postAuthSession.mockResolvedValueOnce({
      user: {
        id: 'u1',
        shopId: 's1',
        role: 'shop_staff',
        displayName: 'Test User',
      },
      tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
      requires_token_refresh: true,
    });
    const getIdToken = vi.fn(async (force?: boolean) => (force ? 'fresh-idtok' : 'stale-idtok'));

    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u1',
        phoneNumber: '+919999999999',
        getIdToken,
      });
    });

    await waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    expect(getIdToken).toHaveBeenNthCalledWith(1);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(useAuthStore.getState().idToken).toBe('fresh-idtok');
  });

  it('does not sign Firebase out on transient backend session network failures', async () => {
    const networkError = Object.assign(new Error('Network Error'), { isAxiosError: true });
    endpointMocks.getAuthMe.mockRejectedValueOnce(networkError);
    endpointMocks.postAuthSession.mockRejectedValueOnce(networkError);

    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u1',
        phoneNumber: '+919999999999',
        getIdToken: async () => 'idtok',
      });
    });

    await waitFor(() => expect(useAuthStore.getState().loading).toBe(false));
    expect(__signOut).not.toHaveBeenCalled();
    expect(endpointMocks.postAuthSession).not.toHaveBeenCalled();
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toEqual({ uid: 'u1', phoneNumber: '+919999999999' });
    expect(s.idToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it('fails closed and signs Firebase out when authenticated tenant does not match app tenant', async () => {
    endpointMocks.getAuthMe.mockResolvedValue({
      user: {
        id: 'u1',
        shopId: 's1',
        role: 'shop_staff',
        displayName: 'Test User',
      },
      tenant: { id: 't2', slug: 'other-shop', displayName: 'Other Shop' },
    });

    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u1',
        phoneNumber: '+919999999999',
        getIdToken: async () => 'idtok',
      });
    });

    await waitFor(() => expect(__signOut).toHaveBeenCalledTimes(1));
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toBeNull();
    expect(s.idToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.loading).toBe(false);
  });
});
