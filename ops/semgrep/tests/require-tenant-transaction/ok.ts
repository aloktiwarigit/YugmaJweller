import { pool, withTenantTx } from '@goldsmith/db';
export async function ok() {
  return withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows);
}
