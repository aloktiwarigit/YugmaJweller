import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { InventoryRepository } from './inventory.repository';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const tenantA: Tenant = { id: SHOP_A, slug: 'a', display_name: 'Test', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

const dbProduct = {
  id: 'prod-1111',
  shop_id: SHOP_A,
  category_id: null,
  sku: 'RING-001',
  metal: 'GOLD',
  purity: '22K',
  gross_weight_g: '10.5000',
  net_weight_g: '9.0000',
  stone_weight_g: '0.5000',
  stone_details: null,
  making_charge_override_pct: null,
  huid: null,
  status: 'IN_STOCK',
  published_at: null,
  created_by_user_id: 'user-1',
  created_at: new Date('2026-04-23'),
  updated_at: new Date('2026-04-23'),
};

function makeClient(rows: unknown[]): PoolClient {
  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (['BEGIN','COMMIT','ROLLBACK'].some((k) => typeof sql === 'string' && sql.includes(k))) return;
      if (typeof sql === 'string' && (sql.includes('SET LOCAL') || sql.includes('SET app.'))) return;
      return { rows, rowCount: rows.length };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

describe('InventoryRepository', () => {
  let pool: Pool;
  let repo: InventoryRepository;

  beforeEach(() => {
    const client = makeClient([dbProduct]);
    pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    repo = new InventoryRepository(pool);
  });

  describe('createProduct', () => {
    it('returns the inserted product row', async () => {
      const result = await tenantContext.runWith(ctxA, () =>
        repo.createProduct({
          shopId: SHOP_A,
          createdByUserId: 'user-1',
          sku: 'RING-001', metal: 'GOLD', purity: '22K',
          grossWeightG: '10.5000', netWeightG: '9.0000',
          status: 'IN_STOCK',
        }),
      );
      expect(result.sku).toBe('RING-001');
      expect(result.shop_id).toBe(SHOP_A);
    });
  });

  describe('getProduct', () => {
    it('returns the product when found', async () => {
      const result = await tenantContext.runWith(ctxA, () =>
        repo.getProduct('prod-1111'),
      );
      expect(result?.id).toBe('prod-1111');
    });

    it('returns null when not found', async () => {
      const emptyClient = makeClient([]);
      pool = { connect: vi.fn().mockResolvedValue(emptyClient) } as unknown as Pool;
      repo = new InventoryRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.getProduct('not-exist'));
      expect(result).toBeNull();
    });
  });

  describe('listProducts', () => {
    it('returns an array of products', async () => {
      const result = await tenantContext.runWith(ctxA, () =>
        repo.listProducts({ limit: 20, offset: 0 }),
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]?.sku).toBe('RING-001');
    });
  });

  describe('updateProduct', () => {
    it('returns updated row', async () => {
      const updated = { ...dbProduct, status: 'SOLD' };
      const client = makeClient([updated]);
      pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      repo = new InventoryRepository(pool);
      const result = await tenantContext.runWith(ctxA, () =>
        repo.updateProduct('prod-1111', { status: 'SOLD' }),
      );
      expect(result?.status).toBe('SOLD');
    });
  });
});
