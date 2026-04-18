import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const platformAuditEvents = platformGlobalTable('platform_audit_events', {
  id:         uuid('id').primaryKey().defaultRandom(),
  action:     text('action').notNull(),
  ip_address: text('ip_address'),              // Drizzle's INET support is partial — text is safe
  user_agent: text('user_agent'),
  request_id: text('request_id'),
  phone_hash: text('phone_hash'),
  metadata:   jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
