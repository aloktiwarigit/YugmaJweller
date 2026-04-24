import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import type { TenantContext } from '@goldsmith/tenant-context';
import { resolveConflict } from './conflict-resolver';
import { advanceCursor } from './cursor';
import type { ConflictRecord, PushRequest, PushResponse, SyncTable, TableChanges } from '../protocol';

const IDEMPOTENCY_TTL_SEC = 3600;

// Minimal Redis interface — avoids importing ioredis types in tests
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: 'EX', ttl: number): Promise<unknown>;
}

// Exported for unit testing
export function buildConflict(
  table: SyncTable,
  rowId: string,
  reason: string,
  serverState: Record<string, unknown> | null,
): ConflictRecord {
  return { table, rowId, reason, serverState };
}

async function logChange(
  tx: PoolClient,
  shopId: string,
  table: SyncTable,
  rowId: string,
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>,
): Promise<void> {
  const seq = await advanceCursor(tx, shopId);
  await tx.query(
    `INSERT INTO sync_change_log
       (shop_id, seq, table_name, row_id, operation, payload)
     VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5)`,
    [seq.toString(), table, rowId, op, JSON.stringify(payload)],
  );
}

async function applyProductChanges(
  tx: PoolClient,
  shopId: string,
  changes: TableChanges,
  conflicts: ConflictRecord[],
): Promise<void> {
  for (const row of changes.created) {
    const r = row as Record<string, unknown>;
    const rowId = String(r['id'] ?? r['server_id'] ?? '');

    const existing = await tx.query<Record<string, unknown>>(
      `SELECT id, updated_at FROM products WHERE id = $1`,
      [rowId],
    );
    const serverRow = existing.rows[0] ?? null;

    if (serverRow && resolveConflict('products', r, serverRow) === 'reject') {
      conflicts.push(buildConflict('products', rowId, 'lww.client_older', serverRow));
      continue;
    }

    await tx.query(
      `INSERT INTO products
         (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
          stone_weight_g, huid, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        rowId, shopId,
        String(r['sku'] ?? ''), String(r['metal'] ?? ''), String(r['purity'] ?? ''),
        String(r['gross_weight_g'] ?? '0.000'), String(r['net_weight_g'] ?? '0.000'),
        String(r['stone_weight_g'] ?? '0.000'), r['huid'] ?? null,
        String(r['status'] ?? 'IN_STOCK'), r['created_by_user_id'] ?? null,
      ],
    );
    await logChange(tx, shopId, 'products', rowId, 'INSERT', r);
  }

  for (const row of changes.updated) {
    const r = row as Record<string, unknown>;
    const rowId = String(r['id'] ?? '');

    const existing = await tx.query<Record<string, unknown>>(
      `SELECT id, updated_at FROM products WHERE id = $1`,
      [rowId],
    );
    const serverRow = existing.rows[0] ?? null;
    if (!serverRow) continue;

    if (resolveConflict('products', r, serverRow) === 'reject') {
      conflicts.push(buildConflict('products', rowId, 'lww.client_older', serverRow));
      continue;
    }

    await tx.query(
      `UPDATE products
       SET status     = COALESCE($1, status),
           huid       = COALESCE($2, huid),
           updated_at = now()
       WHERE id = $3`,
      [r['status'] ?? null, r['huid'] ?? null, rowId],
    );
    await logChange(tx, shopId, 'products', rowId, 'UPDATE', r);
  }
}

export async function push(
  pool: Pool,
  redis: RedisLike,
  ctx: TenantContext,
  req: PushRequest,
): Promise<PushResponse> {
  const idempotencyKey = `sync:idempotency:${req.idempotencyKey}`;
  const cached = await redis.get(idempotencyKey);
  if (cached) {
    const parsed = JSON.parse(cached) as { cursor: string; conflicts: ConflictRecord[] };
    return { cursor: BigInt(parsed.cursor), conflicts: parsed.conflicts };
  }

  const conflicts: ConflictRecord[] = [];
  let newCursor = 0n;

  await withTenantTx(pool, async (tx) => {
    for (const [table, changes] of Object.entries(req.changes)) {
      if (table === 'products') {
        await applyProductChanges(tx, ctx.shopId, changes, conflicts);
      }
      // customers and shop_settings deferred to future stories
    }

    const r = await tx.query<{ cursor: string }>(
      `SELECT cursor FROM tenant_sync_cursors WHERE shop_id = $1`,
      [ctx.shopId],
    );
    newCursor = r.rows[0] ? BigInt(r.rows[0].cursor) : 0n;
  });

  const response: PushResponse = { cursor: newCursor, conflicts };
  await redis.set(
    idempotencyKey,
    JSON.stringify({ cursor: newCursor.toString(), conflicts }),
    'EX',
    IDEMPOTENCY_TTL_SEC,
  );
  return response;
}
