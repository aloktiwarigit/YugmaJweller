import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInMock = vi.fn();
vi.mock('@react-native-firebase/auth', () => ({
  default: (): { signInWithPhoneNumber: typeof signInMock } => ({ signInWithPhoneNumber: signInMock }),
}));

import { sendOtp } from '../src/sendOtp';

describe('sendOtp', () => {
  beforeEach(() => signInMock.mockReset());

  it('normalizes 10-digit input to +91 prefix before calling Firebase', async () => {
    signInMock.mockResolvedValue({ confirmationId: 'abc' });
    await sendOtp('9876543210');
    expect(signInMock).toHaveBeenCalledWith('+919876543210');
  });

  it('passes +91-prefixed input through unchanged', async () => {
    signInMock.mockResolvedValue({ confirmationId: 'abc' });
    await sendOtp('+919876543210');
    expect(signInMock).toHaveBeenCalledWith('+919876543210');
  });

  it('returns the confirmation handle from Firebase', async () => {
    const handle = { confirmationId: 'abc', confirm: vi.fn() };
    signInMock.mockResolvedValue(handle);
    await expect(sendOtp('9876543210')).resolves.toBe(handle);
  });

  it('throws auth-client.invalid_phone on bad input before calling Firebase', async () => {
    await expect(sendOtp('abc')).rejects.toThrow('auth-client.invalid_phone');
    expect(signInMock).not.toHaveBeenCalled();
  });
});
