import { uuid, text, bigint, date, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const customOrders = tenantScopedTable('custom_orders', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  customer_id:             uuid('customer_id'),
  description:             text('description').notNull(),
  design_reference_url:    text('design_reference_url'),
  quoted_amount_paise:     bigint('quoted_amount_paise', { mode: 'bigint' }),
  deposit_amount_paise:    bigint('deposit_amount_paise', { mode: 'bigint' }).notNull().default(0n),
  deposit_paid_paise:      bigint('deposit_paid_paise', { mode: 'bigint' }).notNull().default(0n),
  razorpay_order_id:       text('razorpay_order_id'),
  razorpay_payment_id:     text('razorpay_payment_id'),
  status:                  text('status').notNull().default('QUOTE'),
  estimated_delivery_date: date('estimated_delivery_date'),
  created_at:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customOrderMilestones = tenantScopedTable('custom_order_milestones', {
  id:              uuid('id').primaryKey().defaultRandom(),
  custom_order_id: uuid('custom_order_id').notNull(),
  title:           text('title').notNull(),
  note:            text('note'),
  photo_url:       text('photo_url'),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
});
