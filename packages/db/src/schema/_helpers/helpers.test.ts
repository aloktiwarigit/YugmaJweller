import { describe, it, expect, beforeEach } from 'vitest';
import { uuid, text } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './tenantScopedTable';
import { platformGlobalTable } from './platformGlobalTable';
import { tableRegistry } from './registry';

beforeEach(() => tableRegistry.clear());

describe('tenantScopedTable', () => {
  it('auto-injects shop_id NOT NULL + FK + index', () => {
    const t = tenantScopedTable('widgets', { name: text('name').notNull() });
    const cols = (t as unknown as { _: { columns: Record<string, unknown> } })._.columns;
    expect(cols.shop_id).toBeDefined();
    expect(cols.name).toBeDefined();
  });

  it('registers metadata with kind=tenant', () => {
    tenantScopedTable('widgets', { name: text('name') });
    expect(tableRegistry.list()).toEqual([
      { name: 'widgets', kind: 'tenant', encryptedColumns: [] },
    ]);
  });

  it('records encryptedColumns option', () => {
    tenantScopedTable('secrets', { blob: text('blob') }, { encryptedColumns: ['blob'] });
    expect(tableRegistry.list()[0]).toEqual({
      name: 'secrets', kind: 'tenant', encryptedColumns: ['blob'],
    });
  });
});

describe('platformGlobalTable', () => {
  it('registers metadata with kind=global', () => {
    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
    expect(tableRegistry.list()).toEqual([
      { name: 'rates', kind: 'global', encryptedColumns: [] },
    ]);
  });
});
