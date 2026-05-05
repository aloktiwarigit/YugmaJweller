import { uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

// Per migration 0072: tenant-scoped composite FK on (shop_id, requested_by_user_id)
// → shop_users(shop_id, id). RLS + FORCE RLS enabled; status machine
// QUEUED → RUNNING → READY/FAILED is enforced at the application layer with a
// CHECK that READY/FAILED imply completed_at IS NOT NULL.
export const reportsPdfExports = tenantScopedTable('reports_pdf_exports', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  report_type:           text('report_type').notNull(),
  params:                jsonb('params').notNull().default({}),
  status:                text('status').notNull().default('QUEUED'),
  storage_key:           text('storage_key'),
  error_message:         text('error_message'),
  requested_by_user_id:  uuid('requested_by_user_id').notNull(),
  // NOTE: Composite FK (shop_id, requested_by_user_id) → shop_users(shop_id, id)
  // is enforced in migration 0072_reports_pdf_exports.sql as a named constraint.
  // Drizzle's column-level .references() cannot express composite FKs — the
  // constraint lives in the migration only.
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at:          timestamp('completed_at', { withTimezone: true }),
});
