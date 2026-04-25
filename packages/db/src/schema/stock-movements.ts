import { uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';

export const stockMovements = tenantScopedTable('stock_movements', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  product_id:          uuid('product_id').notNull().references(() => products.id),
  type:                text('type').notNull(),
  reason:              text('reason').notNull(),
  quantity_delta:      integer('quantity_delta').notNull(),
  balance_before:      integer('balance_before').notNull(),
  balance_after:       integer('balance_after').notNull(),
  source_name:         text('source_name'),
  source_id:           uuid('source_id'),
  recorded_by_user_id: uuid('recorded_by_user_id').notNull(),
  recorded_at:         timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});
