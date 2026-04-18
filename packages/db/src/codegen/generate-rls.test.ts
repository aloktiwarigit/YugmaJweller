import { describe, it, expect, beforeEach } from 'vitest';
import { generateRlsSql } from './generate-rls';
import { tableRegistry } from '../schema/_helpers/registry';
import { tenantScopedTable } from '../schema/_helpers/tenantScopedTable';
import { platformGlobalTable } from '../schema/_helpers/platformGlobalTable';
import { text, uuid } from 'drizzle-orm/pg-core';

beforeEach(() => tableRegistry.clear());

describe('generateRlsSql', () => {
  it('emits ENABLE RLS + policy per tenantScopedTable', () => {
    tenantScopedTable('invoices', { total: text('total') });
    const sql = generateRlsSql();
    expect(sql).toContain('ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain(
      `CREATE POLICY rls_invoices_tenant_isolation ON invoices\n  FOR ALL\n  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)\n  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);`,
    );
  });

  it('emits FORCE ROW LEVEL SECURITY so owners cannot bypass', () => {
    tenantScopedTable('invoices', { total: text('total') });
    expect(generateRlsSql()).toContain('ALTER TABLE invoices FORCE ROW LEVEL SECURITY;');
  });

  it('skips platformGlobalTable', () => {
    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
    const sql = generateRlsSql();
    expect(sql).not.toContain('rates');
  });

  it('is idempotent (uses DROP POLICY IF EXISTS)', () => {
    tenantScopedTable('x', { y: text('y') });
    expect(generateRlsSql()).toContain('DROP POLICY IF EXISTS rls_x_tenant_isolation ON x;');
  });
});
