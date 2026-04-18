export type TableKind = 'tenant' | 'global';
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
