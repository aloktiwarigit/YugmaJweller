import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from './sentry-scrubber';
import type { ErrorEvent } from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ErrorEvent requires `type` to be undefined (it is an error event, not a transaction).
// Cast via unknown to avoid brittle type gymnastics — the scrubber only touches
// the fields it checks and the test verifies those fields.
function makeEvent(overrides: Record<string, unknown> = {}): ErrorEvent {
  return {
    event_id: 'abc123',
    level: 'error',
    message: 'Test error',
    ...overrides,
  } as unknown as ErrorEvent;
}

// ---------------------------------------------------------------------------
// PII scrubbing — phone numbers
// ---------------------------------------------------------------------------

describe('scrubSentryEvent – phone numbers', () => {
  it('redacts Indian mobile numbers in message (10 digits)', () => {
    const event = makeEvent({ message: 'User 9876543210 logged in' });
    const result = scrubSentryEvent(event);
    expect(result?.message).toBe('User [REDACTED_PHONE] logged in');
  });

  it('redacts phone with +91 country code', () => {
    const event = makeEvent({ message: 'OTP sent to +91 9876543210' });
    const result = scrubSentryEvent(event);
    expect(result?.message).not.toMatch(/9876543210/);
    expect(result?.message).toContain('[REDACTED_PHONE]');
  });

  it('redacts phone with +91 no space', () => {
    const event = makeEvent({ message: 'Customer +919876543210 registered' });
    const result = scrubSentryEvent(event);
    expect(result?.message).not.toMatch(/9876543210/);
  });

  it('does NOT redact 10-digit numbers that are not mobile (e.g. order IDs with letters)', () => {
    // Only sequences of exactly 10 digits are caught; order IDs contain letters
    const event = makeEvent({ message: 'Order ORD-12345 placed' });
    const result = scrubSentryEvent(event);
    expect(result?.message).toBe('Order ORD-12345 placed');
  });
});

// ---------------------------------------------------------------------------
// PII scrubbing — email addresses
// ---------------------------------------------------------------------------

describe('scrubSentryEvent – email addresses', () => {
  it('redacts email in message', () => {
    const event = makeEvent({ message: 'Email sent to customer@example.com' });
    const result = scrubSentryEvent(event);
    expect(result?.message).toBe('Email sent to [REDACTED_EMAIL]');
  });

  it('redacts email with subdomain', () => {
    const event = makeEvent({ message: 'Notification to priya@mail.example.co.in' });
    const result = scrubSentryEvent(event);
    expect(result?.message).not.toMatch(/priya@/);
  });
});

// ---------------------------------------------------------------------------
// PII scrubbing — customer names in extra/contexts
// ---------------------------------------------------------------------------

describe('scrubSentryEvent – customer names in extra data', () => {
  it('redacts customer_name field in extra', () => {
    const event = makeEvent({
      extra: { customer_name: 'Priya Sharma', order_id: 'ORD-001' },
    });
    const result = scrubSentryEvent(event);
    expect((result?.extra as Record<string, unknown>)?.customer_name).toBe('[REDACTED]');
    expect((result?.extra as Record<string, unknown>)?.order_id).toBe('ORD-001');
  });

  it('redacts name field in extra', () => {
    const event = makeEvent({
      extra: { name: 'Ramesh Kumar', count: 5 },
    });
    const result = scrubSentryEvent(event);
    expect((result?.extra as Record<string, unknown>)?.name).toBe('[REDACTED]');
    expect((result?.extra as Record<string, unknown>)?.count).toBe(5);
  });

  it('redacts address field in extra', () => {
    const event = makeEvent({
      extra: { address: '12 MG Road, Ayodhya', shop: 'anchor-dev' },
    });
    const result = scrubSentryEvent(event);
    expect((result?.extra as Record<string, unknown>)?.address).toBe('[REDACTED]');
    expect((result?.extra as Record<string, unknown>)?.shop).toBe('anchor-dev');
  });

  it('redacts OTP value in extra', () => {
    const event = makeEvent({
      extra: { otp: '123456', retry_count: 1 },
    });
    const result = scrubSentryEvent(event);
    expect((result?.extra as Record<string, unknown>)?.otp).toBe('[REDACTED]');
    expect((result?.extra as Record<string, unknown>)?.retry_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Non-PII fields are preserved
// ---------------------------------------------------------------------------

describe('scrubSentryEvent – non-PII fields preserved', () => {
  it('preserves tenant tag', () => {
    const event = makeEvent({ tags: { tenant: 'anchor-dev', runtime: 'nodejs' } });
    const result = scrubSentryEvent(event);
    expect(result?.tags?.['tenant']).toBe('anchor-dev');
    expect(result?.tags?.['runtime']).toBe('nodejs');
  });

  it('preserves event_id, level, stack frames structure', () => {
    const event = makeEvent({
      event_id: 'xyz789',
      level: 'fatal',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Something broke',
            stacktrace: { frames: [{ filename: 'app/page.tsx', lineno: 42 }] },
          },
        ],
      },
    });
    const result = scrubSentryEvent(event);
    expect(result?.event_id).toBe('xyz789');
    expect(result?.level).toBe('fatal');
    expect(result?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      'app/page.tsx',
    );
  });

  it('preserves URL path and request method', () => {
    const event = makeEvent({
      request: {
        url: 'https://shop.example.com/products/ring-001',
        method: 'GET',
        headers: { 'user-agent': 'Mozilla/5.0' },
      },
    });
    const result = scrubSentryEvent(event);
    expect(result?.request?.url).toBe('https://shop.example.com/products/ring-001');
    expect(result?.request?.method).toBe('GET');
  });

  it('returns null when passed null (drop-event signal)', () => {
    // Passing null means the calling beforeSend returned null to drop the event
    expect(scrubSentryEvent(null as unknown as ErrorEvent)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scrubbing inside request body strings
// ---------------------------------------------------------------------------

describe('scrubSentryEvent – PII in request data', () => {
  it('redacts phone in request data string', () => {
    const event = makeEvent({
      request: {
        url: '/api/v1/auth',
        data: 'phone=9876543210&otp=123456',
      },
    });
    const result = scrubSentryEvent(event);
    expect(String(result?.request?.data)).not.toMatch(/9876543210/);
  });
});
