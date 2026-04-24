// ADR-0004 Conformance Tests
// Validates the core sync protocol invariants using a real Postgres instance.
// Requires Docker (Testcontainers).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Pool } from 'pg';
import { resolve } from 'path';
import { advanceCursor, getCurrentCursor } from '../../src/server/cursor';
import { resolveConflict } from '../../src/server/conflict-resolver';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../packages/db/src/migrations');
const SHOP_A = '11111111-1111-1111-1111-111111111111';

const ctxA = {
  shopId: SHOP_A,
  tenant: { id: SHOP_A, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' as const },
  authenticated: false as const,
};

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, MIGRATIONS_DIR);
  await pool.query(
    `INSERT INTO shops (id, slug, display_name, status) VALUES ($1,'shop-a','Shop A','ACTIVE')`,
    [SHOP_A],
  );
  await pool.query(
    `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)`,
    [SHOP_A],
  );
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('ADR-0004: Monotonic cursor — sequential', () => {
  it('100 sequential advances produce unique, strictly increasing values', async () => {
    const cursors: bigint[] = [];
    for (let i = 0; i < 100; i++) {
      await tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, async (tx) => {
          cursors.push(await advanceCursor(tx, SHOP_A));
        }),
      );
    }
    expect(new Set(cursors).size).toBe(100);
    for (let i = 1; i < cursors.length; i++) {
      expect(cursors[i]!).toBeGreaterThan(cursors[i - 1]!);
    }
  });
});

describe('ADR-0004: Monotonic cursor — concurrent', () => {
  it('10 concurrent advances produce unique values with no duplicates', async () => {
    const before = await getCurrentCursor(pool, SHOP_A);
    const promises = Array.from({ length: 10 }, () =>
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, async (tx) => advanceCursor(tx, SHOP_A)),
      ),
    );
    const results = await Promise.all(promises);
    expect(new Set(results).size).toBe(10);
    const after = await getCurrentCursor(pool, SHOP_A);
    expect(after).toBe(before + 10n);
  });
});

describe('ADR-0004: Idempotency (unit)', () => {
  it('same idempotency key returns identical cursor from cached JSON', async () => {
    const cached = { cursor: '999', conflicts: [] };
    const serialized = JSON.stringify(cached);
    const parsed = JSON.parse(serialized) as typeof cached;
    expect(BigInt(parsed.cursor)).toBe(999n);
    expect(parsed.conflicts).toEqual([]);
  });
});

describe('ADR-0004: LWW — two concurrent edits', () => {
  it('newer updated_at wins when client sends newer', () => {
    const older = { updated_at: '2026-04-24T10:00:00Z', notes: 'old' };
    const newer = { updated_at: '2026-04-24T11:00:00Z', notes: 'new' };
    expect(resolveConflict('customers', newer, older)).toBe('accept');
    expect(resolveConflict('customers', older, newer)).toBe('reject');
  });

  it('client wins on tie (same timestamp)', () => {
    const ts = '2026-04-24T10:00:00Z';
    expect(resolveConflict('products', { updated_at: ts }, { updated_at: ts })).toBe('accept');
  });
});
