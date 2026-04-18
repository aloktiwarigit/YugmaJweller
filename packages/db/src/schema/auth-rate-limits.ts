import { text, integer, timestamp } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const authRateLimits = platformGlobalTable('auth_rate_limits', {
  phone_e164:        text('phone_e164').primaryKey(),
  verify_failures:   integer('verify_failures').notNull().default(0),
  window_started_at: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
  locked_until:      timestamp('locked_until', { withTimezone: true }),
  updated_at:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
