import { describe, it, expect, beforeEach } from 'vitest';
import { uuid, text } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './tenantScopedTable';
import { tenantSingletonTable } from './tenantSingletonTable';
import { platformGlobalTable, platformGlobalTableWithRls } from './platformGlobalTable';
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

describe('platformGlobalTableWithRls', () => {
  it('registers metadata with kind=global-rls', () => {
    platformGlobalTableWithRls('shops', { id: uuid('id').primaryKey() });
    expect(tableRegistry.list()).toEqual([
      { name: 'shops', kind: 'global-rls', encryptedColumns: [] },
    ]);
  });
});

describe('tenantSingletonTable', () => {
  it('registers metadata with kind=tenant', () => {
    tenantSingletonTable('preferences', { theme: text('theme') });
    expect(tableRegistry.list()).toEqual([
      { name: 'preferences', kind: 'tenant', encryptedColumns: [] },
    ]);
  });
});

describe('tableRegistry', () => {
  it('get returns registered meta', () => {
    platformGlobalTable('lookup', { id: uuid('id').primaryKey() });
    expect(tableRegistry.get('lookup')).toEqual({ name: 'lookup', kind: 'global', encryptedColumns: [] });
  });

  it('get returns undefined for unknown table', () => {
    expect(tableRegistry.get('nonexistent')).toBeUndefined();
  });

  it('register throws on duplicate table name', () => {
    platformGlobalTable('dup', { id: uuid('id').primaryKey() });
    expect(() => tableRegistry.register({ name: 'dup', kind: 'global', encryptedColumns: [] }))
      .toThrow('Table "dup" registered twice');
  });
});
