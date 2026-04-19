import { jsonb, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantSingletonTable } from './_helpers/tenantSingletonTable';

export const shopSettings = tenantSingletonTable('shop_settings', {
  making_charges_json:      jsonb('making_charges_json'),
  wastage_json:             jsonb('wastage_json'),
  loyalty_json:             jsonb('loyalty_json'),
  rate_lock_days:           integer('rate_lock_days'),
  try_at_home_enabled:      boolean('try_at_home_enabled').notNull().default(false),
  try_at_home_max_pieces:   integer('try_at_home_max_pieces'),
  custom_order_policy_text: text('custom_order_policy_text'),
  return_policy_text:       text('return_policy_text'),
  notification_prefs_json:  jsonb('notification_prefs_json'),
  updated_at:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
