import { uuid, bigint, timestamp } from 'drizzle-orm/pg-core';
import { platformGlobalTableWithRls } from './_helpers/platformGlobalTable';
import { shops } from './shops';

// One row per tenant. Migration 0040 added defence-in-depth RLS scoped by shop_id.
// Registered as global-rls: SELECT is platform-global; DML is tenant-scoped.
export const tenantSyncCursors = platformGlobalTableWithRls('tenant_sync_cursors', {
  shop_id: uuid('shop_id').primaryKey().references(() => shops.id, { onDelete: 'cascade' }),
  cursor: bigint('cursor', { mode: 'bigint' }).notNull().default(0n),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
