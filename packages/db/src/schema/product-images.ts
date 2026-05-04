import { uuid, text, timestamp, integer, bigint } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';
import { shopUsers } from './shop-users';

export const productImages = tenantScopedTable('product_images', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  product_id:           uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  storage_key:          text('storage_key').notNull(),
  alt_text:             text('alt_text'),
  mime_type:            text('mime_type').notNull(),
  byte_size:            bigint('byte_size', { mode: 'number' }).notNull(),
  width:                integer('width').notNull(),
  height:               integer('height').notNull(),
  exif_stripped_at:     timestamp('exif_stripped_at', { withTimezone: true }).notNull(),
  uploaded_by_user_id:  uuid('uploaded_by_user_id').notNull().references(() => shopUsers.id),
  scan_status:          text('scan_status').notNull().default('clean'),
  sort_order:           integer('sort_order').notNull().default(0),
  // Per migration 0058: nullable; partial UNIQUE(product_id, idempotency_key)
  // when NOT NULL — supports F7 idempotent upload retries.
  idempotency_key:      text('idempotency_key'),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
