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

/**
 * Like platformGlobalTable but for tables that intentionally have RLS enabled
 * for scoped DML (e.g. shops: SELECT is unrestricted / platform-global, but
 * UPDATE is tenant-scoped so shopkeepers can only update their own row).
 *
 * The tenant-isolation invariant checker treats 'global-rls' as global for
 * data-isolation purposes (no shop_id policy required) while allowing RLS to
 * be present in the DB.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function platformGlobalTableWithRls<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global-rls', encryptedColumns: [] });
  return pgTable(name, columns);
}
