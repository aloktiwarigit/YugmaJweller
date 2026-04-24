import { describe, it, expect } from 'vitest';
import { resolveConflict } from '../src/server/conflict-resolver';
import type { SyncTable } from '../src/protocol';

describe('resolveConflict — products (LWW)', () => {
  const TABLE: SyncTable = 'products';

  it('accepts client row when client updated_at is newer', () => {
    const client = { updated_at: '2026-04-24T10:00:00Z', status: 'SOLD' };
    const server = { updated_at: '2026-04-24T09:00:00Z', status: 'IN_STOCK' };
    expect(resolveConflict(TABLE, client, server)).toBe('accept');
  });

  it('rejects client row when server updated_at is newer', () => {
    const client = { updated_at: '2026-04-24T09:00:00Z', status: 'SOLD' };
    const server = { updated_at: '2026-04-24T10:00:00Z', status: 'IN_STOCK' };
    expect(resolveConflict(TABLE, client, server)).toBe('reject');
  });

  it('accepts when timestamps are equal (client wins tie)', () => {
    const ts = '2026-04-24T10:00:00Z';
    expect(resolveConflict(TABLE, { updated_at: ts }, { updated_at: ts })).toBe('accept');
  });

  it('accepts when server state is null (new row)', () => {
    expect(resolveConflict(TABLE, { updated_at: '2026-04-24T10:00:00Z' }, null)).toBe('accept');
  });
});

describe('resolveConflict — customers (LWW)', () => {
  it('uses LWW on updated_at', () => {
    const client = { updated_at: '2026-04-24T11:00:00Z', notes: 'updated' };
    const server = { updated_at: '2026-04-24T10:00:00Z', notes: 'old' };
    expect(resolveConflict('customers', client, server)).toBe('accept');
  });
});

describe('resolveConflict — shop_settings (LWW)', () => {
  it('rejects when server is newer', () => {
    const client = { updated_at: '2026-04-24T08:00:00Z' };
    const server = { updated_at: '2026-04-24T09:00:00Z' };
    expect(resolveConflict('shop_settings', client, server)).toBe('reject');
  });
});
