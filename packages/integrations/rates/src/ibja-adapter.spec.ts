import { describe, it, expect, vi } from 'vitest';
import { IbjaAdapter } from './ibja-adapter';
import { RatesAdapterError } from './errors';

describe('IbjaAdapter', () => {
  it('returns correct paise values for all purities', async () => {
    const adapter = new IbjaAdapter();
    const result = await adapter.getRatesByPurity();

    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.rates.GOLD_22K.perGramPaise).toBe(673750n);
    expect(result.rates.GOLD_20K.perGramPaise).toBe(612500n);
    expect(result.rates.GOLD_18K.perGramPaise).toBe(551250n);
    expect(result.rates.GOLD_14K.perGramPaise).toBe(428750n);
    expect(result.rates.SILVER_999.perGramPaise).toBe(9500n);
    expect(result.rates.SILVER_925.perGramPaise).toBe(8788n);
    expect(result.rates.GOLD_24K.fetchedAt).toBeInstanceOf(Date);
    expect(result.source).toBe('ibja');
    expect(result.stale).toBe(false);
  });

  it('getName() returns "ibja"', () => {
    const adapter = new IbjaAdapter();
    expect(adapter.getName()).toBe('ibja');
  });

  it('throws RatesAdapterError on network timeout', async () => {
    const adapter = new IbjaAdapter();
    // Override the internal fetch to simulate a timeout
    vi.spyOn(adapter as unknown as { _fetch: () => Promise<unknown> }, '_fetch').mockRejectedValueOnce(
      new Error('timeout'),
    );
    await expect(adapter.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    vi.restoreAllMocks();
  });
});
