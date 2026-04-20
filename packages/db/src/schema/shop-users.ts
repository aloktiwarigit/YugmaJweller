import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const shopUserStatusEnum = pgEnum('shop_user_status', ['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);

export const shopUsers = tenantScopedTable(
  'shop_users',
  {
    id:                   uuid('id').primaryKey().defaultRandom(),
    phone:                text('phone').notNull(),
    display_name:         text('display_name').notNull(),
    role:                 shopUserRoleEnum('role').notNull(),
    status:               shopUserStatusEnum('status').notNull().default('INVITED'),
    firebase_uid:         text('firebase_uid'),
    activated_at:         timestamp('activated_at', { withTimezone: true }),
    invited_by_user_id:   uuid('invited_by_user_id'),
    invited_at:           timestamp('invited_at', { withTimezone: true }),
    revoked_at:           timestamp('revoked_at', { withTimezone: true }),
    revoked_by_user_id:   uuid('revoked_by_user_id'),
    created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  { encryptedColumns: [] },
);
