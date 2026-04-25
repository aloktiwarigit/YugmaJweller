import { uuid, text, bigint, timestamp, customType } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

const bytea = customType<{ data: Buffer }>({
  dataType() { return 'bytea'; },
});

export const invoices = tenantScopedTable('invoices', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  invoice_number:       text('invoice_number').notNull(),
  invoice_type:         text('invoice_type').notNull().default('B2C'),
  customer_id:          uuid('customer_id'),
  customer_name:        text('customer_name').notNull(),
  customer_phone:       text('customer_phone'),
  status:               text('status').notNull().default('DRAFT'),
  subtotal_paise:       bigint('subtotal_paise',     { mode: 'bigint' }).notNull(),
  gst_metal_paise:      bigint('gst_metal_paise',    { mode: 'bigint' }).notNull(),
  gst_making_paise:     bigint('gst_making_paise',   { mode: 'bigint' }).notNull(),
  total_paise:          bigint('total_paise',        { mode: 'bigint' }).notNull(),
  idempotency_key:      text('idempotency_key').notNull(),
  issued_at:            timestamp('issued_at',  { withTimezone: true }),
  created_by_user_id:   uuid('created_by_user_id').notNull(),
  // PAN Rule 114B — encrypted at app layer; only present when total >= Rs 2,00,000
  pan_ciphertext:       bytea('pan_ciphertext'),
  pan_key_id:           text('pan_key_id'),
  form60_encrypted:     bytea('form60_encrypted'),
  form60_key_id:        text('form60_key_id'),
  buyer_gstin:          text('buyer_gstin'),
  buyer_business_name:  text('buyer_business_name'),
  seller_state_code:    text('seller_state_code').notNull().default('09'),
  gst_treatment:        text('gst_treatment').notNull().default('CGST_SGST'),
  cgst_metal_paise:     bigint('cgst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
  sgst_metal_paise:     bigint('sgst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
  cgst_making_paise:    bigint('cgst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
  sgst_making_paise:    bigint('sgst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
  igst_metal_paise:     bigint('igst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
  igst_making_paise:    bigint('igst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
