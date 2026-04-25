import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SyncLogger } from '@goldsmith/sync';
import { StockMovementRepository } from '../src/modules/inventory/stock-movement.repository';
import { StockMovementService } from '../src/modules/inventory/stock-movement.service';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_A = '99999999-aaaa-aaaa-aaaa-999999999999';

const tenantA: Tenant = { id: SHOP_A, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' };
const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A, tenant: tenantA, authenticated: true, userId: USER_A,
} as never;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: StockMovementRepository;
let svc: StockMovementService;

async function seedProduct(initialQty: number, initialStatus: string): Promise<string> {
  return tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, quantity, created_by_user_id)
         VALUES ($1, $2, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', $3, $4, $1)
         RETURNING id`,
        [SHOP_A, `SKU-${Date.now()}-${Math.random().toString(36).slice(2)}`, initialStatus, initialQty],
      );
      return r.rows[0]!.id;
    }),
  );
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  await pool.query(
    `INSERT INTO shops (id, slug, display_name, status) VALUES
      ($1, 'shop-a', 'Shop A', 'ACTIVE'),
      ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
    [SHOP_A, SHOP_B],
  );

  const syncLogger = new SyncLogger();
  repo = new StockMovementRepository(pool, syncLogger);
  svc = new StockMovementService(repo, pool);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('stock_movements — full cycle', () => {
  it('PURCHASE +5 → SALE -2 → ADJUSTMENT_OUT -1 → balance = 2; status remains IN_STOCK', async () => {
    const productId = await seedProduct(0, 'IN_STOCK');
    await tenantContext.runWith(ctxA, async () => {
      const m1 = await svc.recordMovement({
        productId, type: 'PURCHASE', quantityDelta: 5, reason: 'restock',
      });
      expect(m1.balanceAfter).toBe(5);

      const m2 = await svc.recordMovement({
        productId, type: 'SALE', quantityDelta: -2, reason: 'sold to walk-in',
      });
      expect(m2.balanceAfter).toBe(3);

      const m3 = await svc.recordMovement({
        productId, type: 'ADJUSTMENT_OUT', quantityDelta: -1, reason: 'damaged',
      });
      expect(m3.balanceAfter).toBe(2);

      const list = await svc.listMovements(productId);
      expect(list).toHaveLength(3);
      expect(list[0]!.type).toBe('ADJUSTMENT_OUT'); // DESC order

      const r = await pool.query<{ status: string; quantity: number }>(
        `SELECT status, quantity FROM products WHERE id = $1`, [productId],
      );
      expect(r.rows[0]!.status).toBe('IN_STOCK');
      expect(r.rows[0]!.quantity).toBe(2);
    });
  });

  it('SALE that drops balance to 0 from IN_STOCK auto-transitions to SOLD', async () => {
    const id = await seedProduct(1, 'IN_STOCK');
    await tenantContext.runWith(ctxA, async () => {
      await svc.recordMovement({
        productId: id, type: 'SALE', quantityDelta: -1, reason: 'last unit',
      });
      const r = await pool.query<{ status: string; quantity: number }>(
        `SELECT status, quantity FROM products WHERE id = $1`, [id],
      );
      expect(r.rows[0]!.status).toBe('SOLD');
      expect(r.rows[0]!.quantity).toBe(0);
    });
  });

  it('ADJUSTMENT_OUT that drops balance to 0 does NOT auto-set SOLD', async () => {
    const id = await seedProduct(1, 'IN_STOCK');
    await tenantContext.runWith(ctxA, async () => {
      await svc.recordMovement({
        productId: id, type: 'ADJUSTMENT_OUT', quantityDelta: -1, reason: 'lost',
      });
      const r = await pool.query<{ status: string }>(
        `SELECT status FROM products WHERE id = $1`, [id],
      );
      expect(r.rows[0]!.status).toBe('IN_STOCK');
    });
  });

  it('SALE on WITH_KARIGAR product is rejected (no transition to SOLD)', async () => {
    const id = await seedProduct(1, 'WITH_KARIGAR');
    await tenantContext.runWith(ctxA, async () => {
      await expect(
        svc.recordMovement({
          productId: id, type: 'SALE', quantityDelta: -1, reason: 'invalid sell from karigar',
        }),
      ).rejects.toMatchObject({
        response: { code: 'inventory.invalid_status_transition' },
      });
    });
  });

  it('SALE that would drop balance below 0 is rejected with insufficient_stock', async () => {
    const id = await seedProduct(2, 'IN_STOCK');
    await tenantContext.runWith(ctxA, async () => {
      await expect(
        svc.recordMovement({
          productId: id, type: 'SALE', quantityDelta: -3, reason: 'oversell attempt',
        }),
      ).rejects.toMatchObject({
        response: { code: 'inventory.insufficient_stock' },
      });
    });
  });
});

describe('stock_movements — DB-level immutability', () => {
  it('direct UPDATE is rejected by trigger', async () => {
    const id = await seedProduct(0, 'IN_STOCK');
    await tenantContext.runWith(ctxA, () =>
      svc.recordMovement({
        productId: id, type: 'PURCHASE', quantityDelta: 1, reason: 'init',
      }),
    );
    await expect(
      pool.query(`UPDATE stock_movements SET reason = 'tampered' WHERE product_id = $1`, [id]),
    ).rejects.toThrow(/immutable/);
  });

  it('direct DELETE is rejected by trigger', async () => {
    const id = await seedProduct(0, 'IN_STOCK');
    await tenantContext.runWith(ctxA, () =>
      svc.recordMovement({
        productId: id, type: 'PURCHASE', quantityDelta: 1, reason: 'init',
      }),
    );
    await expect(
      pool.query(`DELETE FROM stock_movements WHERE product_id = $1`, [id]),
    ).rejects.toThrow(/immutable/);
  });

  it('app_user role has no UPDATE privilege on stock_movements', async () => {
    const id = await seedProduct(0, 'IN_STOCK');
    await tenantContext.runWith(ctxA, () =>
      svc.recordMovement({
        productId: id, type: 'PURCHASE', quantityDelta: 1, reason: 'init',
      }),
    );

    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE app_user');
      await c.query(`SET LOCAL app.current_shop_id = '${SHOP_A}'`);
      await expect(
        c.query(`UPDATE stock_movements SET reason = 'x' WHERE shop_id = '${SHOP_A}'`),
      ).rejects.toMatchObject({ code: '42501' }); // insufficient_privilege
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });
});

describe('stock_movements — concurrent oversell', () => {
  it('two simultaneous SALE -1 on quantity=1 → exactly one succeeds, one gets 422', async () => {
    const id = await seedProduct(1, 'IN_STOCK');
    const result = await tenantContext.runWith(ctxA, async () => {
      return await Promise.allSettled([
        svc.recordMovement({
          productId: id, type: 'SALE', quantityDelta: -1, reason: 'race A',
        }),
        svc.recordMovement({
          productId: id, type: 'SALE', quantityDelta: -1, reason: 'race B',
        }),
      ]);
    });

    const ok = result.filter((r) => r.status === 'fulfilled').length;
    const failed = result.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);

    const final = await pool.query<{ quantity: number; status: string }>(
      `SELECT quantity, status FROM products WHERE id = $1`, [id],
    );
    expect(final.rows[0]!.quantity).toBe(0);
    expect(final.rows[0]!.status).toBe('SOLD');
  });
});

describe('stock_movements — tenant isolation', () => {
  it('shop B cannot read shop A movements via RLS', async () => {
    const id = await seedProduct(0, 'IN_STOCK');
    await tenantContext.runWith(ctxA, () =>
      svc.recordMovement({
        productId: id, type: 'PURCHASE', quantityDelta: 1, reason: 'init',
      }),
    );

    const tenantB: Tenant = { id: SHOP_B, slug: 'shop-b', display_name: 'Shop B', status: 'ACTIVE' };
    const ctxB: AuthenticatedTenantContext = {
      shopId: SHOP_B, tenant: tenantB, authenticated: true, userId: USER_A,
    } as never;

    const rows = await tenantContext.runWith(ctxB, () => svc.listMovements(id));
    expect(rows).toHaveLength(0);
  });
});
