import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { withShopTx } from '../src/tx';
import { POISON_UUID } from '../src/provider';

/**
 * Regression test for the tx.ts SQL-injection sink.
 *
 * Pre-fix, `withShopTx` ran `SET LOCAL app.current_shop_id = '${shopId}'` via
 * `client.query(text)` — pg's simple query protocol allows multi-statement
 * execution, so a malicious shopId could inject arbitrary SQL into the
 * connection (e.g. set the shop_id to ANY tenant, run pg_sleep timing oracles,
 * etc.).
 *
 * The fix uses `set_config($1, $2, true)` with parameter binding. Validate
 * here that EVERY call that sets `app.current_shop_id` (both the inner SET
 * LOCAL and the post-tx POISON reset) goes through parameter binding — no
 * string interpolation may reach the database.
 */
describe('withShopTx — SQL injection regression', () => {
  it('binds shopId as a parameter to set_config (never string-interpolates)', async () => {
    const queries: Array<{ text: string; values: unknown[] | undefined }> = [];
    const mockClient = {
      query: vi.fn(async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        return { rows: [] };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn(async () => mockClient),
    } as unknown as Pool;

    const malicious = `11111111-1111-1111-1111-111111111111'; SELECT pg_sleep(10); --`;

    await withShopTx(mockPool, malicious, async () => 'ok');

    // Find the call that sets app.current_shop_id during the transaction body
    // (is_local=true is baked into the SQL text — booleans aren't parameterised).
    const setLocal = queries.find(
      (q) =>
        q.text.includes('set_config') &&
        q.text.includes('true') &&
        q.values?.[0] === 'app.current_shop_id',
    );
    expect(setLocal, 'expected set_config(..., true) call inside the transaction').toBeDefined();
    expect(setLocal!.values).toEqual(['app.current_shop_id', malicious]);
    // Critical: the malicious payload must appear ONLY in the values array,
    // never in the SQL text.
    expect(setLocal!.text).not.toContain(malicious);
    expect(setLocal!.text).not.toMatch(/pg_sleep/i);

    // Find the post-tx poison reset (is_local=false). POISON_UUID is a constant,
    // but we still want it bound — defence in depth.
    const poison = queries.find(
      (q) =>
        q.text.includes('set_config') &&
        q.text.includes('false') &&
        q.values?.[0] === 'app.current_shop_id',
    );
    expect(poison, 'expected set_config(..., false) call after tx for poison reset').toBeDefined();
    expect(poison!.values).toEqual(['app.current_shop_id', POISON_UUID]);
    expect(poison!.text).not.toContain(POISON_UUID);
  });

  it('does not run any SET LOCAL with string-interpolated shopId', async () => {
    const queries: string[] = [];
    const mockClient = {
      query: vi.fn(async (text: string) => {
        queries.push(text);
        return { rows: [] };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn(async () => mockClient),
    } as unknown as Pool;

    const shopId = '33333333-3333-3333-3333-333333333333';
    await withShopTx(mockPool, shopId, async () => 'ok');

    // No raw query text should literally contain the shopId — it must arrive
    // through parameter binding only.
    for (const text of queries) {
      expect(text).not.toContain(shopId);
      // Also: no template-style `SET LOCAL app.current_shop_id = '...'` form
      expect(text).not.toMatch(/SET\s+LOCAL\s+app\.current_shop_id\s*=\s*'/i);
      expect(text).not.toMatch(/^SET\s+app\.current_shop_id\s*=\s*'/i);
    }
  });
});
