import { describe, it, expect } from 'vitest';
import { validateHuidFormat } from '../src/huid/validate';

describe('validateHuidFormat', () => {
  it('accepts a valid 6-char uppercase alphanumeric', () => {
    expect(validateHuidFormat('AB1234')).toEqual({ valid: true });
  });

  it('auto-uppercases lowercase input before validating', () => {
    expect(validateHuidFormat('ab1234')).toEqual({ valid: true });
  });

  it('rejects fewer than 6 chars', () => {
    const r = validateHuidFormat('AB123');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('HUID must be 6 uppercase alphanumeric characters');
  });

  it('rejects more than 6 chars', () => {
    expect(validateHuidFormat('AB12345').valid).toBe(false);
  });

  it('rejects special characters', () => {
    expect(validateHuidFormat('AB12-4').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateHuidFormat('').valid).toBe(false);
  });

  it('accepts all-digits', () => {
    expect(validateHuidFormat('123456')).toEqual({ valid: true });
  });

  it('accepts all-letters', () => {
    expect(validateHuidFormat('ABCDEF')).toEqual({ valid: true });
  });
});
