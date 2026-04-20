import { uuid, text, boolean, timestamp, pgTable } from 'drizzle-orm/pg-core';
import { shopUserRoleEnum } from './shop-users';

export const rolePermissions = pgTable('role_permissions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  shop_id:        uuid('shop_id').notNull(),
  role:           shopUserRoleEnum('role').notNull(),
  permission_key: text('permission_key').notNull(),
  is_enabled:     boolean('is_enabled').notNull().default(false),
  updated_at:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
