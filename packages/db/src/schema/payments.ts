import { uuid, text, bigint, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { invoices } from './invoices';

export const payments = tenantScopedTable('payments', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  invoice_id:            uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  method:                text('method').notNull(),
  amount_paise:          bigint('amount_paise', { mode: 'bigint' }).notNull(),
  status:                text('status').notNull().default('PENDING'),
  recorded_at:           timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  created_by_user_id:    uuid('created_by_user_id').notNull(),
  idempotency_key:       text('idempotency_key'),
  pmla_warning_jsonb:    jsonb('pmla_warning_jsonb'),
  razorpay_order_id:     text('razorpay_order_id'),
  razorpay_payment_id:   text('razorpay_payment_id'),
  webhook_status:        text('webhook_status').notNull().default('NA'),
  webhook_received_at:   timestamp('webhook_received_at', { withTimezone: true }),
  failure_reason:        text('failure_reason'),
});
