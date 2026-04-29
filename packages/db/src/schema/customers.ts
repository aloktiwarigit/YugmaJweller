import { uuid, text, integer, boolean, timestamp, customType } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

const bytea = customType<{ data: Buffer }>({
  dataType() { return 'bytea'; },
});

export const customers = tenantScopedTable('customers', {
  id:              uuid('id').primaryKey().defaultRandom(),
  phone:           text('phone').notNull(),
  name:            text('name').notNull(),
  email:           text('email'),
  addressLine1:    text('address_line1'),
  addressLine2:    text('address_line2'),
  city:            text('city'),
  state:           text('state'),
  pincode:         text('pincode'),
  dobYear:         integer('dob_year'),
  panCiphertext:   bytea('pan_ciphertext'),
  panKeyId:        text('pan_key_id'),
  notes:           text('notes'),
  viewingConsent:  boolean('viewing_consent').notNull().default(false),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, { encryptedColumns: ['panCiphertext'] });