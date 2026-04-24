/**
 * Story 4.1/4.2 — PricingService unit tests
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
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Mock withTenantTx (Story 4.2: setOverride/getActiveOverride use it)
// ---------------------------------------------------------------------------
const mockTxQuery = vi.fn();

vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(
    (_pool: unknown, fn: (tx: { query: typeof mockTxQuery }) => Promise<unknown>) =>
      fn({ query: mockTxQuery }),
  ),
  POISON_UUID: '00000000-0000-0000-0000-000000000000',
}));

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
    del: vi.fn().mockResolvedValue(1),
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

const fakeOwnerCtx: AuthenticatedTenantContext = {
  authenticated: true,
  shopId: 'shop-uuid-1',
  userId: 'user-uuid-1',
  role: 'shop_admin',
  tenant: { id: 'shop-uuid-1', slug: 'test-shop', display_name: 'Test Shop', status: 'ACTIVE' },
};

describe('PricingService', () => {
  let pool: ReturnType<typeof makePoolMock>;
  let redis: Redis & { get: Mock; set: Mock; setex: Mock; del: Mock };
  let fallbackChain: FallbackChain & { getRatesByPurity: Mock };
  let service: PricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTxQuery.mockReset();
    pool = makePoolMock();
    redis = makeRedisMock() as Redis & { get: Mock; set: Mock; setex: Mock; del: Mock };
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

  // -------------------------------------------------------------------------
  // setOverride()
  // -------------------------------------------------------------------------
  describe('setOverride()', () => {
    beforeEach(() => {
      (redis.get as Mock).mockResolvedValue(serializedRates);
      mockTxQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    });

    it('converts rupees string to paise correctly using Decimal (no float arithmetic)', async () => {
      await service.setOverride(fakeOwnerCtx, {
        purity: 'GOLD_22K',
        overrideRupees: '6842.50',
        reason: 'Festival pricing',
      });

      const insertCall = mockTxQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('shop_rate_overrides'),
      );
      expect(insertCall).toBeDefined();
      // 6842.50 rupees * 100 = 684250 paise (BigInt, no float error)
      expect(insertCall[1][2]).toBe(684250n);
    });

    it('inserts into shop_rate_overrides and logs PRICING_RATE_OVERRIDE_SET audit event', async () => {
      await service.setOverride(fakeOwnerCtx, {
        purity: 'GOLD_22K',
        overrideRupees: '6842',
        reason: 'Testing',
      });

      const queries = mockTxQuery.mock.calls as Array<[string, unknown[]]>;
      const overrideInsert = queries.find(([sql]) => sql.includes('shop_rate_overrides'));
      expect(overrideInsert).toBeDefined();

      const auditInsert = queries.find(([sql, params]) =>
        sql.includes('audit_events') &&
        Array.isArray(params) &&
        params.includes(AuditAction.PRICING_RATE_OVERRIDE_SET),
      );
      expect(auditInsert).toBeDefined();
    });

    it('invalidates Redis override cache for the shop+purity after insert', async () => {
      await service.setOverride(fakeOwnerCtx, {
        purity: 'GOLD_18K',
        overrideRupees: '5500',
        reason: 'Manual adjustment',
      });

      expect(redis.del).toHaveBeenCalledWith(
        `rates:override:${fakeOwnerCtx.shopId}:GOLD_18K`,
      );
    });

    it('uses validUntilIso when provided instead of end-of-day IST', async () => {
      const customUntil = '2026-04-25T10:00:00.000Z';
      await service.setOverride(fakeOwnerCtx, {
        purity: 'SILVER_999',
        overrideRupees: '95',
        reason: 'Spot test',
        validUntilIso: customUntil,
      });

      const insertCall = mockTxQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('shop_rate_overrides'),
      );
      expect(insertCall).toBeDefined();
      const validUntilArg = insertCall[1][5] as Date;
      expect(validUntilArg.toISOString()).toBe(customUntil);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveOverride()
  // -------------------------------------------------------------------------
  describe('getActiveOverride()', () => {
    it('returns null when no active override row in DB (Redis miss)', async () => {
      (redis.get as Mock).mockResolvedValue(null);
      mockTxQuery.mockResolvedValue({ rows: [] });

      const result = await service.getActiveOverride(fakeOwnerCtx, 'GOLD_22K');

      expect(result).toBeNull();
    });

    it('returns override from DB when Redis miss and row exists', async () => {
      (redis.get as Mock).mockResolvedValue(null);
      const validUntil = new Date(Date.now() + 3600 * 1000);
      mockTxQuery.mockResolvedValue({
        rows: [{ override_paise: 684250n, valid_until: validUntil, reason: 'Test' }],
      });

      const result = await service.getActiveOverride(fakeOwnerCtx, 'GOLD_22K');

      expect(result).not.toBeNull();
      expect(result!.overridePaise).toBe(684250n);
      expect(result!.reason).toBe('Test');
    });

    it('returns cached override from Redis on cache hit (no DB query)', async () => {
      const validUntil = new Date(Date.now() + 3600 * 1000);
      const cached = JSON.stringify({
        overridePaise: '684250',
        validUntil: validUntil.toISOString(),
        reason: 'Cached',
      });
      (redis.get as Mock).mockResolvedValue(cached);

      const result = await service.getActiveOverride(fakeOwnerCtx, 'GOLD_22K');

      expect(result).not.toBeNull();
      expect(result!.overridePaise).toBe(684250n);
      expect(result!.reason).toBe('Cached');
      expect(mockTxQuery).not.toHaveBeenCalled();
    });

    it('ignores expired rows (DB filters valid_until > now())', async () => {
      (redis.get as Mock).mockResolvedValue(null);
      mockTxQuery.mockResolvedValue({ rows: [] });

      const result = await service.getActiveOverride(fakeOwnerCtx, 'GOLD_14K');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getRateHistory()
  // -------------------------------------------------------------------------
  describe('getRateHistory()', () => {
    function makeSnapshot(fetched_at: Date, extra: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
      return {
        fetched_at,
        source: 'ibja',
        stale: false,
        gold_24k_paise: 735000n,
        gold_22k_paise: 673750n,
        gold_20k_paise: 612500n,
        gold_18k_paise: 551250n,
        gold_14k_paise: 428750n,
        silver_999_paise: 9500n,
        silver_925_paise: 8788n,
        ...extra,
      };
    }

    it('buckets multiple snapshots per day to last-of-day (highest fetched_at per day)', async () => {
      // Simulate the DB returning already-bucketed rows (the DISTINCT ON handles this in DB).
      // We verify the service maps them to RateHistoryPoint with the correct paise value.
      const day1 = new Date('2026-03-26T18:00:00Z'); // last snapshot of the day
      pool._client.query.mockResolvedValueOnce({ rows: [makeSnapshot(day1)] });

      const result = await service.getRateHistory('30d', 'GOLD_22K');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-03-26');
      expect(result[0].perGramPaise).toBe('673750');
      expect(result[0].source).toBe('ibja');
      expect(result[0].stale).toBe(false);
    });

    it('selects the correct paise column for each purity key', async () => {
      const row = makeSnapshot(new Date('2026-03-26T10:00:00Z'));
      pool._client.query.mockResolvedValue({ rows: [row] });

      const cases: Array<[import('@goldsmith/shared').PurityKey, string]> = [
        ['GOLD_24K', '735000'],
        ['GOLD_22K', '673750'],
        ['GOLD_20K', '612500'],
        ['GOLD_18K', '551250'],
        ['GOLD_14K', '428750'],
        ['SILVER_999', '9500'],
        ['SILVER_925', '8788'],
      ];

      for (const [purity, expected] of cases) {
        pool._client.query.mockResolvedValue({ rows: [row] });
        const result = await service.getRateHistory('30d', purity);
        expect(result[0].perGramPaise).toBe(expected);
      }
    });

    it('maps range to correct number of days in the query parameter', async () => {
      pool._client.query.mockResolvedValue({ rows: [] });

      await service.getRateHistory('30d', 'GOLD_22K');
      let calls = (pool._client.query as import('vitest').Mock).mock.calls;
      expect(calls[calls.length - 1][1][0]).toBe(30);

      pool._client.query.mockResolvedValue({ rows: [] });
      await service.getRateHistory('90d', 'GOLD_22K');
      calls = (pool._client.query as import('vitest').Mock).mock.calls;
      expect(calls[calls.length - 1][1][0]).toBe(90);

      pool._client.query.mockResolvedValue({ rows: [] });
      await service.getRateHistory('365d', 'GOLD_22K');
      calls = (pool._client.query as import('vitest').Mock).mock.calls;
      expect(calls[calls.length - 1][1][0]).toBe(365);
    });

    it('formats perGramRupees as Indian number format', async () => {
      const row = makeSnapshot(new Date('2026-03-26T10:00:00Z'), { gold_22k_paise: 673750n });
      pool._client.query.mockResolvedValue({ rows: [row] });

      const result = await service.getRateHistory('30d', 'GOLD_22K');

      // 673750 paise = ₹6737.50 → en-IN format: "6,737.50"
      expect(result[0].perGramRupees).toBe('6,737.50');
    });

    it('returns multiple points sorted by date ASC', async () => {
      const rows = [
        makeSnapshot(new Date('2026-03-26T10:00:00Z'), { gold_22k_paise: 673750n }),
        makeSnapshot(new Date('2026-03-27T10:00:00Z'), { gold_22k_paise: 675000n }),
      ];
      pool._client.query.mockResolvedValue({ rows });

      const result = await service.getRateHistory('30d', 'GOLD_22K');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-03-26');
      expect(result[1].date).toBe('2026-03-27');
      expect(result[1].perGramPaise).toBe('675000');
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentRatesForTenant()
  // -------------------------------------------------------------------------
  describe('getCurrentRatesForTenant()', () => {
    it('returns empty overriddenPurities when no overrides active', async () => {
      (redis.get as Mock)
        .mockResolvedValueOnce(serializedRates) // getCurrentRates call
        .mockResolvedValue(null); // all 7 getActiveOverride calls
      mockTxQuery.mockResolvedValue({ rows: [] });

      const result = await service.getCurrentRatesForTenant(fakeOwnerCtx);

      expect(result.overriddenPurities).toHaveLength(0);
      expect(result.GOLD_22K.perGramPaise).toBe(673750n);
    });

    it('applies override for overridden purity and leaves others unchanged', async () => {
      const validUntil = new Date(Date.now() + 3600 * 1000);
      (redis.get as Mock).mockImplementation((key: string) => {
        if (key === 'rates:current') return Promise.resolve(serializedRates);
        if (key === `rates:override:${fakeOwnerCtx.shopId}:GOLD_22K`) {
          return Promise.resolve(
            JSON.stringify({ overridePaise: '700000', validUntil: validUntil.toISOString(), reason: 'Override' }),
          );
        }
        return Promise.resolve(null);
      });
      mockTxQuery.mockResolvedValue({ rows: [] });

      const result = await service.getCurrentRatesForTenant(fakeOwnerCtx);

      expect(result.GOLD_22K.perGramPaise).toBe(700000n);
      expect(result.overriddenPurities).toContain('GOLD_22K');
      expect(result.GOLD_24K.perGramPaise).toBe(735000n);
      expect(result.overriddenPurities).not.toContain('GOLD_24K');
    });
  });
});
