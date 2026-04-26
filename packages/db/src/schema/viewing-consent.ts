import { uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { customers } from './customers';

export const viewingConsent = tenantScopedTable('viewing_consent', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  customerId:         uuid('customer_id').notNull().references(() => customers.id),
  consentGiven:       boolean('consent_given').notNull().default(false),
  consentVersion:     text('consent_version').notNull().default('v1'),
  consentedAt:        timestamp('consented_at', { withTimezone: true }),
  withdrawnAt:        timestamp('withdrawn_at', { withTimezone: true }),
  ipAtConsent:        text('ip_at_consent'),
  userAgentAtConsent: text('user_agent_at_consent'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
