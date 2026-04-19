import type { Pool } from 'pg';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { withTenantTx, tableRegistry } from '@goldsmith/db';
import { fixtureRegistry } from '../fixtures/registry';
import '../fixtures/tenant-a';
import '../fixtures/tenant-b';
import '../fixtures/tenant-c';

export interface HarnessResult { ok: boolean; failures: string[]; }

export async function provisionFixtures(pool: Pool): Promise<void> {
  const c = await pool.connect();
  try {
    for (const t of fixtureRegistry.list()) {
      await c.query(
        `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.slug, t.displayName],
      );
    }
  } finally { c.release(); }
  for (const t of fixtureRegistry.list()) await t.seed(pool, t.id);
}

export async function runTenantIsolationHarness(pool: Pool): Promise<HarnessResult> {
  const fails: string[] = [];
  const tenants = fixtureRegistry.list();
  const tenantTables = tableRegistry.list().filter((m) => m.kind === 'tenant');

  for (const self of tenants) {
    const tenant: Tenant = {
      id: self.id,
      slug: self.slug,
      display_name: self.displayName,
      status: 'ACTIVE',
    };
    const ctx: UnauthenticatedTenantContext = {
      shopId: self.id,
      tenant,
      authenticated: false,
    };
    for (const meta of tenantTables) {
      const rows = await tenantContext.runWith(ctx, () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query(`SELECT shop_id FROM ${meta.name}`);
          return r.rows as Array<{ shop_id: string }>;
        }),
      );
      for (const row of rows) {
        if (row.shop_id !== self.id) {
          fails.push(`${self.slug}: leaked row ${row.shop_id} from ${meta.name} (invariant 13)`);
        }
      }
    }
  }

  const c = await pool.connect();
  try {
    await c.query('SET ROLE app_user');
    for (const meta of tenantTables) {
      const r = await c.query(`SELECT count(*)::int AS n FROM ${meta.name}`);
      if ((r.rows[0] as { n: number }).n !== 0) {
        fails.push(`${meta.name}: no-ctx read returned rows (invariant 12)`);
      }
    }
  } finally {
    await c.query('RESET ROLE').catch(() => undefined);
    c.release();
  }

  return { ok: fails.length === 0, failures: fails };
}
