import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { buildConflict } from '../src/server/push';

// Push integration tests (with real Postgres) live in test/integration/.
// Here we unit-test the pure logic that doesn't require a DB connection.

describe('buildConflict', () => {
  it('constructs a ConflictRecord with all fields', () => {
    const conflict = buildConflict('products', 'row-123', 'lww.client_older', { id: 'row-123', status: 'IN_STOCK' });
    expect(conflict).toEqual({
      table: 'products',
      rowId: 'row-123',
      reason: 'lww.client_older',
      serverState: { id: 'row-123', status: 'IN_STOCK' },
    });
  });

  it('accepts null serverState for new-row conflicts', () => {
    const conflict = buildConflict('customers', 'c-1', 'some.reason', null);
    expect(conflict.serverState).toBeNull();
  });
});

describe('push — idempotency cache hit', () => {
  it('returns cached response without hitting pool when key already processed', async () => {
    const cached = JSON.stringify({ cursor: '100', conflicts: [] });
    const redis = { get: vi.fn().mockResolvedValue(cached), set: vi.fn() };
    const pool = { connect: vi.fn() } as unknown as Pool;
    const ctx = {
      shopId: 'shop-1',
      tenant: { id: 'shop-1', slug: 'x', display_name: 'X', status: 'ACTIVE' as const },
      authenticated: false as const,
    };

    const { push } = await import('../src/server/push');
    const result = await push(pool, redis as never, ctx, {
      changes: {},
      idempotencyKey: 'idempotent-key-1',
    });

    expect(result.cursor).toBe(100n);
    expect(result.conflicts).toEqual([]);
    expect(redis.get).toHaveBeenCalledWith('sync:idempotency:shop-1:idempotent-key-1');
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

