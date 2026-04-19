import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/normalize-phone';

describe('normalizePhone', () => {
  it('accepts +91 prefix unchanged', () => {
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });
  it('prepends +91 to a 10-digit input', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });
  it('strips spaces and hyphens before validating', () => {
    expect(normalizePhone('98765-43210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
  });
  it('throws auth-client.invalid_phone on an empty string', () => {
    expect(() => normalizePhone('')).toThrow('auth-client.invalid_phone');
  });
  it('throws auth-client.invalid_phone on non-E.164 with wrong country code', () => {
    expect(() => normalizePhone('+1234')).toThrow('auth-client.invalid_phone');
  });
  it('throws auth-client.invalid_phone on 9-digit input', () => {
    expect(() => normalizePhone('987654321')).toThrow('auth-client.invalid_phone');
  });
  it('throws auth-client.invalid_phone on letters', () => {
    expect(() => normalizePhone('abcdefghij')).toThrow('auth-client.invalid_phone');
  });
});
