import { describe, it, expect } from 'vitest';
import { groupChangeRows } from '../src/server/pull';

interface ChangeRow {
  seq: string;
  table_name: string;
  row_id: string;
  operation: string;
  payload: Record<string, unknown> | null;
}

function row(op: string, table: string, payload: Record<string, unknown> | null = null): ChangeRow {
  return { seq: '1', table_name: table, row_id: 'row-1', operation: op, payload };
}

describe('groupChangeRows', () => {
  it('groups INSERT into created', () => {
    const result = groupChangeRows([row('INSERT', 'products', { id: 'p1' })], ['products']);
    expect(result['products']!.created).toHaveLength(1);
    expect(result['products']!.updated).toHaveLength(0);
    expect(result['products']!.deleted).toHaveLength(0);
  });

  it('groups UPDATE into updated', () => {
    const result = groupChangeRows([row('UPDATE', 'products', { id: 'p1' })], ['products']);
    expect(result['products']!.updated).toHaveLength(1);
  });

  it('groups DELETE into deleted with id = row_id', () => {
    const result = groupChangeRows([row('DELETE', 'products', null)], ['products']);
    expect(result['products']!.deleted).toEqual([{ id: 'row-1' }]);
  });

  it('filters out tables not in the requested list', () => {
    const rows = [
      row('INSERT', 'customers', { id: 'c1' }),
      row('INSERT', 'products', { id: 'p1' }),
    ];
    const result = groupChangeRows(rows, ['products']);
    expect(result['customers']).toBeUndefined();
    expect(result['products']!.created).toHaveLength(1);
  });

  it('initialises empty buckets for requested tables with no changes', () => {
    const result = groupChangeRows([], ['products', 'customers']);
    expect(result['products']).toEqual({ created: [], updated: [], deleted: [] });
    expect(result['customers']).toEqual({ created: [], updated: [], deleted: [] });
  });

  it('returns payload as-is for created rows', () => {
    const payload = { id: 'p1', sku: 'GOLD001' };
    const result = groupChangeRows([row('INSERT', 'products', payload)], ['products']);
    expect(result['products']!.created[0]).toEqual(payload);
  });

  it('falls back to empty object when payload is null for non-delete rows', () => {
    const result = groupChangeRows([row('INSERT', 'products', null)], ['products']);
    expect(result['products']!.created[0]).toEqual({});
  });
});
