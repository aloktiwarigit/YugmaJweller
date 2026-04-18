import { pgTable, uuid, index, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

// Drizzle 0.30.x stores columns under a Symbol; expose them via `._` for
// compatibility with the test accessor pattern `t._.columns`.
const drizzleColumnsSymbol = Symbol.for('drizzle:Columns');

export function tenantScopedTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
  opts: { encryptedColumns?: (keyof C & string)[] } = {},
) {
  tableRegistry.register({
    name,
    kind: 'tenant',
    encryptedColumns: opts.encryptedColumns ?? [],
  });

  const table = pgTable(
    name,
    {
      shop_id: uuid('shop_id').notNull(),
      ...columns,
    } as C & { shop_id: ReturnType<typeof uuid> },
    (t) => ({
      shopIdIdx: index(`${name}_shop_id_idx`).on((t as Record<string, unknown>).shop_id as never),
    }),
  );

  // Attach `_` accessor so tests (and tooling) can reach `t._.columns`
  const cols = (table as unknown as Record<symbol, Record<string, unknown>>)[drizzleColumnsSymbol]
    ?? Object.fromEntries(Object.keys(table).map((k) => [k, (table as Record<string, unknown>)[k]]));

  Object.defineProperty(table, '_', {
    enumerable: false,
    configurable: true,
    value: { columns: cols },
  });

  return table;
}
