import { uuid, timestamp, text, bigint, boolean } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const ibjaRateSnapshots = platformGlobalTable('ibja_rate_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull(),
  source: text('source').notNull(),
  gold_24k_paise: bigint('gold_24k_paise', { mode: 'bigint' }).notNull(),
  gold_22k_paise: bigint('gold_22k_paise', { mode: 'bigint' }).notNull(),
  gold_20k_paise: bigint('gold_20k_paise', { mode: 'bigint' }).notNull(),
  gold_18k_paise: bigint('gold_18k_paise', { mode: 'bigint' }).notNull(),
  gold_14k_paise: bigint('gold_14k_paise', { mode: 'bigint' }).notNull(),
  silver_999_paise: bigint('silver_999_paise', { mode: 'bigint' }).notNull(),
  silver_925_paise: bigint('silver_925_paise', { mode: 'bigint' }).notNull(),
  stale: boolean('stale').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
