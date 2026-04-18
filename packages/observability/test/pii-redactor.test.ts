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

  it('redacts display_name (shop_users column)', () => {
    expect(redactPii({ display_name: 'Rajesh Ji' })).toEqual({
      display_name: '[REDACTED:display_name]',
    });
  });

  it('redacts PII inside arrays of objects', () => {
    expect(redactPii([{ phone: '+91a' }, { email: 'b@x' }])).toEqual([
      { phone: '[REDACTED:phone]' },
      { email: '[REDACTED:email]' },
    ]);
  });

  it('preserves Error instances (stack + message intact)', () => {
    const err = new Error('db connection refused');
    const out = redactPii({ err });
    expect(out.err).toBe(err); // same reference — Error passes through
    expect((out.err as Error).message).toBe('db connection refused');
  });

  it('preserves Date instances (timestamp intact)', () => {
    const ts = new Date('2026-04-18T00:00:00Z');
    const out = redactPii({ ts });
    expect(out.ts).toBe(ts);
  });

  it('preserves Buffer instances (byte content intact)', () => {
    const buf = Buffer.from('hello', 'utf8');
    const out = redactPii({ buf });
    expect(out.buf).toBe(buf);
    expect((out.buf as Buffer).toString('utf8')).toBe('hello');
  });

  it('handles circular references without stack overflow', () => {
    const a: Record<string, unknown> = { phone: '+91' };
    a.self = a;
    const out = redactPii(a) as Record<string, unknown>;
    expect(out.phone).toBe('[REDACTED:phone]');
    expect(out.self).toBe('[Circular]');
  });

  it('redacts null value under PII key (key-based, not value-based)', () => {
    expect(redactPii({ phone: null })).toEqual({ phone: '[REDACTED:phone]' });
  });
});
