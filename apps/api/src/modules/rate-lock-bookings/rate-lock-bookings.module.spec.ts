import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { createRateLockPaymentsAdapter } from './rate-lock-bookings.module';

const ENV_KEYS = [
  'NODE_ENV',
  'PAYMENTS_ADAPTER',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

describe('createRateLockPaymentsAdapter', () => {
  let savedEnv: Partial<Record<typeof ENV_KEYS[number], string>>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('rejects the stub adapter in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENTS_ADAPTER'] = 'stub';

    expect(() => createRateLockPaymentsAdapter()).toThrow(
      'PAYMENTS_ADAPTER must be "razorpay" in production',
    );
  });

  it('requires razorpay adapter selection in production', () => {
    process.env['NODE_ENV'] = 'production';

    expect(() => createRateLockPaymentsAdapter()).toThrow(
      'PAYMENTS_ADAPTER must be "razorpay" in production',
    );
  });

  it('allows the stub adapter outside production', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['PAYMENTS_ADAPTER'] = 'stub';

    expect(createRateLockPaymentsAdapter()).toBeInstanceOf(StubPaymentsAdapter);
  });

  it('creates the razorpay adapter in production when explicitly configured', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENTS_ADAPTER'] = 'razorpay';
    process.env['RAZORPAY_KEY_ID'] = 'rzp_test_key';
    process.env['RAZORPAY_KEY_SECRET'] = 'rzp_test_secret';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = 'test-webhook-secret';

    expect(createRateLockPaymentsAdapter()).toBeInstanceOf(RazorpayAdapter);
  });
});
