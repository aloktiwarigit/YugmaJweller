import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb';
const USER_A = 'cccccccc-cccc-4000-8000-cccccccccccc';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let customerAId: string;

function makeCtx(shopId: string): UnauthenticatedTenantContext {
  const tenant: Tenant = { id: shopId, slug: `shop-${shopId.slice(0, 4)}`, display_name: 'Test', status: 'ACTIVE' };
  return { shopId, tenant, authenticated: false };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'shop-a', 'Shop A', 'ACTIVE'), ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally { c.release(); }
  const row = await tenantContext.runWith(makeCtx(SHOP_A), () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id) VALUES ($1, '+919876543210', 'Ravi Kumar', false, $2) RETURNING id`,
        [SHOP_A, USER_A],
      );
      return r.rows[0];
    }),
  );
  customerAId = row.id;
}, 120_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('CRM tenant isolation', () => {
  it('Tenant A can read its own customer', async () => {
    const rows = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(`SELECT id FROM customers WHERE id = $1`, [customerAId]);
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(customerAId);
  });

  it('Tenant B cannot read Tenant A customer (RLS → 0 rows)', async () => {
    const rows = await tenantContext.runWith(makeCtx(SHOP_B), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(`SELECT id FROM customers WHERE id = $1`, [customerAId]);
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it('same phone can exist in two different shops', async () => {
    const phone = '+919000000001';
    await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(`INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id) VALUES ($1, $2, 'A-1', false, $1)`, [SHOP_A, phone]);
      }),
    );
    await tenantContext.runWith(makeCtx(SHOP_B), () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(`INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id) VALUES ($1, $2, 'B-1', false, $1)`, [SHOP_B, phone]);
      }),
    );
    const countA = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM customers WHERE phone = $1`, [phone]);
        return parseInt(r.rows[0].c, 10);
      }),
    );
    const countB = await tenantContext.runWith(makeCtx(SHOP_B), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM customers WHERE phone = $1`, [phone]);
        return parseInt(r.rows[0].c, 10);
      }),
    );
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('duplicate phone within same shop is rejected (unique index)', async () => {
    const phone = '+919111111111';
    await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(`INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id) VALUES ($1, $2, 'Dup', false, $1)`, [SHOP_A, phone]);
      }),
    );
    await expect(
      tenantContext.runWith(makeCtx(SHOP_A), () =>
        withTenantTx(pool, async (tx) => {
          await tx.query(`INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id) VALUES ($1, $2, 'Dup2', false, $1)`, [SHOP_A, phone]);
        }),
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('PAN column is bytea — stores binary, not plaintext', async () => {
    const fakeBinary = Buffer.from('binary-encrypted-payload');
    const insertedId = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO customers (shop_id, phone, name, pan_ciphertext, pan_key_id, viewing_consent, created_by_user_id) VALUES ($1, '+919222222222', 'PAN Test', $2, 'arn:test', false, $1) RETURNING id`,
          [SHOP_A, fakeBinary],
        );
        return r.rows[0].id;
      }),
    );
    const row = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ pan_ciphertext: Buffer }>(`SELECT pan_ciphertext FROM customers WHERE id = $1`, [insertedId]);
        return r.rows[0];
      }),
    );
    expect(Buffer.isBuffer(row.pan_ciphertext)).toBe(true);
    expect(row.pan_ciphertext.toString()).not.toBe('ABCDE1234F');
  });
});