import { uuid, text, bigint, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

// Tracks daily cash per customer per shop for Section 269ST (Rs 1,99,999 cap)
// and monthly cash for PMLA (Rs 10L cap). Append-only upserts via
// INSERT ... ON CONFLICT DO UPDATE (see payment.service.ts).
// shop_id is injected by tenantScopedTable helper.
export const pmlaAggregates = tenantScopedTable('pmla_aggregates', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     uuid('customer_id'),
  customerPhone:  text('customer_phone'),
  aggregateDate:  date('aggregate_date').notNull(),   // YYYY-MM-DD IST
  aggregateMonth: text('aggregate_month').notNull(),  // YYYY-MM IST
  cashTotalPaise: bigint('cash_total_paise', { mode: 'bigint' }).notNull().default(0n),
  invoiceCount:   integer('invoice_count').notNull().default(0),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
