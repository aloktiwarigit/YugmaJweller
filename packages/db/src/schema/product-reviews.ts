import { uuid, smallint, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';
import { customers } from './customers';

export const productReviews = tenantScopedTable('product_reviews', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  product_id:          uuid('product_id').notNull().references(() => products.id),
  customer_id:         uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  rating:              smallint('rating').notNull(),
  review_text:         text('review_text'),
  is_publicly_visible: boolean('is_publicly_visible').notNull().default(true),
  created_at:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
