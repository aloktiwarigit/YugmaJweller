import { uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);

export const shops = platformGlobalTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  display_name: text('display_name').notNull(),
  status: shopStatusEnum('status').notNull().default('PROVISIONING'),
  kek_key_arn: text('kek_key_arn'),
  config: jsonb('config').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
