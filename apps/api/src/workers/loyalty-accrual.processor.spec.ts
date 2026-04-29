/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoyaltyAccrualProcessor } from './loyalty-accrual.processor';
import type { LoyaltyService } from '../modules/loyalty/loyalty.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';
const INVOICE = '11111111-2222-4000-8000-000000000004';

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    name: 'accrue',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      invoiceId: INVOICE,
      shopId: SHOP,
      customerId: CUSTOMER,
      goldValuePaise: '6842000',
    },
    ...overrides,
  } as any;
}

function fakeRedis(initialKeys: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initialKeys };
  return {
    set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number, mode?: string) => {
      if (mode === 'NX' && key in store) return null;
      store[key] = value;
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      delete store[key];
      return 1;
    }),
    _store: store,
  } as any;
}

function fakePool() {
  return {
    query: vi.fn(async () => ({
      rows: [{ id: SHOP, slug: 'test-shop', display_name: 'Test Shop', status: 'active' }],
    })),
  } as any;
}

function fakeService(overrides: Partial<LoyaltyService> = {}): LoyaltyService {
  return {
    accruePoints: vi.fn(async () => ({ pointsDelta: 684, newBalance: 684 })),
    ...overrides,
  } as unknown as LoyaltyService;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoyaltyAccrualProcessor', () => {
  it('happy path: accruePoints called once with bigint goldValuePaise', async () => {
    const svc = fakeService();
    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());

    const result = await proc.process(makeJob());

    expect(result).toEqual({ skipped: false, pointsDelta: 684 });
    expect(svc.accruePoints).toHaveBeenCalledOnce();
    const call = (svc.accruePoints as any).mock.calls[0][0];
    expect(call.invoiceId).toBe(INVOICE);
    expect(call.customerId).toBe(CUSTOMER);
    expect(call.goldValuePaise).toBe(6842000n); // bigint, not string
  });

  it('idempotency: second invocation with same invoiceId is skipped', async () => {
    const svc = fakeService();
    const redis = fakeRedis({ [`loyalty:accrual:${INVOICE}`]: '1' });
    const proc = new LoyaltyAccrualProcessor(svc, redis, fakePool());

    const result = await proc.process(makeJob());

    expect(result).toEqual({ skipped: true });
    expect(svc.accruePoints).not.toHaveBeenCalled();
  });

  it('release idempotency key on failure so retry can proceed', async () => {
    const svc = fakeService({
      accruePoints: vi.fn(async () => { throw new Error('db blip'); }),
    });
    const redis = fakeRedis();
    const proc = new LoyaltyAccrualProcessor(svc, redis, fakePool());

    await expect(proc.process(makeJob())).rejects.toThrow('db blip');
    expect(redis.del).toHaveBeenCalledWith(`loyalty:accrual:${INVOICE}`);
  });

  it('rethrows so Bull retries', async () => {
    const err = new Error('transient');
    const svc = fakeService({ accruePoints: vi.fn(async () => { throw err; }) });
    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());

    await expect(proc.process(makeJob())).rejects.toBe(err);
  });

  it('throws when shop is not found in DB', async () => {
    const svc = fakeService();
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as any;
    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), pool);

    await expect(proc.process(makeJob())).rejects.toThrow(/shop .* not found/);
  });

  it('tenant context isolation: shopId from job is in tenantContext during accrual', async () => {
    let observedShopId: string | undefined;
    const { tenantContext } = await import('@goldsmith/tenant-context');
    const svc = fakeService({
      accruePoints: vi.fn(async () => {
        observedShopId = tenantContext.requireCurrent().shopId;
        return { pointsDelta: 100, newBalance: 100 };
      }),
    });
    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());

    await proc.process(makeJob());
    expect(observedShopId).toBe(SHOP);
  });
});
