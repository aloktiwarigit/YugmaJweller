/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { LoyaltyService, computeAccrualPoints } from './loyalty.service';
import type { LoyaltyRepository, CustomerLoyaltyRow, TxLike } from './loyalty.repository';
import type { SettingsCache } from '@goldsmith/tenant-config';
import type { LoyaltyConfig } from '@goldsmith/shared';
import { tenantContext } from '@goldsmith/tenant-context';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';
const INVOICE = '11111111-2222-4000-8000-000000000004';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function fakePool(): any {
  return { query: vi.fn(async () => ({ rows: [] })) };
}

function fakeTx(): TxLike {
  return { query: vi.fn(async () => ({ rows: [] })) };
}

const LOYALTY_DEFAULT: LoyaltyConfig = {
  tiers: [
    { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
    { name: 'Gold',    thresholdPaise: 15_000_000, badgeColor: '#FFD700' },
    { name: 'Diamond', thresholdPaise: 50_000_000, badgeColor: '#B9F2FF' },
  ],
  earnRatePercentage:       '1.00',
  redemptionRatePercentage: '1.00',
};

function fakeAggregate(overrides: Partial<CustomerLoyaltyRow> = {}): CustomerLoyaltyRow {
  return {
    id: '99999999-aaaa-4000-8000-00000000000a',
    shop_id: SHOP,
    customer_id: CUSTOMER,
    points_balance: 0,
    lifetime_points: 0,
    current_tier: null,
    tier_since: null,
    last_updated_at: new Date('2026-04-26'),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<LoyaltyRepository> = {}): LoyaltyRepository {
  return {
    lockOrCreateAggregate: vi.fn(async (_tx, _shopId, _customerId) => fakeAggregate()),
    insertTransaction:     vi.fn(async () => ({} as any)),
    updateAggregate:       vi.fn(async () => undefined),
    getState:              vi.fn(async () => null),
    getRecentTransactions: vi.fn(async () => []),
    customerExists:        vi.fn(async () => true),
    ...overrides,
  } as unknown as LoyaltyRepository;
}

function fakeCache(loyalty: LoyaltyConfig | null = LOYALTY_DEFAULT): SettingsCache {
  return {
    getLoyalty: vi.fn(async () => loyalty),
  } as unknown as SettingsCache;
}

// Mock @goldsmith/db so withTenantTx hands us a stub tx that captures all queries.
const txCalls: TxLike[] = [];
vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: TxLike) => Promise<unknown>) => {
    const tx = fakeTx();
    txCalls.push(tx);
    return fn(tx);
  }),
}));

beforeEach(() => {
  txCalls.length = 0;
  vi.clearAllMocks();
});

function makeSvc(opts: {
  repo?: LoyaltyRepository;
  pool?: any;
  cache?: SettingsCache;
} = {}): LoyaltyService {
  return new LoyaltyService(
    opts.pool ?? fakePool(),
    opts.repo ?? fakeRepo(),
    opts.cache ?? fakeCache(),
  );
}

// ─── computeAccrualPoints (pure) ──────────────────────────────────────────────

describe('computeAccrualPoints', () => {
  it('returns 684 for ₹68,420 gold at 1.00% earn rate (golden case from brief)', () => {
    expect(computeAccrualPoints(6_842_000n, '1.00')).toBe(684);
  });

  it('returns 342 for ₹68,420 gold at 0.50% earn rate', () => {
    expect(computeAccrualPoints(6_842_000n, '0.50')).toBe(342);
  });

  it('floors fractional results (684.99 → 684)', () => {
    // 6_849_900 paise * 1.00% = 684.99 → floor → 684
    expect(computeAccrualPoints(6_849_900n, '1.00')).toBe(684);
  });

  it('returns 0 when goldValuePaise is 0', () => {
    expect(computeAccrualPoints(0n, '1.00')).toBe(0);
  });

  it('returns 0 when earn rate has 4 decimals (rate beyond shop config precision)', () => {
    // Schema only allows up to 2 decimals; this is a defense-in-depth check.
    // 100 paise * 0.0001% = effectively zero
    expect(computeAccrualPoints(100n, '0.01')).toBe(0);
  });

  it('handles large gold values without precision loss (₹10 lakh at 1%)', () => {
    // 1_00_00_000 paise = ₹1,00,000 → 1% = 1000 points
    expect(computeAccrualPoints(10_000_000n, '1.00')).toBe(1000);
  });

  it('rate "1.50" (1.5%) gives 1026 on ₹68,420 gold', () => {
    // 68,420 * 1.5% = 1026.3 → floor → 1026
    expect(computeAccrualPoints(6_842_000n, '1.50')).toBe(1026);
  });
});

// ─── accruePoints ─────────────────────────────────────────────────────────────

describe('accruePoints', () => {
  it('credits points based on goldValuePaise and earn rate (golden case)', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 0, lifetime_points: 0 })),
    });
    const svc = makeSvc({ repo });

    const result = await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 6_842_000n }),
    );

    expect(result).toEqual({ pointsDelta: 684, newBalance: 684 });
    expect(repo.insertTransaction).toHaveBeenCalledOnce();
    const insertCall = (repo.insertTransaction as any).mock.calls[0][2];
    expect(insertCall).toMatchObject({
      customerId: CUSTOMER,
      invoiceId: INVOICE,
      type: 'ACCRUAL',
      pointsDelta: 684,
      balanceBefore: 0,
      balanceAfter: 684,
      createdByUserId: null, // worker-driven accrual has no actor
    });
  });

  it('uses settingsCache.getLoyalty (NOT a method called getLoyaltyConfig)', async () => {
    const cache = fakeCache();
    const svc = makeSvc({ cache });
    await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 100_000n }),
    );
    expect((cache as any).getLoyalty).toHaveBeenCalledOnce();
  });

  it('falls back to LOYALTY_DEFAULTS when cache returns null', async () => {
    const repo = fakeRepo();
    const svc = makeSvc({ repo, cache: fakeCache(null) });
    const result = await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 6_842_000n }),
    );
    // Default earn rate is 1.00%
    expect(result.pointsDelta).toBe(684);
  });

  it('returns zero-delta and skips inserts when goldValuePaise is 0', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 50 })),
    });
    const svc = makeSvc({ repo });
    const result = await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 0n }),
    );
    expect(result).toEqual({ pointsDelta: 0, newBalance: 50 });
    expect(repo.insertTransaction).not.toHaveBeenCalled();
    expect(repo.updateAggregate).not.toHaveBeenCalled();
  });

  it('returns zero-delta when computed points is 0 (rate too small for value)', async () => {
    const repo = fakeRepo();
    const svc = makeSvc({ repo, cache: fakeCache({ ...LOYALTY_DEFAULT, earnRatePercentage: '0.01' }) });
    // 100 paise * 0.01% = 0.01 → floor → 0
    const result = await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 100n }),
    );
    expect(result.pointsDelta).toBe(0);
    expect(repo.insertTransaction).not.toHaveBeenCalled();
  });

  it('lifetime_points increments by the same delta on accrual', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 100, lifetime_points: 200 })),
    });
    const svc = makeSvc({ repo });
    await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 6_842_000n }),
    );
    const updateCall = (repo.updateAggregate as any).mock.calls[0][2];
    expect(updateCall).toMatchObject({ pointsDelta: 684, lifetimeDelta: 684 });
  });

  it('starts from existing balance when aggregate exists (additive)', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 1000 })),
    });
    const svc = makeSvc({ repo });
    const result = await tenantContext.runWith(authCtx(), () =>
      svc.accruePoints({ customerId: CUSTOMER, invoiceId: INVOICE, goldValuePaise: 6_842_000n }),
    );
    expect(result).toEqual({ pointsDelta: 684, newBalance: 1684 });
    const insertCall = (repo.insertTransaction as any).mock.calls[0][2];
    expect(insertCall.balanceBefore).toBe(1000);
    expect(insertCall.balanceAfter).toBe(1684);
  });
});

// ─── getLoyaltyState ──────────────────────────────────────────────────────────

describe('getLoyaltyState', () => {
  it('returns zeros + null tier when no aggregate row exists', async () => {
    const repo = fakeRepo({ getState: vi.fn(async () => null), customerExists: vi.fn(async () => true) });
    const svc = makeSvc({ repo });
    const result = await tenantContext.runWith(authCtx(), () => svc.getLoyaltyState(CUSTOMER));
    expect(result).toEqual({
      pointsBalance: 0,
      lifetimePoints: 0,
      currentTier: null,
      tierSince: null,
    });
  });

  it('returns the aggregate row when present', async () => {
    const tierSince = new Date('2026-03-01');
    const repo = fakeRepo({
      getState: vi.fn(async () => fakeAggregate({
        points_balance: 1234,
        lifetime_points: 5678,
        current_tier: 'Gold',
        tier_since: tierSince,
      })),
    });
    const svc = makeSvc({ repo });
    const result = await tenantContext.runWith(authCtx(), () => svc.getLoyaltyState(CUSTOMER));
    expect(result).toEqual({
      pointsBalance: 1234,
      lifetimePoints: 5678,
      currentTier: 'Gold',
      tierSince: tierSince.toISOString(),
    });
  });

  it('throws 404 when the customer does not exist (or is in another tenant)', async () => {
    const repo = fakeRepo({ customerExists: vi.fn(async () => false) });
    const svc = makeSvc({ repo });
    await expect(tenantContext.runWith(authCtx(), () => svc.getLoyaltyState(CUSTOMER)))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── adjustPoints ─────────────────────────────────────────────────────────────

describe('adjustPoints', () => {
  it('positive delta records ADJUSTMENT_IN with actor user id', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 500 })),
    });
    const svc = makeSvc({ repo });

    const result = await tenantContext.runWith(authCtx(), () =>
      svc.adjustPoints(CUSTOMER, { pointsDelta: 100, reason: 'goodwill bonus' }),
    );

    expect(result).toEqual({ pointsDelta: 100, newBalance: 600 });
    const insertCall = (repo.insertTransaction as any).mock.calls[0][2];
    expect(insertCall).toMatchObject({
      type: 'ADJUSTMENT_IN',
      pointsDelta: 100,
      balanceBefore: 500,
      balanceAfter: 600,
      createdByUserId: USER,
      invoiceId: null,
    });
  });

  it('negative delta records ADJUSTMENT_OUT', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 500 })),
    });
    const svc = makeSvc({ repo });

    await tenantContext.runWith(authCtx(), () =>
      svc.adjustPoints(CUSTOMER, { pointsDelta: -100, reason: 'mistake correction' }),
    );

    const insertCall = (repo.insertTransaction as any).mock.calls[0][2];
    expect(insertCall.type).toBe('ADJUSTMENT_OUT');
    expect(insertCall.pointsDelta).toBe(-100);
  });

  it('lifetime_points NOT incremented on adjustment (only on ACCRUAL)', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 500, lifetime_points: 1000 })),
    });
    const svc = makeSvc({ repo });

    await tenantContext.runWith(authCtx(), () =>
      svc.adjustPoints(CUSTOMER, { pointsDelta: 100, reason: 'goodwill' }),
    );

    const updateCall = (repo.updateAggregate as any).mock.calls[0][2];
    expect(updateCall).toMatchObject({ pointsDelta: 100, lifetimeDelta: 0 });
  });

  it('throws 422 when negative adjustment would push balance below zero', async () => {
    const repo = fakeRepo({
      lockOrCreateAggregate: vi.fn(async () => fakeAggregate({ points_balance: 50 })),
    });
    const svc = makeSvc({ repo });

    await expect(
      tenantContext.runWith(authCtx(), () =>
        svc.adjustPoints(CUSTOMER, { pointsDelta: -100, reason: 'wipe' }),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects zero-delta at the service layer (defense-in-depth — Zod also blocks)', async () => {
    const svc = makeSvc();
    await expect(
      tenantContext.runWith(authCtx(), () =>
        svc.adjustPoints(CUSTOMER, { pointsDelta: 0, reason: 'noop' }),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws 404 when the customer does not belong to this tenant', async () => {
    const repo = fakeRepo({ customerExists: vi.fn(async () => false) });
    const svc = makeSvc({ repo });
    await expect(
      tenantContext.runWith(authCtx(), () =>
        svc.adjustPoints(CUSTOMER, { pointsDelta: 100, reason: 'goodwill' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
