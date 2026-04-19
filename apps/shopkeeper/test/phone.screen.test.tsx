import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';

// Mock auth-client.sendOtp — factory must not reference outer variables (vi.mock is hoisted)
const sendOtpMock = vi.fn();
vi.mock('@goldsmith/auth-client', () => ({
  sendOtp: (...args: unknown[]): unknown => sendOtpMock(...args),
  getIdToken: vi.fn().mockResolvedValue(null),
  auth: (): unknown => ({}),
}));

// Mock expo-router — same hoisting constraint; use module-level spies patched in beforeEach
vi.mock('expo-router', () => ({
  router: { replace: vi.fn(), push: vi.fn() },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Redirect: (): null => null,
}));

// Import after mocks are declared
// eslint-disable-next-line import/first -- must come after vi.mock declarations
import * as expoRouter from 'expo-router';
import Phone from '../app/(auth)/phone';
import { useOtpStore } from '../src/stores/otpStore';

beforeEach(() => {
  setLocale('hi-IN');
  sendOtpMock.mockReset();
  vi.mocked(expoRouter.router.push).mockReset();
  vi.mocked(expoRouter.router.replace).mockReset();
  useOtpStore.setState({ confirmation: null, phoneE164: null });
});

describe('(auth)/phone.tsx', () => {
  it('renders the Hindi title + CTA', () => {
    const { getByText } = render(<Phone />);
    expect(getByText('अपना फ़ोन नंबर डालें')).toBeTruthy();
    expect(getByText('आगे बढ़ें')).toBeTruthy();
  });

  it('disables CTA until 10 digits entered', () => {
    const { getByTestId } = render(<Phone />);
    const cta = getByTestId('phone-cta');
    // initial state: CTA is disabled (no phone entered)
    expect(cta.hasAttribute('disabled')).toBe(true);
  });

  it('calls sendOtp on CTA press when valid; navigates to otp', async () => {
    const confirmMock = vi.fn();
    sendOtpMock.mockResolvedValue({ confirmationId: 'abc', confirm: confirmMock });
    const { getByTestId } = render(<Phone />);
    const input = getByTestId('phone-input');
    fireEvent.change(input, { target: { value: '9876543210' } });
    const cta = getByTestId('phone-cta');
    fireEvent.click(cta);
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledWith('+919876543210'));
    expect(expoRouter.router.push).toHaveBeenCalledWith('/(auth)/otp');
  });

  it('shows Toast on sendOtp failure', async () => {
    sendOtpMock.mockRejectedValue(new Error('network'));
    const { getByTestId, findByText } = render(<Phone />);
    const input = getByTestId('phone-input');
    fireEvent.change(input, { target: { value: '9876543210' } });
    fireEvent.click(getByTestId('phone-cta'));
    const toast = await findByText(/OTP भेजने में त्रुटि/);
    expect(toast).toBeTruthy();
  });
});
