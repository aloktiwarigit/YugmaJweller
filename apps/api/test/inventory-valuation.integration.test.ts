import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import {
  tenantContext,
  type Tenant,
  type UnauthenticatedTenantContext,
  type AuthenticatedTenantContext,
} from '@goldsmith/tenant-context';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository';
import { InventoryValuationService } from '../src/modules/inventory/inventory.valuation.service';
import type { CurrentRatesResult } from '../src/modules/pricing/pricing.service';
import { SyncLogger } from '@goldsmith/sync';
import { vi } from 'vitest';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const tenantA: Tenant = { id: SHOP_A, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' };
const tenantB: Tenant = { id: SHOP_B, slug: 'shop-b', display_name: 'Shop B', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A, userId: SHOP_A, role: 'shop_admin',
  authenticated: true, tenant: tenantA,
};
const ctxB: AuthenticatedTenantContext = {
  shopId: SHOP_B, userId: SHOP_B, role: 'shop_admin',
  authenticated: true, tenant: tenantB,
};

// ₹6,000/g for 22K = 600,000 paise/g
const RATE_22K = 600_000n;
const FIXED_RATES: CurrentRatesResult = {
  GOLD_24K: { perGramPaise: 650_000n, fetchedAt: new Date() },
  GOLD_22K: { perGramPaise: RATE_22K,  fetchedAt: new Date() },
  GOLD_20K: { perGramPaise: 550_000n, fetchedAt: new Date() },
  GOLD_18K: { perGramPaise: 480_000n, fetchedAt: new Date() },
  GOLD_14K: { perGramPaise: 380_000n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 10_000n, fetchedAt: new Date() },
  SILVER_925: { perGramPaise:  9_200n, fetchedAt: new Date() },
  stale: false, source: 'ibja',
};

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: InventoryRepository;
let service: InventoryValuationService;
let catId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'shop-a', 'Shop A', 'ACTIVE'),
        ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
    const catRes = await c.query<{ id: string }>(
      `INSERT INTO product_categories (shop_id, name) VALUES ($1, 'अंगूठी') RETURNING id`,
      [SHOP_A],
    );
    catId = catRes.rows[0]!.id;
  } finally {
    c.release();
  }

  // Shop A: 3 IN_STOCK 22K rings × 9g each + 1 SOLD 22K ring × 100g (must be excluded)
  const unauthCtxA: UnauthenticatedTenantContext = {
    shopId: SHOP_A, tenant: tenantA, authenticated: false,
  };
  await tenantContext.runWith(unauthCtxA, () =>
    withTenantTx(pool, async (tx) => {
      for (let i = 0; i < 3; i++) {
        await tx.query(
          `INSERT INTO products
             (shop_id, category_id, sku, metal, purity,
              gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
           VALUES ($1, $2, $3, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $1)`,
          [SHOP_A, catId, `RING-A-0${i}`],
        );
      }
      await tx.query(
        `INSERT INTO products
           (shop_id, category_id, sku, metal, purity,
            gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, $2, 'SOLD-A-01', 'GOLD', '22K', '110.0000', '100.0000', '0.0000', 'SOLD', $1)`,
        [SHOP_A, catId],
      );
    }),
  );

  // Shop B: 1 IN_STOCK 22K ring × 50g
  const unauthCtxB: UnauthenticatedTenantContext = {
    shopId: SHOP_B, tenant: tenantB, authenticated: false,
  };
  await tenantContext.runWith(unauthCtxB, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO products
           (shop_id, sku, metal, purity,
            gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'RING-B-01', 'GOLD', '22K', '55.0000', '50.0000', '0.0000', 'IN_STOCK', $1)`,
        [SHOP_B],
      );
    }),
  );

  const mockSyncLogger = { logInTx: vi.fn() } as unknown as SyncLogger;
  repo = new InventoryRepository(pool, mockSyncLogger);

  const pricingMock = { getCurrentRates: vi.fn().mockResolvedValue(FIXED_RATES) };
  const redisMock = {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  };
  service = new InventoryValuationService(repo, pricingMock as never, redisMock as never);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('inventory valuation integration', () => {
  it('computes correct category totals for Shop A (3 rings × 9g × ₹6,000/g)', async () => {
    const summary = await tenantContext.runWith(ctxA, () =>
      service.computeValuation(ctxA),
    );
    // 3 × 9g × 600,000 paise/g = 16,200,000 paise = ₹1,62,000
    expect(summary.grandTotalPaise).toBe(16_200_000n);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0]?.category).toBe('अंगूठी');
    expect(summary.categories[0]?.productCount).toBe(3);
  });

  it('excludes SOLD products from Shop A totals', async () => {
    const summary = await tenantContext.runWith(ctxA, () =>
      service.computeValuation(ctxA),
    );
    // SOLD ring is 100g — if included, total weight would be 127g. Must be 27g only.
    expect(summary.categories[0]?.totalWeightG).toBe('27.0000 g');
  });

  it('tenant isolation: Shop A valuation never includes Shop B products', async () => {
    const summaryA = await tenantContext.runWith(ctxA, () =>
      service.computeValuation(ctxA),
    );
    expect(summaryA.grandTotalPaise).toBe(16_200_000n);

    const summaryB = await tenantContext.runWith(ctxB, () =>
      service.computeValuation(ctxB),
    );
    // Shop B: 50g × 600,000 = 30,000,000 paise
    expect(summaryB.grandTotalPaise).toBe(30_000_000n);
  });
});
