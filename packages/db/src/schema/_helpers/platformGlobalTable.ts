import { pgTable, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
  return pgTable(name, columns);
}
