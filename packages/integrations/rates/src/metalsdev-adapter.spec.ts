import { describe, it, expect } from 'vitest';
import { MetalsDevAdapter } from './metalsdev-adapter';
import { MetalsDevUnavailableError } from './errors';

describe('MetalsDevAdapter', () => {
  it('getName() returns "metalsdev"', () => {
    const adapter = new MetalsDevAdapter();
    expect(adapter.getName()).toBe('metalsdev');
  });

  it('throws MetalsDevUnavailableError when METALSDEV_KEY is not configured', async () => {
    const adapter = new MetalsDevAdapter();
    await expect(adapter.getRatesByPurity()).rejects.toBeInstanceOf(MetalsDevUnavailableError);
  });

  it('MetalsDevUnavailableError is a RatesAdapterError', async () => {
    const { RatesAdapterError } = await import('./errors');
    const err = new MetalsDevUnavailableError();
    expect(err).toBeInstanceOf(RatesAdapterError);
    expect(err.adapter).toBe('metalsdev');
  });
});
