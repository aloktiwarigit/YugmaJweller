// packages/db/src/schema/collections.ts
import { uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const collections = tenantScopedTable('collections', {
  id:            uuid('id').primaryKey().defaultRandom(),
  slug:          text('slug').notNull(),
  title_hi:      text('title_hi').notNull(),
  title_en:      text('title_en'),
  subtitle_hi:   text('subtitle_hi'),
  // Nullable; composite FK (shop_id, hero_image_id) → product_images enforced in 0067 SQL.
  hero_image_id: uuid('hero_image_id'),
  sort_order:    integer('sort_order').notNull().default(0),
  is_premium:    boolean('is_premium').notNull().default(false),
  published_at:  timestamp('published_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Composite PK (shop_id, collection_id, product_id) defined in SQL migration 0067.
// Drizzle does not emit DDL for this table — the SQL migration is authoritative.
export const collectionProducts = tenantScopedTable('collection_products', {
  collection_id: uuid('collection_id').notNull(),
  product_id:    uuid('product_id').notNull(),
  sort_order:    integer('sort_order').notNull().default(0),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
