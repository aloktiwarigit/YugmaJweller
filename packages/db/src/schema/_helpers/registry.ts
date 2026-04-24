/**
 * 'tenant'     — tenant-scoped table: RLS + FORCE RLS required, shop_id policy required
 * 'global'     — platform-global table: must have NO RLS (unrestricted reads/writes via superuser)
 * 'global-rls' — platform-global table that intentionally has RLS for scoped DML
 *                (e.g. shops: SELECT unrestricted, UPDATE scoped to own shop).
 *                Invariant checker skips the no-RLS assertion for this kind.
 */
export type TableKind = 'tenant' | 'global' | 'global-rls';
export interface TableMeta {
  name: string;
  kind: TableKind;
  encryptedColumns: string[];
}

class TableRegistry {
  private readonly byName = new Map<string, TableMeta>();
  register(meta: TableMeta): void {
    if (this.byName.has(meta.name)) {
      throw new Error(`Table "${meta.name}" registered twice — use a unique name.`);
    }
    this.byName.set(meta.name, meta);
  }
  list(): TableMeta[] { return [...this.byName.values()]; }
  get(name: string): TableMeta | undefined { return this.byName.get(name); }
  clear(): void { this.byName.clear(); }
}

export const tableRegistry = new TableRegistry();
