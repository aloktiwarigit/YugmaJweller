import { uuid, text, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';
import { productImages } from './product-images';

// shop_id is auto-injected by tenantScopedTable — do NOT redeclare it here.
export const productTryOnAssets = tenantScopedTable('product_try_on_assets', {
  id:                uuid('id').primaryKey().defaultRandom(),
  product_id:        uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  source_image_id:   uuid('source_image_id').references(() => productImages.id, { onDelete: 'set null' }),
  body_part:         text('body_part').notNull(),
  asset_storage_key: text('asset_storage_key'),
  anchor_x:          decimal('anchor_x', { precision: 5, scale: 4 }).notNull().default('0.5000'),
  anchor_y:          decimal('anchor_y', { precision: 5, scale: 4 }).notNull().default('0.0000'),
  status:            text('status').notNull().default('pending'),
  enabled:           boolean('enabled').notNull().default(false),
  created_at:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
