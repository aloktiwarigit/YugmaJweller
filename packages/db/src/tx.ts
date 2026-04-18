import type { Pool, PoolClient } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { POISON_UUID } from './provider';

export async function withTenantTx<T>(
  pool: Pool,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const ctx = tenantContext.current();
  if (!ctx) throw new Error('tenant.context_not_set');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
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
    await client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
    client.release();
  }
}
