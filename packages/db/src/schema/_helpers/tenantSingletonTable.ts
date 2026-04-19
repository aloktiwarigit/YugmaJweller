import { pgTable, uuid, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

export function tenantSingletonTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'tenant', encryptedColumns: [] });
  return pgTable(name, {
    shop_id: uuid('shop_id').primaryKey(),
    ...columns,
  } as { shop_id: ReturnType<typeof uuid> } & C);
}
