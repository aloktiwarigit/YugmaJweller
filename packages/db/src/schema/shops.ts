import { uuid, text, timestamp, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core';
import { platformGlobalTableWithRls } from './_helpers/platformGlobalTable';

export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);

// shops is platform-global for SELECT (auth lookups read all shops) but has
// RLS enabled for UPDATE so shopkeepers can only update their own shop row
// (migration 0013). Use platformGlobalTableWithRls to register as 'global-rls'.
export const shops = platformGlobalTableWithRls('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  display_name: text('display_name').notNull(),
  status: shopStatusEnum('status').notNull().default('PROVISIONING'),
  kek_key_arn: text('kek_key_arn'),
  config: jsonb('config').notNull().default({}),
  address_json: jsonb('address_json'),
  gstin: text('gstin'),
  bis_registration: text('bis_registration'),
  contact_phone: text('contact_phone'),
  operating_hours_json: jsonb('operating_hours_json'),
  about_text: text('about_text'),
  logo_url: text('logo_url'),
  years_in_business: integer('years_in_business'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
