import { pgTable, uuid, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { tableRegistry } from './_helpers/registry';
import { shops } from './shops';

tableRegistry.register({ name: 'shop_rate_overrides', kind: 'tenant', encryptedColumns: [] });

export const shopRateOverrides = pgTable(
  'shop_rate_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id').notNull().references(() => shops.id),
    purity: text('purity').notNull(),
    overridePaise: bigint('override_paise', { mode: 'bigint' }).notNull(),
    reason: text('reason').notNull(),
    setByUserId: uuid('set_by_user_id').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('idx_shop_rate_overrides_active').on(t.shopId, t.purity, t.validUntil),
  }),
);
