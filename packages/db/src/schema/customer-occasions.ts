import { uuid, text, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';

export const customerOccasions = tenantScopedTable('customer_occasions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     uuid('customer_id').notNull().references(() => customers.id),
  occasionType:   text('occasion_type').notNull(),
  label:          text('label'),
  monthDay:       text('month_day').notNull(),  // 'MM-DD' format
  nextOccurrence: date('next_occurrence'),
  reminderDays:   integer('reminder_days').notNull().default(7),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
