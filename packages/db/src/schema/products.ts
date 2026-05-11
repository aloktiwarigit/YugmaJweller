import { uuid, text, timestamp, decimal, integer, smallint, bigint, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { productCategories } from './product-categories';

export const huidExemptionCategoryEnum = pgEnum('huid_exemption_category', [
  'none',
  'kundan_polki_jadau',
  'under_2g',
]);

export const CATALOG_STYLES = [
  'ENGAGEMENT', 'COUPLE', 'DAILY_WEAR', 'JHUMKA', 'STUDS', 'HOOPS',
  'DROP', 'STATEMENT', 'TEMPLE', 'BRIDAL', 'OFFICE', 'KIDS',
] as const;
export type CatalogStyle = typeof CATALOG_STYLES[number];

export const products = tenantScopedTable('products', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  category_id:                uuid('category_id').references(() => productCategories.id),
  sku:                        text('sku').notNull(),
  metal:                      text('metal').notNull(),
  purity:                     text('purity').notNull(),
  gross_weight_g:             decimal('gross_weight_g', { precision: 12, scale: 4 }).notNull(),
  net_weight_g:               decimal('net_weight_g',   { precision: 12, scale: 4 }).notNull(),
  stone_weight_g:             decimal('stone_weight_g', { precision: 12, scale: 4 }).default('0.0000').notNull(),
  stone_details:              text('stone_details'),
  making_charge_override_pct: decimal('making_charge_override_pct', { precision: 5, scale: 2 }),
  huid:                       text('huid'),
  huid_exemption_category:    huidExemptionCategoryEnum('huid_exemption_category').notNull().default('none'),
  status:                     text('status').notNull().default('IN_STOCK'),
  quantity:                   integer('quantity').notNull().default(1),
  published_at:               timestamp('published_at', { withTimezone: true }),
  published_by_user_id:       uuid('published_by_user_id'),
  created_by_user_id:         uuid('created_by_user_id').notNull(),
  created_at:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // -------------------------------------------------------------------------
  // Storefront columns — added in migration 0066 (Story A1)
  // -------------------------------------------------------------------------
  style:                      text('style'),
  occasion:                   text('occasion').array().notNull().default([]),
  gift_persona:               text('gift_persona').array().notNull().default([]),
  featured_score:             smallint('featured_score').notNull().default(0),
  sales_count_30d:            integer('sales_count_30d').notNull().default(0),
  view_count_30d:             integer('view_count_30d').notNull().default(0),
  price_snapshot_paise:       bigint('price_snapshot_paise', { mode: 'bigint' }),
  price_snapshot_at:          timestamp('price_snapshot_at', { withTimezone: true }),
  published_search_idx_at:    timestamp('published_search_idx_at', { withTimezone: true }),
  // -------------------------------------------------------------------------
  // Primary image reference — added in migration 0068 (Story A3)
  // Composite FK enforced at DDL layer (see migration 0068).
  // Drizzle does not model composite FKs natively; constraint lives in SQL.
  // -------------------------------------------------------------------------
  primary_image_id:           uuid('primary_image_id'),
});
