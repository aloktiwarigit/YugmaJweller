import type { Pool, PoolClient } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { POISON_UUID } from './provider';

export async function withTenantTx<T>(
  pool: Pool,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const ctx = tenantContext.current();
  if (!ctx) throw new Error('tenant.context_not_set');
  return withShopTx(pool, ctx.shopId, fn);
}

export async function withShopTx<T>(
  pool: Pool,
  shopId: string,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  if (typeof (pool as { connect?: unknown }).connect !== 'function') {
    return fn(pool as unknown as PoolClient);
  }

  const client = await pool.connect();
  if (!client || typeof (client as { query?: unknown }).query !== 'function') {
    return fn(pool as unknown as PoolClient);
  }
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    // Parameter-bound via set_config() — never string-interpolate shopId into SQL.
    // is_local=true makes this equivalent to SET LOCAL (rolled back at COMMIT/ROLLBACK).
    await client.query('SELECT set_config($1, $2, true)', ['app.current_shop_id', shopId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    // Reset session-level shop context to poison default before returning to pool.
    // SET LOCAL is rolled back with the transaction, but any prior session-level
    // SET (e.g. from seed scripts) persists. Explicitly re-poison here so that
    // a recycled connection never leaks tenant state to the next caller.
    // is_local=false → equivalent to plain SET (session-scoped, persists across txns
    // on this connection until next set_config or pool release).
    await client
      .query('SELECT set_config($1, $2, false)', ['app.current_shop_id', POISON_UUID])
      .catch(() => undefined);
    client.release();
  }
}
