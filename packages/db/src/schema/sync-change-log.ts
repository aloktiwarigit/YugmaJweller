import { bigserial, bigint, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

// Append-only log of every syncable change. RLS on shop_id (auto-added by tenantScopedTable).
export const syncChangeLog = tenantScopedTable('sync_change_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  seq: bigint('seq', { mode: 'bigint' }).notNull(),
  table_name: text('table_name').notNull(),
  row_id: text('row_id').notNull(),
  operation: text('operation').notNull(),
  payload: jsonb('payload'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
