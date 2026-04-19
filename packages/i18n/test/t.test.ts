import { describe, it, expect, vi, beforeEach } from 'vitest';
import { t, setLocale } from '../src';

describe('t()', () => {
  beforeEach(() => setLocale('hi-IN'));

  it('returns Hindi value for known key in hi-IN default locale', () => {
    expect(t('auth.phone.title')).toBe('अपना फ़ोन नंबर डालें');
  });
  it('interpolates variables', () => {
    expect(t('auth.otp.resend_in', { seconds: '00:45' })).toBe('पुनः भेजें (00:45)');
  });
  it('missing key returns [ns.key] and logs warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('auth.does_not.exist')).toBe('[auth.does_not.exist]');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('setLocale("en-IN") switches locale for subsequent calls', () => {
    setLocale('en-IN');
    expect(t('auth.phone.title')).toBe('Enter your phone number');
  });
});
