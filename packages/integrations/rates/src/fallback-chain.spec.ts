import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { FallbackChain } from './fallback-chain';
import { LastKnownGoodCache } from './last-known-good-cache';
import { RatesAdapterError, RatesUnavailableError } from './errors';
import type { RatesPort, PurityRates } from './port';

const STUB_RATES: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date() },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date() },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date() },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date() },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date() },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date() },
};

function makeAdapter(name: string, impl: () => Promise<PurityRates>): RatesPort {
  return { getName: () => name, getRatesByPurity: impl };
}

const noopLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('FallbackChain', () => {
  let redis: Redis;
  let lkg: LastKnownGoodCache;
  let primarySuccess: RatesPort;
  let adapterFail: RatesPort;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock shares context across instances with the same host:port/db.
    // Flush the shared store before each test to ensure clean state.
    await redis.flushall();
    lkg = new LastKnownGoodCache(redis);
    primarySuccess = makeAdapter('ibja', async () => STUB_RATES);
    adapterFail = makeAdapter('fail', async () => {
      throw new RatesAdapterError('fail', new Error('network error'));
    });
    vi.clearAllMocks();
  });

  it('primary success: returns rates, no fallback called', async () => {
    const secondary = makeAdapter('metalsdev', async () => {
      throw new Error('should not be called');
    });
    const secondarySpy = vi.spyOn(secondary, 'getRatesByPurity');

    const chain = new FallbackChain(primarySuccess, secondary, lkg, noopLogger);
    const rates = await chain.getRatesByPurity();

    expect(rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(secondarySpy).not.toHaveBeenCalled();
  });

  it('primary fails: secondary called, returns rates', async () => {
    const secondarySuccess = makeAdapter('metalsdev', async () => STUB_RATES);
    const secondarySpy = vi.spyOn(secondarySuccess, 'getRatesByPurity');

    const chain = new FallbackChain(adapterFail, secondarySuccess, lkg, noopLogger);
    const rates = await chain.getRatesByPurity();

    expect(rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(secondarySpy).toHaveBeenCalledOnce();
  });

  it('both adapters fail: LastKnownGoodCache returns stale rates with stale:true', async () => {
    // Pre-populate the cache
    await lkg.update(STUB_RATES);

    // Use fake timers to make cache stale
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);

    const chain = new FallbackChain(adapterFail, adapterFail, lkg, noopLogger);
    const rates = await chain.getRatesByPurity();

    expect(rates.GOLD_24K.perGramPaise).toBe(735000n);

    vi.useRealTimers();
  });

  it('all sources fail: throws RatesUnavailableError', async () => {
    // Empty cache (nothing stored)
    const chain = new FallbackChain(adapterFail, adapterFail, lkg, noopLogger);
    await expect(chain.getRatesByPurity()).rejects.toBeInstanceOf(RatesUnavailableError);
  });

  it('successful primary fetch: updates LastKnownGoodCache', async () => {
    const updateSpy = vi.spyOn(lkg, 'update');

    const chain = new FallbackChain(primarySuccess, adapterFail, lkg, noopLogger);
    await chain.getRatesByPurity();

    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy).toHaveBeenCalledWith(STUB_RATES);
  });
});
