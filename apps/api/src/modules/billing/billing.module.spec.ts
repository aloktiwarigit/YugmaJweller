import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { FactoryProvider } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';

vi.mock('../inventory/inventory.module', () => ({
  InventoryModule: class InventoryModule {},
}));

const ENV_KEYS = [
  'NODE_ENV',
  'PAYMENTS_ADAPTER',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

let BillingModule: typeof import('./billing.module').BillingModule;

function getFactory(token: string): () => unknown {
  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BillingModule) as unknown[];
  const provider = providers.find((candidate): candidate is FactoryProvider => (
    typeof candidate === 'object' &&
    candidate !== null &&
    'provide' in candidate &&
    (candidate as { provide: unknown }).provide === token
  ));

  if (!provider || typeof provider.useFactory !== 'function') {
    throw new Error(`Factory provider not found for ${token}`);
  }
  return provider.useFactory as () => unknown;
}

describe('BillingModule PAYMENTS_ADAPTER provider', () => {
  let savedEnv: Partial<Record<typeof ENV_KEYS[number], string>>;

  beforeAll(async () => {
    ({ BillingModule } = await import('./billing.module'));
  });

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

    expect(() => getFactory('PAYMENTS_ADAPTER')()).toThrow(
      'PAYMENTS_ADAPTER must be "razorpay" in production',
    );
  });

  it('requires razorpay adapter selection in production', () => {
    process.env['NODE_ENV'] = 'production';

    expect(() => getFactory('PAYMENTS_ADAPTER')()).toThrow(
      'PAYMENTS_ADAPTER must be "razorpay" in production',
    );
  });

  it('allows the stub adapter outside production', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['PAYMENTS_ADAPTER'] = 'stub';

    expect(getFactory('PAYMENTS_ADAPTER')()).toBeInstanceOf(StubPaymentsAdapter);
  });

  it('creates the razorpay adapter in production when explicitly configured', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PAYMENTS_ADAPTER'] = 'razorpay';
    process.env['RAZORPAY_KEY_ID'] = 'rzp_test_key';
    process.env['RAZORPAY_KEY_SECRET'] = 'rzp_test_secret';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = 'test-webhook-secret';

    expect(getFactory('PAYMENTS_ADAPTER')()).toBeInstanceOf(RazorpayAdapter);
  });
});
