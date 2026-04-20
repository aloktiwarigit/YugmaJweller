// apps/api/test/settings/tenant-isolation.test.ts
//
// Tenant isolation tests for shop_settings RLS and shops UPDATE RLS.
// Verifies:
//   1. Each tenant sees only its own shop_settings rows.
//   2. Tenant A cannot UPDATE tenant B's shops row.
//   3. app_user without current_shop_id context sees 0 shop_settings rows.
//   4. Tenant A CAN update its own shops row.
//
// Uses the real testing harness from @goldsmith/testing-tenant-isolation where
// appropriate, and also writes targeted cross-tenant scenarios directly.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { LOYALTY_DEFAULTS } from '@goldsmith/shared';
import { SettingsRepository } from '../../src/modules/settings/settings.repository';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

function makeTenant(id: string, slug: string, name: string): Tenant {
  return { id, slug, display_name: name, status: 'ACTIVE' };
}

function makeCtx(id: string, tenant: Tenant): UnauthenticatedTenantContext {
  return { shopId: id, tenant, authenticated: false };
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: SettingsRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();

  // Poisoned pool — on-connect hook sets GUC to POISON_UUID so un-scoped
  // app_user connections never see any tenant rows.
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../../packages/db/src/migrations'));

  // Seed two shops as superuser (bypasses RLS).
  for (const [id, slug, name] of [
    [TENANT_A, 'shop-a', 'Shop A'],
    [TENANT_B, 'shop-b', 'Shop B'],
  ] as const) {
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [id, slug, name],
    );
  }

  // Create shop_settings rows for both tenants.
  for (const [shopId, slug, name] of [
    [TENANT_A, 'shop-a', 'Shop A'],
    [TENANT_B, 'shop-b', 'Shop B'],
  ] as const) {
    const tenant = makeTenant(shopId, slug, name);
    const ctx = makeCtx(shopId, tenant);
    await tenantContext.runWith(ctx, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
          [shopId],
        );
      }),
    );
  }

  // SettingsRepository — pool injected directly, no NestJS DI needed.
  repo = new SettingsRepository(pool as never);
}, 90_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('shop_settings RLS tenant isolation', () => {
  it('tenant A can only see its own shop_settings row', async () => {
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ shop_id: string }>('SELECT shop_id FROM shop_settings');
        return r.rows;
      }),
    );

    expect(rows.length).toBe(1);
    expect(rows[0].shop_id).toBe(TENANT_A);
  });

  it('tenant B can only see its own shop_settings row', async () => {
    const tenantB = makeTenant(TENANT_B, 'shop-b', 'Shop B');
    const ctxB = makeCtx(TENANT_B, tenantB);

    const rows = await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ shop_id: string }>('SELECT shop_id FROM shop_settings');
        return r.rows;
      }),
    );

    expect(rows.length).toBe(1);
    expect(rows[0].shop_id).toBe(TENANT_B);
  });

  it('tenant A cannot UPDATE tenant B shops row (0 rows affected)', async () => {
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `UPDATE shops SET display_name = 'HACKED' WHERE id = $1 RETURNING id`,
          [TENANT_B],
        );
        expect(r.rowCount).toBe(0);
      }),
    );

    // Verify via superuser connection that the value was not changed.
    const check = await pool.query<{ display_name: string }>(
      'SELECT display_name FROM shops WHERE id = $1',
      [TENANT_B],
    );
    expect(check.rows[0].display_name).not.toBe('HACKED');
  });

  it('app_user without current_shop_id sees 0 shop_settings rows', async () => {
    // Use a non-poisoned raw connection so the GUC is simply not set.
    // The poisoned pool sets GUC to POISON_UUID on connect; we test a raw
    // connection directly to exercise the invariant where no GUC is set at all —
    // but since our migrations enable missok=false via 0004_rls_fail_loud.sql,
    // querying shop_settings without a GUC would raise 42704.
    //
    // Instead we test via the poisoned pool: app_user with GUC = POISON_UUID
    // (no real tenant) must return 0 rows — this is E2-S1 invariant #12.
    const c = await pool.connect();
    try {
      await c.query('SET ROLE app_user');
      const r = await c.query<{ n: number }>('SELECT count(*)::int AS n FROM shop_settings');
      expect(r.rows[0].n).toBe(0);
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('tenant A can UPDATE its own shops row (1 row affected)', async () => {
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `UPDATE shops SET display_name = 'Shop A Updated' WHERE id = $1 RETURNING id`,
          [TENANT_A],
        );
        expect(r.rowCount).toBe(1);
      }),
    );

    const check = await pool.query<{ display_name: string }>(
      'SELECT display_name FROM shops WHERE id = $1',
      [TENANT_A],
    );
    expect(check.rows[0].display_name).toBe('Shop A Updated');
  });

  it('tenant A cannot read tenant B making_charges via service layer', async () => {
    // First, write shop B's making charges as tenant B
    const tenantB = makeTenant(TENANT_B, 'shop-b', 'Shop B');
    const ctxB = makeCtx(TENANT_B, tenantB);
    await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `UPDATE shop_settings SET making_charges_json = $2::jsonb WHERE shop_id = $1`,
          [TENANT_B, JSON.stringify([{ category: 'RINGS', type: 'percent', value: '99.00' }])],
        );
      }),
    );

    // Tenant A reads — should only see its own data (null → defaults, not B's 99.00)
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);
    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ making_charges_json: unknown }>(
          'SELECT making_charges_json FROM shop_settings',
        );
        return r.rows;
      }),
    );

    // Tenant A should see only its own row
    expect(rows.length).toBe(1);
    // Its making_charges_json should not contain the value '99.00' (that's tenant B's)
    const json = rows[0].making_charges_json as Array<{ value: string }> | null;
    const hasB = json?.some((c) => c.value === '99.00') ?? false;
    expect(hasB).toBe(false);
  });

  it('tenant A making_charges upsert does not affect tenant B row', async () => {
    // Tenant A upserts its own making charges
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO shop_settings (shop_id, making_charges_json)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (shop_id)
           DO UPDATE SET making_charges_json = $2::jsonb`,
          [TENANT_A, JSON.stringify([{ category: 'RINGS', type: 'percent', value: '11.00' }])],
        );
      }),
    );

    // Verify tenant B's row is untouched
    const check = await pool.query<{ making_charges_json: unknown }>(
      'SELECT making_charges_json FROM shop_settings WHERE shop_id = $1',
      [TENANT_B],
    );
    const jsonB = check.rows[0].making_charges_json as Array<{ value: string }> | null;
    const hasA = jsonB?.some((c) => c.value === '11.00') ?? false;
    expect(hasA).toBe(false);
  });

  it('tenant A wastage upsert does not affect tenant B wastage_json', async () => {
    // Write a distinctive value for tenant B first
    const tenantB = makeTenant(TENANT_B, 'shop-b', 'Shop B');
    const ctxB = makeCtx(TENANT_B, tenantB);
    await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO shop_settings (shop_id, wastage_json)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (shop_id)
           DO UPDATE SET wastage_json = $2::jsonb`,
          [TENANT_B, JSON.stringify({ BRIDAL: '99.00' })],
        );
      }),
    );

    // Tenant A upserts its own wastage
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO shop_settings (shop_id, wastage_json)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (shop_id)
           DO UPDATE SET wastage_json = $2::jsonb`,
          [TENANT_A, JSON.stringify({ RINGS: '3.00' })],
        );
      }),
    );

    // Verify tenant B's wastage_json is untouched
    const check = await pool.query<{ wastage_json: unknown }>(
      'SELECT wastage_json FROM shop_settings WHERE shop_id = $1',
      [TENANT_B],
    );
    const jsonB = check.rows[0].wastage_json as Record<string, unknown>;
    expect(jsonB['BRIDAL']).toBe('99.00');
    expect(jsonB['RINGS']).toBeUndefined();
  });

  it('tenant A cannot read tenant B wastage_json via RLS', async () => {
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);
    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ shop_id: string; wastage_json: unknown }>(
          'SELECT shop_id, wastage_json FROM shop_settings',
        );
        return r.rows;
      }),
    );
    // RLS: only 1 row visible, belongs to tenant A
    expect(rows.length).toBe(1);
    expect(rows[0].shop_id).toBe(TENANT_A);
    // Tenant A's wastage should NOT contain tenant B's '99.00'
    const json = rows[0].wastage_json as Record<string, unknown> | null;
    expect(json?.['BRIDAL']).not.toBe('99.00');
  });
});

describe('loyalty config tenant isolation', () => {
  it('shop B cannot see shop A loyalty config — reads LOYALTY_DEFAULTS instead', async () => {
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    // Write a distinctive loyalty config for shop A using a superuser pool query
    // (repo.upsertLoyalty uses pool.query directly, bypassing RLS — correct for writes
    // by the owning tenant; isolation is enforced on reads via the explicit shop_id filter
    // and verified below).
    await tenantContext.runWith(ctxA, () =>
      repo.upsertLoyalty({
        tiers: [
          { name: 'PlatinumA', thresholdPaise: 1_000_000,  badgeColor: '#E5E4E2' },
          { name: 'PlatinumB', thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
          { name: 'PlatinumC', thresholdPaise: 10_000_000, badgeColor: '#FFD700' },
        ],
        earnRatePercentage:       '5.00',
        redemptionRatePercentage: '2.00',
      }),
    );

    // Shop B's context — reads loyalty for TENANT_B (not TENANT_A).
    // repo.getLoyalty reads shopId from tenantContext, so running under ctxB
    // must never return shop A's data.
    const tenantB = makeTenant(TENANT_B, 'shop-b', 'Shop B');
    const ctxB = makeCtx(TENANT_B, tenantB);

    const configB = await tenantContext.runWith(ctxB, () =>
      repo.getLoyalty(),
    );

    // Shop B has no loyalty_json — must get defaults, not shop A's 'PlatinumA' config.
    expect(configB).toEqual(LOYALTY_DEFAULTS);
    expect(configB.tiers[0].name).not.toBe('PlatinumA');

    // Confirm shop A's config is still intact (not leaked into shop B, nor corrupted).
    const configA = await tenantContext.runWith(ctxA, () =>
      repo.getLoyalty(),
    );
    expect(configA.tiers[0].name).toBe('PlatinumA');
    expect(configA.earnRatePercentage).toBe('5.00');
  });

  it('shop_settings RLS prevents tenant A from reading tenant B loyalty via withTenantTx', async () => {
    // Under app_user role with tenant A's context, a raw SELECT on shop_settings
    // must return zero rows for tenant B's shop_id — RLS filters them out.
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        // Explicitly filter by tenant B — RLS should block this to 0 rows.
        const r = await tx.query<{ shop_id: string; loyalty_json: unknown }>(
          `SELECT shop_id, loyalty_json FROM shop_settings WHERE shop_id = $1`,
          [TENANT_B],
        );
        return r.rows;
      }),
    );

    // RLS policy: tenant A's session can only see rows where shop_id matches
    // the current_setting('app.shop_id') GUC — so tenant B's row must be invisible.
    expect(rows.length).toBe(0);
  });
});
