/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OccasionReminderProcessor } from './occasion-reminder.processor';

const SHOP_A = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const SHOP_B = 'aaaaaaaa-bbbb-4000-8000-000000000099';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';

function fakeClient(rows: any[] = []) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT')) return { rows };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
}

function fakePool(client: any): any {
  return { connect: vi.fn(async () => client) };
}

function occRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'occ-1',
    shop_id: SHOP_A,
    customer_id: CUSTOMER,
    occasion_type: 'BIRTHDAY',
    label: null,
    month_day: '04-26',
    next_occurrence: '2026-04-26',
    reminder_days: 7,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('process', () => {
  it('returns early for non-daily-check job', async () => {
    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'unknown' } as any);

    expect(client.query).not.toHaveBeenCalled();
  });

  it('calls get_due_occasions SECURITY DEFINER fn with today IST date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    expect(client.query).toHaveBeenCalledOnce();
    const sqlCall = (client.query as any).mock.calls[0] as [string, string[]];
    expect(sqlCall[0]).toContain('get_due_occasions($1::date)');
    expect(sqlCall[1]).toEqual(['2026-04-26']);
  });

  it('calls advance_occasion_to_next_year fn for each fired reminder', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([
      occRow({ id: 'occ-1', next_occurrence: '2026-04-26' }),
    ]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    // SELECT get_due_occasions, then SELECT advance_occasion_to_next_year
    expect(client.query).toHaveBeenCalledTimes(2);
    const advanceCall = (client.query as any).mock.calls[1] as [string, string[]];
    expect(advanceCall[0]).toContain('advance_occasion_to_next_year($1::uuid)');
    expect(advanceCall[1]).toEqual(['occ-1']);
    // Note: leap-year + Feb 29 → Mar 1 logic now lives inside the SQL function
    // (see migration 0035), so JS no longer computes the new date.
  });

  it('processes multiple occasions across tenants in one run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    // Cross-tenant scan: SECURITY DEFINER function bypasses RLS — see processor comment + migration 0035
    const client = fakeClient([
      occRow({ id: 'occ-shop-a', shop_id: SHOP_A, next_occurrence: '2026-04-26' }),
      occRow({ id: 'occ-shop-b', shop_id: SHOP_B, next_occurrence: '2026-05-03' }),
    ]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    // 1 SELECT + 2 advance fn calls
    expect(client.query).toHaveBeenCalledTimes(3);
    expect((client.query as any).mock.calls[1][1]).toEqual(['occ-shop-a']);
    expect((client.query as any).mock.calls[2][1]).toEqual(['occ-shop-b']);
  });

  it('handles empty result set without UPDATE calls', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    expect(client.query).toHaveBeenCalledOnce();
  });

  it('always releases the pool client (even on error)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = {
      query: vi.fn(async () => { throw new Error('db down'); }),
      release: vi.fn(),
    };
    const proc = new OccasionReminderProcessor(fakePool(client));

    await expect(proc.process({ name: 'daily-check' } as any)).rejects.toThrow('db down');
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe('RLS bypass via SECURITY DEFINER', () => {
  it('uses get_due_occasions fn (not raw SELECT) — bypasses poison-UUID RLS', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    const sql = client.query.mock.calls[0][0] as unknown;
    // Must call the SECURITY DEFINER fn — raw SELECT FROM customer_occasions would
    // be blocked by FORCE RLS + provider.ts poison-UUID seed.
    expect(sql).not.toMatch(/SELECT\s+\*\s+FROM\s+customer_occasions/);
    expect(sql).toContain('get_due_occasions');
  });
});
