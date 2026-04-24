import { uuid, bigint, timestamp } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

// One row per tenant. cursor advances on every syncable write.
// No RLS — PK-scoped by shop_id. Use SELECT FOR UPDATE when advancing.
export const tenantSyncCursors = platformGlobalTable('tenant_sync_cursors', {
  shop_id: uuid('shop_id').primaryKey(),
  cursor: bigint('cursor', { mode: 'bigint' }).notNull().default(0n),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
