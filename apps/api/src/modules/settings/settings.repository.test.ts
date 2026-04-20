import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SettingsRepository } from './settings.repository';
import type { PatchShopProfileDto, MakingChargeConfig, WastageConfig } from '@goldsmith/shared';
import { MAKING_CHARGE_DEFAULTS, WASTAGE_DEFAULTS } from '@goldsmith/shared';

const SHOP_A = '11111111-1111-1111-1111-111111111111';
const tenantA: Tenant = { id: SHOP_A, slug: 'a', display_name: 'Rajesh Jewellers', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

const dbRow = {
  display_name: 'Rajesh Jewellers',
  address_json: null, gstin: null, bis_registration: null, contact_phone: null,
  operating_hours_json: null, about_text: null, logo_url: null, years_in_business: null,
  updated_at: new Date('2026-04-19T00:00:00Z'),
};

function makeMockClient(selectRows: unknown[], updateRows?: unknown[]): PoolClient {
  let callCount = 0;
  const rows = updateRows ? [selectRows, updateRows] : [selectRows];
  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('BEGIN')) return;
      if (typeof sql === 'string' && sql.includes('COMMIT')) return;
      if (typeof sql === 'string' && sql.includes('ROLLBACK')) return;
      if (typeof sql === 'string' && sql.includes('SET LOCAL')) return;
      if (typeof sql === 'string' && sql.includes('SET app.')) return;
      if (typeof sql === 'string' && sql.includes('ON CONFLICT')) return { rows: [], rowCount: 1 };
      const result = { rows: rows[callCount] ?? [], rowCount: (rows[callCount] ?? []).length };
      callCount++;
      return result;
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

describe('SettingsRepository', () => {
  let pool: Pool;
  let client: PoolClient;
  let repo: SettingsRepository;

  beforeEach(() => {
    client = makeMockClient([dbRow], [{ ...dbRow, display_name: 'Rajesh Jewellers & Sons' }]);
    pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    repo = new SettingsRepository(pool);
  });

  describe('getShopProfile', () => {
    it('maps display_name → name', async () => {
      pool = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [dbRow], rowCount: 1 }),
          release: vi.fn(),
        }),
      } as unknown as Pool;
      repo = new SettingsRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.getShopProfile());
      expect(result.name).toBe('Rajesh Jewellers');
      expect(result.updated_at).toBe(dbRow.updated_at.toISOString());
    });

    it('throws if shop not found', async () => {
      pool = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
          release: vi.fn(),
        }),
      } as unknown as Pool;
      repo = new SettingsRepository(pool);
      await expect(tenantContext.runWith(ctxA, () => repo.getShopProfile())).rejects.toThrow();
    });
  });

  describe('updateShopProfile', () => {
    it('returns before and after', async () => {
      const patch: PatchShopProfileDto = { name: 'Rajesh Jewellers & Sons' };
      const result = await tenantContext.runWith(ctxA, () => repo.updateShopProfile(patch));
      expect(result.before.name).toBe('Rajesh Jewellers');
      expect(result.after.name).toBe('Rajesh Jewellers & Sons');
    });

    it('skips UPDATE query when patch is empty', async () => {
      const querySpy = vi.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('BEGIN')) return;
        if (typeof sql === 'string' && sql.includes('COMMIT')) return;
        if (typeof sql === 'string' && sql.includes('SET LOCAL')) return;
        if (typeof sql === 'string' && sql.includes('SET app.')) return;
        if (typeof sql === 'string' && sql.includes('ON CONFLICT')) return { rows: [], rowCount: 1 };
        return { rows: [dbRow], rowCount: 1 };
      });
      pool = { connect: vi.fn().mockResolvedValue({ query: querySpy, release: vi.fn() }) } as unknown as Pool;
      repo = new SettingsRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.updateShopProfile({}));
      const updateCalls = (querySpy.mock.calls as [string][]).filter(([sql]) => typeof sql === 'string' && sql.includes('UPDATE shops'));
      expect(updateCalls).toHaveLength(0);
      expect(result.before.name).toBe(result.after.name);
    });
  });

  describe('getMakingCharges', () => {
    it('returns null when making_charges_json is null', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [{ making_charges_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
      expect(result).toBeNull();
    });

    it('returns parsed array when making_charges_json is populated', async () => {
      const stored: MakingChargeConfig[] = [
        { category: 'RINGS', type: 'percent', value: '12.00' },
      ];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [{ making_charges_json: stored }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
      expect(result).toEqual(stored);
    });

    it('returns null when shop_settings row does not exist', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getMakingCharges());
      expect(result).toBeNull();
    });
  });

  describe('upsertMakingCharges', () => {
    it('returns before: null and after: merged configs for a fresh shop', async () => {
      const patchItems: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '14.00' }];
      const defaults = MAKING_CHARGE_DEFAULTS;
      const expectedAfter = defaults.map((c) =>
        c.category === 'RINGS' ? { ...c, value: '14.00' } : c,
      );
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          if (sql.includes('INSERT')) {
            return { rows: [{ making_charges_json: expectedAfter }], rowCount: 1 };
          }
          // SELECT FOR UPDATE before state: fresh shop has null
          return { rows: [{ making_charges_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () =>
        testRepo.upsertMakingCharges(patchItems, defaults),
      );
      expect(result.before).toBeNull();
      expect(result.after).toEqual(expectedAfter);
    });

    it('returns before: existing array and after: merged configs', async () => {
      const existing: MakingChargeConfig[] = MAKING_CHARGE_DEFAULTS.map((c) => c);
      const patchItems: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '15.00' }];
      const expectedAfter = existing.map((c) => c.category === 'RINGS' ? { ...c, value: '15.00' } : c);
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          if (sql.includes('INSERT')) {
            return { rows: [{ making_charges_json: expectedAfter }], rowCount: 1 };
          }
          return { rows: [{ making_charges_json: existing }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () =>
        testRepo.upsertMakingCharges(patchItems, MAKING_CHARGE_DEFAULTS),
      );
      expect(result.before).toEqual(existing);
      expect(result.after).toEqual(expectedAfter);
    });

    it('stores value as string not number', async () => {
      const patchItems: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '12.00' }];
      let capturedParams: unknown[] | undefined;
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          if (sql.includes('INSERT')) {
            capturedParams = params;
            return { rows: [{ making_charges_json: patchItems }], rowCount: 1 };
          }
          return { rows: [{ making_charges_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      await tenantContext.runWith(ctxA, () =>
        testRepo.upsertMakingCharges(patchItems, MAKING_CHARGE_DEFAULTS),
      );
      expect(capturedParams).toBeDefined();
      const jsonStr = capturedParams![1] as string;
      const parsed = JSON.parse(jsonStr) as Array<{ value: unknown }>;
      expect(typeof parsed[0].value).toBe('string');
    });
  });

  describe('getWastage', () => {
    it('returns null when wastage_json is null', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [{ wastage_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getWastage());
      expect(result).toBeNull();
    });

    it('returns parsed map when wastage_json is populated', async () => {
      const stored: Record<string, string> = { BRIDAL: '2.50' };
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [{ wastage_json: stored }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getWastage());
      expect(result).toEqual(stored);
    });

    it('returns null when shop_settings row does not exist', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.getWastage());
      expect(result).toBeNull();
    });
  });

  describe('upsertWastage', () => {
    it('stores percent as string not number', async () => {
      let capturedParams: unknown[] | undefined;
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          if (sql.includes('wastage_json')) {
            capturedParams = params;
            return { rows: [{ wastage_json: { BRIDAL: '2.50' } }], rowCount: 1 };
          }
          // SELECT FOR UPDATE
          return { rows: [{ wastage_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      await tenantContext.runWith(ctxA, () => testRepo.upsertWastage('BRIDAL', '2.50'));
      expect(capturedParams).toBeDefined();
      const jsonStr = capturedParams![1] as string;
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      expect(typeof parsed['BRIDAL']).toBe('string');
    });

    it('returns before: null and after: full 6-category array for fresh shop', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
              sql.includes('SET LOCAL') || sql.includes('SET app.')) return;
          if (sql.includes('wastage_json')) {
            return { rows: [{ wastage_json: { BRIDAL: '2.50' } }], rowCount: 1 };
          }
          // SELECT FOR UPDATE — fresh shop has null
          return { rows: [{ wastage_json: null }], rowCount: 1 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;
      const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
      const testRepo = new SettingsRepository(mockPool);
      const result = await tenantContext.runWith(ctxA, () => testRepo.upsertWastage('BRIDAL', '2.50'));
      expect(result.before).toBeNull();
      expect(result.after).toHaveLength(6);
      const bridal = result.after.find((c) => c.category === 'BRIDAL');
      expect(bridal?.percent).toBe('2.50');
    });
  });
});
