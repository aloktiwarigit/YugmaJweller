import { uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { invoices } from './invoices';

export const payments = tenantScopedTable('payments', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  invoice_id:          uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  method:              text('method').notNull(),
  amount_paise:        bigint('amount_paise', { mode: 'bigint' }).notNull(),
  status:              text('status').notNull().default('PENDING'),
  recorded_at:         timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  created_by_user_id:  uuid('created_by_user_id').notNull(),
});
