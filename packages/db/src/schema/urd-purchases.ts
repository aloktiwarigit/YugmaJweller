import { uuid, text, decimal, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { invoices } from './invoices';

export const urdPurchases = tenantScopedTable('urd_purchases', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  customer_id:          uuid('customer_id'),
  customer_name:        text('customer_name').notNull(),
  customer_phone:       text('customer_phone'),
  metal_type:           text('metal_type').notNull(),
  purity:               text('purity').notNull(),
  weight_g:             decimal('weight_g', { precision: 12, scale: 4 }).notNull(),
  agreed_rate_paise:    bigint('agreed_rate_paise',     { mode: 'bigint' }).notNull(),
  gold_value_paise:     bigint('gold_value_paise',      { mode: 'bigint' }).notNull(),
  rcm_gst_paise:        bigint('rcm_gst_paise',         { mode: 'bigint' }).notNull(),
  net_to_customer_paise: bigint('net_to_customer_paise', { mode: 'bigint' }).notNull(),
  self_invoice_number:  text('self_invoice_number').notNull(),
  self_invoice_text:    text('self_invoice_text').notNull(),
  linked_invoice_id:    uuid('linked_invoice_id').references(() => invoices.id),
  recorded_by_user_id:  uuid('recorded_by_user_id').notNull(),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});