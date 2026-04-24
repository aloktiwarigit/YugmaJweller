// apps/api/test/rates-chaos.test.ts
//
// Chaos tests for the rates layer — unit-level with controlled failures.
// No Testcontainers needed: all infrastructure is replaced with in-process mocks.
//
// NOTE: ioredis-mock shares a global in-memory store across all instances within
// the same Node process. Each test calls redis.flushall() to start clean.
//
// Covers:
//   1. IBJA timeout → fallback to MetalsDev within budget
//   2. Both adapters fail → LKG cache serves stale rates (when pre-populated)
//   3. Both adapters fail → RatesUnavailableError when LKG is also empty
//   4. Redis unavailable → PricingService degrades gracefully (typed error, no crash)

import { describe, it, expect, beforeEach } from 'vitest';
import IoredisMock from 'ioredis-mock';
import {
  IbjaAdapter,
  MetalsDevAdapter,
  FallbackChain,
  CircuitBreaker,
  LastKnownGoodCache,
  RatesUnavailableError,
  type PurityRates,
} from '@goldsmith/rates';
import { PricingService } from '../src/modules/pricing/pricing.service';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-23T10:00:00.000Z');

const fakePurityRates: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n,  fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n,  fetchedAt: NOW },
};

// Shared ioredis-mock instance — flush before each test for isolation
const redis = new IoredisMock();

beforeEach(async () => {
  await redis.flushall();
});

// ---------------------------------------------------------------------------
// Adapter subclasses for chaos scenarios
// ---------------------------------------------------------------------------

/** IBJA adapter whose _fetch() takes 5100 ms — simulates a slow/hung primary */
class SlowIbjaAdapter extends IbjaAdapter {
  protected override async _fetch(): Promise<PurityRates> {
    await new Promise<void>((resolve) => setTimeout(resolve, 5_100));
    return super._fetch();
  }
}

/** Adapter that always rejects _fetch() with a plain Error */
class AlwaysFailingIbjaAdapter extends IbjaAdapter {
  protected override async _fetch(): Promise<never> {
    throw new Error('ibja always fails');
  }
}

/** MetalsDev-shaped adapter that always rejects */
class AlwaysFailingMetalsDevAdapter extends MetalsDevAdapter {
  protected override async _fetch(): Promise<never> {
    throw new Error('metalsdev always fails');
  }
}

// ---------------------------------------------------------------------------
// Helper: build FallbackChain from the given adapters
// ---------------------------------------------------------------------------

function buildChain(
  ibja: IbjaAdapter,
  metalsdev: MetalsDevAdapter,
): FallbackChain {
  const lkg = new LastKnownGoodCache(redis as never);
  const ibjaCb = new CircuitBreaker(ibja, redis as never);
  const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
  return new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
}

function makeNullPool(): Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// Chaos Test 1: IBJA times out (5s) → MetalsDev fallback within 10s
// ---------------------------------------------------------------------------

describe('Chaos: IBJA times out (5s) → MetalsDev fallback within 10s', () => {
  // This test intentionally takes ≥5 seconds because it uses a REAL wall-clock timer —
  // not fake timers. vi.useFakeTimers() would prevent the elapsed-time assertion
  // (elapsedMs > 5000) from ever being true. Do NOT add fake timers to this test.
  it('returns MetalsDev rates within 10 seconds after IBJA 5s timeout fires', async () => {
    const chain = buildChain(new SlowIbjaAdapter(), new MetalsDevAdapter());

    const start = Date.now();
    const result = await chain.getRatesByPurity();
    const elapsedMs = Date.now() - start;

    // Total elapsed must be >= 5000ms (IBJA timeout fired at 5s)
    expect(elapsedMs).toBeGreaterThan(5_000);
    // But must complete before our chaos-test budget (MetalsDev stub is fast)
    expect(elapsedMs).toBeLessThan(10_000);

    // IBJA timed out → FallbackChain fell through to MetalsDev
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.source).toBe('metalsdev');
  }, 15_000); // generous test timeout to accommodate the 5s timeout
});

// ---------------------------------------------------------------------------
// Chaos Test 2: Both adapters fail → LKG cache serves stale rates
// ---------------------------------------------------------------------------

describe('Chaos: Both adapters fail → LKG cache', () => {
  it('serves stale rates from LKG cache within 1 second when cache is pre-populated with stale data', async () => {
    // Seed LKG with data that is 31 minutes old → stale=true
    const staleDate = new Date(Date.now() - 31 * 60 * 1000);
    const staleEntry = {
      rates: {
        GOLD_24K: { perGramPaise: fakePurityRates.GOLD_24K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_24K.fetchedAt.toISOString() },
        GOLD_22K: { perGramPaise: fakePurityRates.GOLD_22K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_22K.fetchedAt.toISOString() },
        GOLD_20K: { perGramPaise: fakePurityRates.GOLD_20K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_20K.fetchedAt.toISOString() },
        GOLD_18K: { perGramPaise: fakePurityRates.GOLD_18K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_18K.fetchedAt.toISOString() },
        GOLD_14K: { perGramPaise: fakePurityRates.GOLD_14K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_14K.fetchedAt.toISOString() },
        SILVER_999: { perGramPaise: fakePurityRates.SILVER_999.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_999.fetchedAt.toISOString() },
        SILVER_925: { perGramPaise: fakePurityRates.SILVER_925.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_925.fetchedAt.toISOString() },
      },
      storedAt: staleDate.toISOString(),
    };
    await redis.set('rates:last_known_good', JSON.stringify(staleEntry), 'EX', 24 * 60 * 60);

    const chain = buildChain(
      new AlwaysFailingIbjaAdapter(),
      new AlwaysFailingMetalsDevAdapter(),
    );

    const start = Date.now();
    const result = await chain.getRatesByPurity();
    const elapsedMs = Date.now() - start;

    // Should resolve quickly from the in-memory LKG mock
    expect(elapsedMs).toBeLessThan(1_000);

    // LKG rates match what was seeded, and stale=true because storedAt is 31 min ago
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.source).toBe('last_known_good');
    expect(result.stale).toBe(true);
  });

  it('throws RatesUnavailableError when both adapters fail AND LKG cache is empty', async () => {
    // redis was flushed in beforeEach — LKG is empty
    const chain = buildChain(
      new AlwaysFailingIbjaAdapter(),
      new AlwaysFailingMetalsDevAdapter(),
    );

    await expect(chain.getRatesByPurity()).rejects.toBeInstanceOf(RatesUnavailableError);
  });
});

// ---------------------------------------------------------------------------
// Chaos Test 3: Redis unavailable → PricingService degrades gracefully
// ---------------------------------------------------------------------------

describe('Chaos: Redis unavailable → PricingService degrades gracefully', () => {
  it('getCurrentRates() rejects with a typed Error when Redis.get() fails — no unhandled crash', async () => {
    // Mock Redis that rejects every call
    const brokenRedis: Redis = {
      get: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      set: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      setex: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      del: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
    } as unknown as Redis;

    const pool = makeNullPool();
    // FallbackChain mock returns valid rates so we isolate to the Redis failure path
    const fallbackChain = {
      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
      getName: vi.fn().mockReturnValue('ibja'),
    };

    const service = new PricingService(pool, fallbackChain as never, brokenRedis);

    // getCurrentRates() calls redis.get — rejects with Error, not an unhandled rejection
    await expect(service.getCurrentRates()).rejects.toBeInstanceOf(Error);
  });

  it('refreshRates() rejects with a typed Error when Redis.setex() fails — no unhandled crash', async () => {
    const brokenRedis: Redis = {
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
      del: vi.fn().mockRejectedValue(new Error('Redis down')),
    } as unknown as Redis;

    const pool = makeNullPool();
    const fallbackChain = {
      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
      getName: vi.fn().mockReturnValue('ibja'),
    };

    const service = new PricingService(pool, fallbackChain as never, brokenRedis);

    // refreshRates() calls redis.setex first — expect typed Error, not a crash
    await expect(service.refreshRates()).rejects.toBeInstanceOf(Error);
  });
});
