import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SettingsRepository } from './settings.repository';
import type { PatchShopProfileDto } from '@goldsmith/shared';

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
});
