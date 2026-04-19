import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthProvider } from '../src/providers/AuthProvider';
import { useAuthStore } from '../src/stores/authStore';
import { __setCurrentUser } from './firebase-auth.mock';

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ firebaseUser: null, user: null, idToken: null, loading: true });
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
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toEqual({ uid: 'u1', phoneNumber: '+919999999999' });
    expect(s.idToken).toBe('idtok');
    expect(s.loading).toBe(false);
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
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toBeNull();
    expect(s.idToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('sets idToken to null and still clears loading when getIdToken throws', async () => {
    render(<AuthProvider>{null}</AuthProvider>);
    await act(async () => {
      __setCurrentUser({
        uid: 'u2',
        phoneNumber: '+911234567890',
        getIdToken: async () => { throw new Error('token fetch failed'); },
      });
    });
    const s = useAuthStore.getState();
    expect(s.firebaseUser).toEqual({ uid: 'u2', phoneNumber: '+911234567890' });
    expect(s.idToken).toBeNull();
    expect(s.loading).toBe(false);
  });
});
