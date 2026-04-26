import { uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';
import { invoices } from './invoices';

// Append-only ledger of every loyalty-points credit/debit.
// DB-enforced immutability via trigger; reversal is a NEW row, never an edit.
// Parity with stock_movements (Story 3.8): SELECT + INSERT grants only on app_user.
export const loyaltyTransactions = tenantScopedTable('loyalty_transactions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     uuid('customer_id').notNull().references(() => customers.id),
  invoiceId:      uuid('invoice_id').references(() => invoices.id), // null for manual adjustments
  type:           text('type').notNull(), // 'ACCRUAL'|'REDEMPTION'|'ADJUSTMENT_IN'|'ADJUSTMENT_OUT'|'REVERSAL'
  pointsDelta:    integer('points_delta').notNull(), // signed
  balanceBefore:  integer('balance_before').notNull(),
  balanceAfter:   integer('balance_after').notNull(),
  reason:         text('reason').notNull(),
  createdByUserId: uuid('created_by_user_id'), // null for system-driven (worker accrual)
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
