import { uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';

// Running aggregate — exactly one row per customer.
// Updated under FOR UPDATE inside the same withTenantTx that inserts the
// matching loyalty_transactions row, so balance and ledger never diverge.
export const customerLoyalty = tenantScopedTable('customer_loyalty', {
  id:              uuid('id').primaryKey().defaultRandom(),
  customerId:      uuid('customer_id').notNull().unique().references(() => customers.id),
  pointsBalance:   integer('points_balance').notNull().default(0),
  // Lifetime points: only ACCRUAL increments this; adjustments and redemptions don't.
  // Drives tier calculation in Story 8.2.
  lifetimePoints:  integer('lifetime_points').notNull().default(0),
  currentTier:     text('current_tier'),
  tierSince:       timestamp('tier_since', { withTimezone: true }),
  lastUpdatedAt:   timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
});
