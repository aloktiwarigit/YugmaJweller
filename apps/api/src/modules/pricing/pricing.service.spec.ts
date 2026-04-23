/**
 * Story 4.1 WS-C — PricingService unit tests (RED phase)
 * Run: pnpm --filter @goldsmith/api test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { RatesUnavailableError } from '@goldsmith/rates';
import type { PurityRates, RatesResult } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
import { PricingService } from './pricing.service';
import type { FallbackChain } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-23T10:00:00.000Z');

const fakePurityRates: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
};

const serializedRates = JSON.stringify({
  GOLD_24K: { perGramPaise: '735000', fetchedAt: NOW.toISOString() },
  GOLD_22K: { perGramPaise: '673750', fetchedAt: NOW.toISOString() },
  GOLD_20K: { perGramPaise: '612500', fetchedAt: NOW.toISOString() },
  GOLD_18K: { perGramPaise: '551250', fetchedAt: NOW.toISOString() },
  GOLD_14K: { perGramPaise: '428750', fetchedAt: NOW.toISOString() },
  SILVER_999: { perGramPaise: '9500', fetchedAt: NOW.toISOString() },
  SILVER_925: { perGramPaise: '8788', fetchedAt: NOW.toISOString() },
  stale: false,
  source: 'ibja',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoolMock() {
  const client = {
    query: vi.fn()
      .mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  } as unknown as Pool & { _client: typeof client };
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

const fakeRatesResult: RatesResult = {
  rates: fakePurityRates,
  source: 'ibja',
  stale: false,
};

function makeFallbackChainMock() {
  return {
    getRatesByPurity: vi.fn().mockResolvedValue(fakeRatesResult),
    getName: vi.fn().mockReturnValue('fallback-chain'),
  } as unknown as FallbackChain;
}

function makeService(
  pool: Pool,
  fallbackChain: FallbackChain,
  redis: Redis,
) {
  return new PricingService(pool, fallbackChain, redis);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PricingService', () => {
  let pool: ReturnType<typeof makePoolMock>;
  let redis: Redis & { get: Mock; set: Mock; setex: Mock };
  let fallbackChain: FallbackChain & { getRatesByPurity: Mock };
  let service: PricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = makePoolMock();
    redis = makeRedisMock() as Redis & { get: Mock; set: Mock; setex: Mock };
    fallbackChain = makeFallbackChainMock() as FallbackChain & { getRatesByPurity: Mock };
    service = makeService(pool as unknown as Pool, fallbackChain, redis);
  });

  // -------------------------------------------------------------------------
  // refreshRates()
  // -------------------------------------------------------------------------
  describe('refreshRates()', () => {
    it('inserts a snapshot row into ibja_rate_snapshots', async () => {
      await service.refreshRates();

      // pool.connect() should have been called for the insert
      expect(pool.connect).toHaveBeenCalled();
      // The client.query should have been called with an INSERT
      const calls = (pool._client.query as Mock).mock.calls as Array<[string, ...unknown[]]>;
      const insertCall = calls.find(([sql]) => typeof sql === 'string' && sql.includes('ibja_rate_snapshots'));
      expect(insertCall).toBeDefined();
    });

    it('writes rates:current to Redis with 30-min TTL (1800s)', async () => {
      await service.refreshRates();

      expect(redis.setex).toHaveBeenCalledWith(
        'rates:current',
        1800,
        expect.any(String),
      );
    });

    it('logs PRICING_RATES_REFRESHED audit event', async () => {
      await service.refreshRates();

      // The INSERT into platform_audit_events or direct pool call must have happened
      // We verify audit is logged by checking pool.connect was used for audit
      const connectCalls = (pool.connect as Mock).mock.calls.length;
      expect(connectCalls).toBeGreaterThanOrEqual(1);

      // Verify the action written matches PRICING_RATES_REFRESHED
      const clientCalls = (pool._client.query as Mock).mock.calls as Array<[string, unknown[]]>;
      const auditCall = clientCalls.find(([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes('platform_audit_events') &&
        Array.isArray(params) &&
        params.includes(AuditAction.PRICING_RATES_REFRESHED),
      );
      expect(auditCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentRates()
  // -------------------------------------------------------------------------
  describe('getCurrentRates()', () => {
    it('returns cached rates from Redis when cache hit (does NOT call FallbackChain)', async () => {
      (redis.get as Mock).mockResolvedValue(serializedRates);

      const result = await service.getCurrentRates();

      expect(fallbackChain.getRatesByPurity).not.toHaveBeenCalled();
      expect(result.GOLD_24K.perGramPaise).toBe(735000n);
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
    });

    it('calls FallbackChain when cache miss and caches result with 15-min TTL (900s)', async () => {
      (redis.get as Mock).mockResolvedValue(null);

      await service.getCurrentRates();

      expect(fallbackChain.getRatesByPurity).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(
        'rates:current',
        900,
        expect.any(String),
      );
    });

    it('throws RatesUnavailableError when FallbackChain throws', async () => {
      (redis.get as Mock).mockResolvedValue(null);
      (fallbackChain.getRatesByPurity as Mock).mockRejectedValue(new RatesUnavailableError());

      await expect(service.getCurrentRates()).rejects.toThrow(RatesUnavailableError);
    });
  });
});
