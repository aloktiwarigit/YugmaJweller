import { uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';

export const customerNotes = tenantScopedTable('customer_notes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  customerId:   uuid('customer_id').notNull().references(() => customers.id),
  body:         text('body').notNull(),
  authorUserId: uuid('author_user_id').notNull(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
