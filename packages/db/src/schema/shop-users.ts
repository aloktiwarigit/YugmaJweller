import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const shopUserStatusEnum = pgEnum('shop_user_status', ['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);

export const shopUsers = tenantScopedTable(
  'shop_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    display_name: text('display_name').notNull(),
    role: shopUserRoleEnum('role').notNull(),
    status: shopUserStatusEnum('status').notNull().default('INVITED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  { encryptedColumns: [] },
);
