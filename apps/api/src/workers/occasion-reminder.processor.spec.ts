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

  it('queries by today IST date and reminder_days offset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    expect(client.query).toHaveBeenCalledOnce();
    const sqlCall = client.query.mock.calls[0];
    expect(sqlCall[0]).toContain('SELECT');
    expect(sqlCall[0]).toContain('next_occurrence = $1::date');
    expect(sqlCall[0]).toContain("reminder_days * INTERVAL '1 day'");
    expect(sqlCall[1]).toEqual(['2026-04-26']);
  });

  it('advances next_occurrence to next year for fired reminders', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([
      occRow({ id: 'occ-1', next_occurrence: '2026-04-26' }),
    ]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    // SELECT then UPDATE
    expect(client.query).toHaveBeenCalledTimes(2);
    const updateCall = client.query.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE customer_occasions SET next_occurrence');
    expect(updateCall[1]).toEqual(['2027-04-26', 'occ-1']);
  });

  it('Feb 29 in leap year → next year is non-leap, advances to Mar 1', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-02-29T12:00:00+05:30'));

    const client = fakeClient([
      occRow({ id: 'occ-feb29', next_occurrence: '2028-02-29' }),
    ]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    const updateCall = client.query.mock.calls[1];
    expect(updateCall[1]).toEqual(['2029-03-01', 'occ-feb29']);
  });

  it('processes multiple occasions across tenants in one run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    // Cross-tenant scan: this is intentional platform-level, see processor's nosemgrep comment
    const client = fakeClient([
      occRow({ id: 'occ-shop-a', shop_id: SHOP_A, next_occurrence: '2026-04-26' }),
      occRow({ id: 'occ-shop-b', shop_id: SHOP_B, next_occurrence: '2026-05-03' }),
    ]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    // 1 SELECT + 2 UPDATEs
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[1][1]).toEqual(['2027-04-26', 'occ-shop-a']);
    expect(client.query.mock.calls[2][1]).toEqual(['2027-05-03', 'occ-shop-b']);
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

describe('reminder query semantics', () => {
  it('SQL uses date arithmetic for "today + reminder_days" check (per-row reminder_days)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const client = fakeClient([]);
    const proc = new OccasionReminderProcessor(fakePool(client));

    await proc.process({ name: 'daily-check' } as any);

    const sql = client.query.mock.calls[0][0];
    // The reminder_days is per-row, so the addition must be inside the SQL, not the JS:
    expect(sql).toMatch(/reminder_days\s*\*\s*INTERVAL\s*'1 day'/);
  });
});
