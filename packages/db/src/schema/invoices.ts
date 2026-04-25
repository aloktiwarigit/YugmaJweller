import { uuid, text, bigint, timestamp, jsonb, customType } from 'drizzle-orm/pg-core';
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
  // Section 269ST supervisor override metadata — stored when OWNER/MANAGER overrides cash-cap block
  compliance_overrides_jsonb: jsonb('compliance_overrides_jsonb'),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
