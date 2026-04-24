import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import type { TenantContext } from '@goldsmith/tenant-context';
import type { PullRequest, PullResponse, SyncTable, TableChanges } from '../protocol';

interface ChangeLogRow {
  seq: string;
  table_name: string;
  row_id: string;
  operation: string;
  payload: Record<string, unknown> | null;
}

// Pure grouping logic — exported for unit testing without DB dependency.
export function groupChangeRows(
  rows: ChangeLogRow[],
  tables: SyncTable[],
): Partial<Record<SyncTable, TableChanges>> {
  const changes: Partial<Record<SyncTable, TableChanges>> = {};

  for (const table of tables) {
    changes[table] = { created: [], updated: [], deleted: [] };
  }

  for (const row of rows) {
    const table = row.table_name as SyncTable;
    if (!tables.includes(table)) continue;
    const bucket = changes[table]!;
    if (row.operation === 'DELETE') {
      bucket.deleted.push({ id: row.row_id });
    } else if (row.operation === 'INSERT') {
      bucket.created.push(row.payload ?? {});
    } else {
      bucket.updated.push(row.payload ?? {});
    }
  }

  return changes;
}

export async function pull(
  pool: Pool,
  ctx: TenantContext,
  req: PullRequest,
): Promise<PullResponse> {
  // Read the change log rows AND the cursor inside the same transaction snapshot.
  // If we read the cursor after the transaction, concurrent writes between the two reads
  // would produce a cursor higher than the last row we returned, causing those rows to
  // be skipped on the client's next pull.
  const { rows, cursor } = await withTenantTx(pool, async (tx) => {
    const changeRows = await tx.query<ChangeLogRow>(
      `SELECT seq, table_name, row_id, operation, payload
       FROM sync_change_log
       WHERE seq > $1
         AND table_name = ANY($2::text[])
       ORDER BY seq ASC`,
      [req.lastCursor.toString(), req.tables],
    );
    // tenant_sync_cursors has no RLS; app_user has SELECT grant — safe inside tx
    const cursorRow = await tx.query<{ cursor: string }>(
      `SELECT cursor FROM tenant_sync_cursors WHERE shop_id = $1`,
      [ctx.shopId],
    );
    const snapshotCursor = cursorRow.rows[0] ? BigInt(cursorRow.rows[0].cursor) : req.lastCursor;
    return { rows: changeRows.rows, cursor: snapshotCursor };
  });

  const changes = groupChangeRows(rows, req.tables);
  return { changes, cursor };
}
