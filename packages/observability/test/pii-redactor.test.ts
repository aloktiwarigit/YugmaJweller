import { describe, it, expect } from 'vitest';
import { redactPii } from '../src/pii-redactor';

describe('redactPii', () => {
  it('redacts phone (E.164)', () => {
    expect(redactPii({ phone: '+919876543210' })).toEqual({ phone: '[REDACTED:phone]' });
  });

  it('redacts pan (10-char ABCDE1234F pattern)', () => {
    expect(redactPii({ pan: 'ABCDE1234F' })).toEqual({ pan: '[REDACTED:pan]' });
  });

  it('redacts email', () => {
    expect(redactPii({ email: 'u@x.com' })).toEqual({ email: '[REDACTED:email]' });
  });

  it('redacts nested keys', () => {
    expect(redactPii({ user: { phone: '+919876543210', name: 'Ok' } })).toEqual({
      user: { phone: '[REDACTED:phone]', name: 'Ok' },
    });
  });

  it('redacts by key name even when value does not match pattern', () => {
    expect(redactPii({ phone: 'xyz' })).toEqual({ phone: '[REDACTED:phone]' });
  });

  it('leaves non-PII keys alone', () => {
    expect(redactPii({ shopId: 'abc', total: 123 })).toEqual({ shopId: 'abc', total: 123 });
  });
});
