import { uuid, text, timestamp, decimal, integer } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { productCategories } from './product-categories';

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
  status:                     text('status').notNull().default('IN_STOCK'),
  quantity:                   integer('quantity').notNull().default(1),
  published_at:               timestamp('published_at', { withTimezone: true }),
  published_by_user_id:       uuid('published_by_user_id'),
  created_by_user_id:         uuid('created_by_user_id').notNull(),
  created_at:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
