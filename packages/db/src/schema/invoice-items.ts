import { uuid, text, integer, bigint, decimal } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { invoices } from './invoices';
import { products } from './products';

export const invoiceItems = tenantScopedTable('invoice_items', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  invoice_id:            uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  product_id:            uuid('product_id').references(() => products.id),
  description:           text('description').notNull(),
  hsn_code:              text('hsn_code').notNull().default('7113'),
  huid:                  text('huid'),
  metal_type:            text('metal_type'),
  purity:                text('purity'),
  net_weight_g:          decimal('net_weight_g',          { precision: 12, scale: 4 }),
  rate_per_gram_paise:   bigint('rate_per_gram_paise',    { mode: 'bigint' }),
  making_charge_pct:     decimal('making_charge_pct',     { precision: 5, scale: 2 }),
  gold_value_paise:      bigint('gold_value_paise',       { mode: 'bigint' }).notNull(),
  making_charge_paise:   bigint('making_charge_paise',    { mode: 'bigint' }).notNull(),
  stone_charges_paise:   bigint('stone_charges_paise',    { mode: 'bigint' }).notNull().default(0n),
  hallmark_fee_paise:    bigint('hallmark_fee_paise',     { mode: 'bigint' }).notNull().default(0n),
  gst_metal_paise:       bigint('gst_metal_paise',        { mode: 'bigint' }).notNull(),
  gst_making_paise:      bigint('gst_making_paise',       { mode: 'bigint' }).notNull(),
  line_total_paise:      bigint('line_total_paise',       { mode: 'bigint' }).notNull(),
  sort_order:            integer('sort_order').notNull().default(0),
});
