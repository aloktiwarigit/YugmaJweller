import { uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const creditNotes = tenantScopedTable('credit_notes', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  original_invoice_id:  uuid('original_invoice_id').notNull(),
  credit_number:        text('credit_number').notNull(),
  reason:               text('reason').notNull(),
  total_paise:          bigint('total_paise', { mode: 'bigint' }).notNull(),
  issued_at:            timestamp('issued_at',  { withTimezone: true }).notNull().defaultNow(),
  issued_by_user_id:    uuid('issued_by_user_id').notNull(),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
