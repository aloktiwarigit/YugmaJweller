import { describe, it, expect, vi } from 'vitest';
import type { PoolClient, Pool } from 'pg';
import { advanceCursor, getCurrentCursor } from '../src/server/cursor';

function makeTx(rows: Record<string, unknown>[] = []): PoolClient {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as PoolClient;
}

describe('advanceCursor', () => {
  it('returns new cursor as bigint after SELECT FOR UPDATE + UPDATE RETURNING', async () => {
    const tx = makeTx();
    (tx.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [] })           // INSERT ON CONFLICT DO NOTHING
      .mockResolvedValueOnce({ rows: [{ cursor: '4' }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ cursor: '5' }] }); // UPDATE RETURNING

    const result = await advanceCursor(tx, 'shop-abc');
    expect(result).toBe(5n);
  });

  it('returns a bigint type (not number)', async () => {
    const tx = makeTx();
    (tx.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ cursor: '9007199254740991' }] })
      .mockResolvedValueOnce({ rows: [{ cursor: '9007199254740992' }] });

    const result = await advanceCursor(tx, 'shop-abc');
    expect(typeof result).toBe('bigint');
    expect(result).toBe(9007199254740992n);
  });

  it('issues INSERT then SELECT FOR UPDATE then UPDATE in that order', async () => {
    const calls: string[] = [];
    const tx = {
      query: vi.fn().mockImplementation((sql: string) => {
        calls.push((sql as string).trim().split(/\s+/)[0]!.toUpperCase());
        return Promise.resolve({ rows: [{ cursor: '1' }] });
      }),
    } as unknown as PoolClient;

    await advanceCursor(tx, 'shop-abc');
    expect(calls[0]).toBe('INSERT');
    expect(calls[1]).toBe('SELECT');
    expect(calls[2]).toBe('UPDATE');
  });
});

describe('getCurrentCursor', () => {
  it('returns cursor as bigint from pool query', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ cursor: '42' }] }),
    } as unknown as Pool;
    expect(await getCurrentCursor(pool, 'shop-abc')).toBe(42n);
  });

  it('returns 0n when no cursor row exists', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;
    expect(await getCurrentCursor(pool, 'shop-new')).toBe(0n);
  });
});
