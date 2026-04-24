import { uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const productCategories = tenantScopedTable('product_categories', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull(),
  name_hi:    text('name_hi'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
