/**
 * sentry.test.ts — Unit tests for PII scrubber and phone-hash utility.
 *
 * Story 19.2 AC:
 *   - Phone numbers, OTP codes, addresses, customer names are redacted
 *   - Non-PII fields are preserved
 *   - Phone hash is deterministic and 12 chars
 */

import { describe, it, expect } from 'vitest';
import { scrubString, scrubEvent, hashPhone } from './sentry';
import type { Event } from '@sentry/react-native';

/** Minimal EventHint shape for tests — mirrors sentry.ts inline type */
type TestEventHint = Record<string, unknown>;

// ── scrubString ──────────────────────────────────────────────────────────────

describe('scrubString', () => {
  it('redacts E.164 Indian phone numbers', () => {
    expect(scrubString('Call +919876543210 now')).toBe('Call [phone-redacted] now');
  });

  it('redacts plain 10-digit Indian mobile numbers', () => {
    expect(scrubString('Mobile: 9876543210')).toBe('Mobile: [phone-redacted]');
  });

  it('does NOT redact non-mobile 10-digit numbers (e.g. invoice IDs starting with 1)', () => {
    // Invoice IDs like 1234567890 don't start with 6-9
    const result = scrubString('Invoice 1234567890');
    expect(result).toBe('Invoice 1234567890');
  });

  it('redacts OTP patterns', () => {
    expect(scrubString('otp: 123456')).toContain('[otp-redacted]');
    expect(scrubString('code=4521')).toContain('[otp-redacted]');
  });

  it('redacts street address patterns', () => {
    const result = scrubString('Address: 12 Ram Nagar Colony');
    expect(result).toContain('[address-redacted]');
  });

  it('preserves non-PII strings', () => {
    const safe = 'Product: Gold Ring 22KT, SKU: GR-001, Weight: 5.200g';
    expect(scrubString(safe)).toBe(safe);
  });

  it('is idempotent on already-redacted strings', () => {
    const redacted = 'Phone: [phone-redacted], OTP: [otp-redacted]';
    expect(scrubString(redacted)).toBe(redacted);
  });
});

// ── scrubEvent ───────────────────────────────────────────────────────────────

describe('scrubEvent', () => {
  const hint = {} as TestEventHint;

  it('redacts PII key values in extra data', () => {
    const event: Event = {
      extra: {
        phone: '+919876543210',
        customerName: 'Ramesh Kumar',
        otp: '123456',
        nonPii: 'safe-value',
      },
    };
    const result = scrubEvent(event, hint);
    expect(result?.extra?.['phone']).toBe('[redacted]');
    expect(result?.extra?.['customerName']).toBe('[redacted]');
    expect(result?.extra?.['otp']).toBe('[redacted]');
    expect(result?.extra?.['nonPii']).toBe('safe-value');
  });

  it('redacts PII in exception values (string scrub)', () => {
    const event: Event = {
      exception: {
        values: [
          {
            value: 'Error for user +919876543210 with otp: 654321',
            type: 'Error',
          },
        ],
      },
    };
    const result = scrubEvent(event, hint);
    const value = result?.exception?.values?.[0]?.value ?? '';
    expect(value).not.toContain('+919876543210');
    expect(value).toContain('[phone-redacted]');
  });

  it('does not mutate the original event object', () => {
    const event: Event = { extra: { phone: '+919876543210' } };
    const original = JSON.stringify(event);
    scrubEvent(event, hint);
    expect(JSON.stringify(event)).toBe(original);
  });

  it('returns non-null (never drops events)', () => {
    const event: Event = { message: 'hello' };
    expect(scrubEvent(event, hint)).not.toBeNull();
  });

  it('handles nested PII keys', () => {
    const event: Event = {
      extra: {
        customer: {
          phoneE164: '+919876543210',
          address: '5 MG Road',
          productSku: 'GR-001',
        },
      },
    };
    const result = scrubEvent(event, hint);
    const customer = result?.extra?.['customer'] as Record<string, unknown>;
    expect(customer['phoneE164']).toBe('[redacted]');
    expect(customer['productSku']).toBe('GR-001');
  });

  it('handles null/undefined gracefully', () => {
    const event: Event = { extra: { nullVal: null, undefinedVal: undefined } };
    expect(() => scrubEvent(event, hint)).not.toThrow();
  });
});

// ── hashPhone ────────────────────────────────────────────────────────────────

describe('hashPhone', () => {
  // jsdom provides crypto.subtle via the Web Crypto API
  it('returns a 12-char hex string', async () => {
    const hash = await hashPhone('+919876543210');
    expect(hash).toHaveLength(12);
    expect(/^[0-9a-f]{12}$/.test(hash)).toBe(true);
  });

  it('is deterministic — same phone always produces same hash', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('+919876543210');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different phones', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('+919876543211');
    expect(h1).not.toBe(h2);
  });

  it('trims whitespace before hashing', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('  +919876543210  ');
    expect(h1).toBe(h2);
  });

  it('returns hash-unavail when crypto.subtle is unavailable', async () => {
    const original = global.crypto;
    // jsdom defines crypto as a read-only getter on globalThis.
    // Override via Object.defineProperty to bypass the getter restriction.
    Object.defineProperty(global, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const hash = await hashPhone('+919876543210');
    expect(hash).toBe('hash-unavail');
    Object.defineProperty(global, 'crypto', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
