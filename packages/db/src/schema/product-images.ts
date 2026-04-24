import { uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';

export const productImages = tenantScopedTable('product_images', {
  id:          uuid('id').primaryKey().defaultRandom(),
  product_id:  uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  storage_key: text('storage_key').notNull(),
  variant:     text('variant').notNull().default('original'),
  sort_order:  integer('sort_order').notNull().default(0),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
