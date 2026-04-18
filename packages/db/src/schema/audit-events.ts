import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const auditEvents = tenantScopedTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor_user_id: uuid('actor_user_id'),
  action: text('action').notNull(),
  subject_type: text('subject_type').notNull(),
  subject_id: text('subject_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  metadata: jsonb('metadata'),
  ip: text('ip'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
