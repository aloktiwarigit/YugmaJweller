import { uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';

export const familyMembers = tenantScopedTable('family_members', {
  id:                uuid('id').primaryKey().defaultRandom(),
  customerId:        uuid('customer_id').notNull().references(() => customers.id),
  relatedCustomerId: uuid('related_customer_id').notNull().references(() => customers.id),
  relationship:      text('relationship').notNull(),
  createdByUserId:   uuid('created_by_user_id').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
