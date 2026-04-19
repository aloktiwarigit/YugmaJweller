import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';

// Mock auth-client.sendOtp
const sendOtpMock = vi.fn();
vi.mock('@goldsmith/auth-client', () => ({
  sendOtp: sendOtpMock,
  getIdToken: vi.fn().mockResolvedValue(null),
  auth: (): unknown => ({}),
}));

// Mock expo-router
const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock('expo-router', () => ({
  router: { replace: replaceMock, push: pushMock },
  useRouter: (): { replace: typeof replaceMock; push: typeof pushMock } => ({
    replace: replaceMock,
    push: pushMock,
  }),
  Redirect: (): null => null,
}));

import Phone from '../app/(auth)/phone';
import { useOtpStore } from '../src/stores/otpStore';

beforeEach(() => {
  setLocale('hi-IN');
  sendOtpMock.mockReset();
  pushMock.mockReset();
  replaceMock.mockReset();
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
    expect(pushMock).toHaveBeenCalledWith('/(auth)/otp');
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
