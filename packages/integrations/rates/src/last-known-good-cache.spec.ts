import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { LastKnownGoodCache } from './last-known-good-cache';
import type { PurityRates } from './port';

const STUB_RATES: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
};

describe('LastKnownGoodCache', () => {
  let redis: Redis;
  let cache: LastKnownGoodCache;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock shares context across instances with the same host:port/db.
    // Flush the shared store before each test to ensure clean state.
    await redis.flushall();
    cache = new LastKnownGoodCache(redis);
  });

  it('get() returns null when cache is empty', async () => {
    const result = await cache.get();
    expect(result).toBeNull();
  });

  it('update() + get() round-trip returns correct PurityRates', async () => {
    await cache.update(STUB_RATES);
    const result = await cache.get();

    expect(result).not.toBeNull();
    expect(result!.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result!.rates.GOLD_22K.perGramPaise).toBe(673750n);
    expect(result!.rates.GOLD_20K.perGramPaise).toBe(612500n);
    expect(result!.rates.GOLD_18K.perGramPaise).toBe(551250n);
    expect(result!.rates.GOLD_14K.perGramPaise).toBe(428750n);
    expect(result!.rates.SILVER_999.perGramPaise).toBe(9500n);
    expect(result!.rates.SILVER_925.perGramPaise).toBe(8788n);
  });

  it('stale=false when stored within 30 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));

    await cache.update(STUB_RATES);

    // Advance by 29 minutes
    vi.advanceTimersByTime(29 * 60 * 1000);

    const result = await cache.get();
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(false);

    vi.useRealTimers();
  });

  it('stale=true when stored more than 30 minutes ago', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));

    await cache.update(STUB_RATES);

    // Advance by 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);

    const result = await cache.get();
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);

    vi.useRealTimers();
  });
});
