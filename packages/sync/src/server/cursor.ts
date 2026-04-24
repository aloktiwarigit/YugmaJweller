import type { Pool, PoolClient } from 'pg';

// Advance cursor atomically. MUST be called inside an open pg transaction.
// Uses INSERT ON CONFLICT DO NOTHING (ensure row exists) then SELECT FOR UPDATE
// to serialize concurrent increments per tenant.
export async function advanceCursor(tx: PoolClient, shopId: string): Promise<bigint> {
  await tx.query(
    `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)
     ON CONFLICT (shop_id) DO NOTHING`,
    [shopId],
  );
  await tx.query(
    `SELECT cursor FROM tenant_sync_cursors WHERE shop_id = $1 FOR UPDATE`,
    [shopId],
  );
  const r = await tx.query<{ cursor: string }>(
    `UPDATE tenant_sync_cursors
     SET cursor = cursor + 1, updated_at = now()
     WHERE shop_id = $1
     RETURNING cursor`,
    [shopId],
  );
  return BigInt(r.rows[0]!.cursor);
}

// Read current cursor without locking — safe for pull reads.
export async function getCurrentCursor(pool: Pool, shopId: string): Promise<bigint> {
  const r = await pool.query<{ cursor: string }>(
    `SELECT cursor FROM tenant_sync_cursors WHERE shop_id = $1`,
    [shopId],
  );
  return r.rows[0] ? BigInt(r.rows[0].cursor) : 0n;
}
