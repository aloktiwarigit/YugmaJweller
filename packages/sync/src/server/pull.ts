import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import type { TenantContext } from '@goldsmith/tenant-context';
import { getCurrentCursor } from './cursor';
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
  const rows = await withTenantTx(pool, async (tx) => {
    const r = await tx.query<ChangeLogRow>(
      `SELECT seq, table_name, row_id, operation, payload
       FROM sync_change_log
       WHERE seq > $1
         AND table_name = ANY($2::text[])
       ORDER BY seq ASC`,
      [req.lastCursor.toString(), req.tables],
    );
    return r.rows;
  });

  const changes = groupChangeRows(rows, req.tables);
  const cursor = await getCurrentCursor(pool, ctx.shopId);
  return { changes, cursor };
}
