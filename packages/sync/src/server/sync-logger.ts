import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { advanceCursor } from './cursor';
import type { SyncTable } from '../protocol';

// Logs a syncable write to sync_change_log.
// MUST be called inside an open withTenantTx — shares the caller's transaction
// to ensure atomicity between the application write and the change log entry.
@Injectable()
export class SyncLogger {
  async logInTx(
    tx: PoolClient,
    shopId: string,
    tableName: SyncTable,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown> | null,
  ): Promise<bigint> {
    const seq = await advanceCursor(tx, shopId);
    await tx.query(
      `INSERT INTO sync_change_log
         (shop_id, seq, table_name, row_id, operation, payload)
       VALUES
         (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5)`,
      [seq.toString(), tableName, rowId, operation, payload ? JSON.stringify(payload) : null],
    );
    return seq;
  }
}
