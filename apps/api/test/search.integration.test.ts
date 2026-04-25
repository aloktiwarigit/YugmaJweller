/**
 * Story 3.9 — Search integration smoke test.
 *
 * Creates real products in a testcontainers Postgres instance, then exercises
 * InventorySearchService.search().  The StubSearchAdapter always throws
 * MeilisearchUnavailableError, so the service falls back to the Postgres path.
 *
 * Two assertions validated:
 *   1. Search returns the correct subset of products (SKU ILIKE match).
 *   2. Tenant isolation: products belonging to shop A are never returned for
 *      shop B, even when the query matches.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { InventorySearchService } from '../src/modules/inventory/inventory.search.service';
import { StubSearchAdapter } from '@goldsmith/integrations-search';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const SHOP_A = 'aaaaaaaa-aaaa-4444-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-4444-bbbb-bbbbbbbbbbbb';
const USER_ID = 'ffffffff-0000-0000-0000-000000000001';

const tenantA: Tenant = { id: SHOP_A, slug: 'search-shop-a', display_name: 'Search Shop A', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

const tenantB: Tenant = { id: SHOP_B, slug: 'search-shop-b', display_name: 'Search Shop B', status: 'ACTIVE' };
const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

// ────────────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────────────

describe('InventorySearchService — Postgres fallback smoke test', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let service: InventorySearchService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

    // InventorySearchService is a NestJS injectable — instantiate directly
    // for integration tests without spinning up the full NestJS container.
    const stub = new StubSearchAdapter();
    service = new InventorySearchService(stub, pool);

    // Insert both shops (plain query — no RLS interceptor in test).
    const c = await pool.connect();
    try {
      await c.query(
        `INSERT INTO shops (id, slug, display_name, status) VALUES
           ($1, 'search-shop-a', 'Search Shop A', 'ACTIVE'),
           ($2, 'search-shop-b', 'Search Shop B', 'ACTIVE')`,
        [SHOP_A, SHOP_B],
      );
    } finally {
      c.release();
    }

    // Create 3 products in shop A: RING-001, RING-002, CHAIN-001.
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        for (const sku of ['RING-001', 'RING-002', 'CHAIN-001']) {
          await tx.query(
            `INSERT INTO products
               (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
                stone_weight_g, status, created_by_user_id)
             VALUES ($1, $2, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $3)`,
            [SHOP_A, sku, USER_ID],
          );
        }
      }),
    );

    // Create 1 product in shop B — must not appear in shop A searches.
    await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'RING-B-001', 'GOLD', '22K', '5.0000', '4.5000', '0.0000', 'IN_STOCK', $2)`,
          [SHOP_B, USER_ID],
        );
      }),
    );
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('search via Postgres fallback: finds 2 products matching "RING"', async () => {
    const result = await service.search(ctxA, { q: 'RING', limit: 50, offset: 0 });

    expect(result.source).toBe('postgres');
    expect(result.hits).toHaveLength(2);

    const skus = result.hits.map((h) => h.sku).sort();
    expect(skus).toEqual(['RING-001', 'RING-002']);

    // Total count should also be 2.
    expect(result.total).toBe(2);
  });

  it('search: "CHAIN" query finds exactly 1 product', async () => {
    const result = await service.search(ctxA, { q: 'CHAIN', limit: 50, offset: 0 });

    expect(result.source).toBe('postgres');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.sku).toBe('CHAIN-001');
  });

  it('search: tenant isolation — shop B products are not returned for shop A query', async () => {
    // RING-B-001 exists in shop B but must NOT appear in shop A results.
    const result = await service.search(ctxA, { q: 'RING', limit: 50, offset: 0 });

    const skus = result.hits.map((h) => h.sku);
    expect(skus).not.toContain('RING-B-001');
  });

  it('search: tenant isolation — shop A products not returned for shop B', async () => {
    // Shop B has only RING-B-001.  RING-001 and RING-002 (shop A) must be absent.
    const result = await service.search(ctxB, { q: 'RING', limit: 50, offset: 0 });

    expect(result.source).toBe('postgres');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.sku).toBe('RING-B-001');
  });

  it('search: empty query returns all shop A products', async () => {
    const result = await service.search(ctxA, { q: '', limit: 50, offset: 0 });

    expect(result.source).toBe('postgres');
    // shop A has 3 products
    expect(result.hits).toHaveLength(3);
  });
});
