import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';

// Mock auth-client — factory cannot reference outer variables (hoisting)
const verifyOtpMock = vi.fn();
const postAuthSessionMock = vi.fn();
const getIdTokenMock = vi.fn().mockResolvedValue(null);
vi.mock('@goldsmith/auth-client', () => ({
  sendOtp: vi.fn(),
  verifyOtp: (...args: unknown[]): unknown => verifyOtpMock(...args),
  getIdToken: (...args: unknown[]): unknown => getIdTokenMock(...args),
  auth: (): unknown => ({}),
}));

// Mock endpoint — postAuthSession from src/api/endpoints
vi.mock('../src/api/endpoints', () => ({
  postAuthSession: (...args: unknown[]): unknown => postAuthSessionMock(...args),
  getAuthMe: vi.fn(),
  getTenantBoot: vi.fn(),
}));

// Mock expo-router
vi.mock('expo-router', () => ({
  router: { replace: vi.fn(), push: vi.fn() },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Redirect: (): null => null,
}));

import * as expoRouter from 'expo-router';
import Otp from '../app/(auth)/otp';
import { useOtpStore } from '../src/stores/otpStore';
import { useAuthStore } from '../src/stores/authStore';

const mockConfirm = vi.fn();

beforeEach(() => {
  setLocale('hi-IN');
  verifyOtpMock.mockReset();
  postAuthSessionMock.mockReset();
  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue(null);
  mockConfirm.mockReset();
  vi.mocked(expoRouter.router.replace).mockReset();
  vi.mocked(expoRouter.router.push).mockReset();
  useOtpStore.setState({ confirmation: null, phoneE164: null });
  useAuthStore.setState({ firebaseUser: null, user: null, idToken: null, loading: false });
});

describe('(auth)/otp.tsx', () => {
  it('renders Hindi title + CTA disabled until 6 digits entered', () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    const { getByText, getByTestId } = render(<Otp />);
    expect(getByText('OTP डालें')).toBeTruthy();
    const cta = getByTestId('otp-cta');
    expect(cta.hasAttribute('disabled')).toBe(true);
  });

  it('redirects to /phone if confirmation is null', () => {
    useOtpStore.setState({ confirmation: null, phoneE164: null });
    render(<Otp />);
    expect(expoRouter.router.replace).toHaveBeenCalledWith('/(auth)/phone');
  });

  it('on submit: verifyOtp + postAuthSession called; navigates to /(tabs)', async () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    verifyOtpMock.mockResolvedValue({ idToken: 'tok-123' });
    postAuthSessionMock.mockResolvedValue({
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test' },
      tenant: { id: 't1', slug: 'test', displayName: 'Test Shop' },
      requires_token_refresh: false,
    });

    const { getByTestId } = render(<Otp />);
    const input = getByTestId('otp-input');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(getByTestId('otp-cta'));

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalled());
    await waitFor(() => expect(postAuthSessionMock).toHaveBeenCalledWith('tok-123'));
    await waitFor(() =>
      expect(expoRouter.router.replace).toHaveBeenCalledWith('/(tabs)'),
    );
  });

  it('on wrong OTP: shows Toast with गलत OTP', async () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    verifyOtpMock.mockRejectedValue(new Error('auth/invalid-verification-code'));

    const { getByTestId, findByText } = render(<Otp />);
    const input = getByTestId('otp-input');
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(getByTestId('otp-cta'));

    const toast = await findByText(/गलत OTP/);
    expect(toast).toBeTruthy();
  });

  it('calls getIdToken(true) before navigation when requires_token_refresh is true', async () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    verifyOtpMock.mockResolvedValue({ idToken: 'tok-123' });
    postAuthSessionMock.mockResolvedValue({
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test' },
      tenant: { id: 't1', slug: 'test', displayName: 'Test Shop' },
      requires_token_refresh: true,
    });
    getIdTokenMock.mockResolvedValue('fresh-tok');

    const { getByTestId } = render(<Otp />);
    const input = getByTestId('otp-input');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(getByTestId('otp-cta'));

    await waitFor(() => expect(expoRouter.router.replace).toHaveBeenCalledWith('/(tabs)'));
    // getIdToken(true) must have been called (force-refresh) before navigation
    expect(getIdTokenMock).toHaveBeenCalledWith(true);
    const callOrder = getIdTokenMock.mock.invocationCallOrder[0];
    const navCallOrder = vi.mocked(expoRouter.router.replace).mock.invocationCallOrder[0];
    expect(callOrder).toBeLessThan(navCallOrder!);
  });

  it('does NOT call getIdToken(true) when requires_token_refresh is false', async () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    verifyOtpMock.mockResolvedValue({ idToken: 'tok-123' });
    postAuthSessionMock.mockResolvedValue({
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test' },
      tenant: { id: 't1', slug: 'test', displayName: 'Test Shop' },
      requires_token_refresh: false,
    });

    const { getByTestId } = render(<Otp />);
    const input = getByTestId('otp-input');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(getByTestId('otp-cta'));

    await waitFor(() => expect(expoRouter.router.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(getIdTokenMock).not.toHaveBeenCalledWith(true);
  });

  it('on too-many-requests error: shows locked Toast', async () => {
    useOtpStore.setState({
      confirmation: { confirm: mockConfirm },
      phoneE164: '+919876543210',
    });
    verifyOtpMock.mockRejectedValue(new Error('auth/too-many-requests'));

    const { getByTestId, findByText } = render(<Otp />);
    const input = getByTestId('otp-input');
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(getByTestId('otp-cta'));

    const toast = await findByText(/बहुत अधिक प्रयास/);
    expect(toast).toBeTruthy();
  });
});
