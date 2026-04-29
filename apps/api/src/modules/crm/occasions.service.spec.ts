/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OccasionsService, computeNextOccurrence } from './occasions.service';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';

vi.mock('@goldsmith/db', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/db')>('@goldsmith/db');
  return { ...actual, withTenantTx: vi.fn() };
});

vi.mock('@goldsmith/audit', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/audit')>('@goldsmith/audit');
  return { ...actual, auditLog: vi.fn(async () => undefined) };
});

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';
const OCC_ID = '55555555-6666-4000-8000-000000000005';

function authCtx(): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
}

function fakePool(): any {
  return { query: vi.fn(async () => ({ rows: [] })) };
}

function occRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OCC_ID,
    shop_id: SHOP,
    customer_id: CUSTOMER,
    occasion_type: 'BIRTHDAY',
    label: null,
    month_day: '06-15',
    next_occurrence: '2026-06-15',
    reminder_days: 7,
    created_at: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeTx(rows: any[] = []) {
  return { query: vi.fn(async () => ({ rows })) };
}

function setupWithTenantTx(tx: any): void {
  (withTenantTx as any).mockImplementation(
    (_p: any, fn: (tx: any) => Promise<any>) => fn(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── computeNextOccurrence (pure function) ─────────────────────────────────

describe('computeNextOccurrence', () => {
  it('today before occasion → returns this year', () => {
    // 2026-04-26, MM-DD '06-15' → this year (2026-06-15)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    expect(computeNextOccurrence('06-15')).toBe('2026-06-15');
  });

  it('today after occasion → returns next year', () => {
    // 2026-04-26, MM-DD '01-15' → next year (2027-01-15)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    expect(computeNextOccurrence('01-15')).toBe('2027-01-15');
  });

  it('today is the occasion day → returns today (this year)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00+05:30'));

    expect(computeNextOccurrence('06-15')).toBe('2026-06-15');
  });

  it('Dec 31 edge → next year', () => {
    // 2026-12-31, MM-DD '01-01' → 2027-01-01
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T12:00:00+05:30'));

    expect(computeNextOccurrence('01-01')).toBe('2027-01-01');
  });

  it('Jan 1 edge with Dec 31 occasion → this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00+05:30'));

    expect(computeNextOccurrence('12-31')).toBe('2026-12-31');
  });

  it('Feb 29 on non-leap year → Mar 1', () => {
    // 2027 is non-leap; today is 2027-01-15, occasion '02-29' should resolve to 2027-03-01
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00+05:30'));

    expect(computeNextOccurrence('02-29')).toBe('2027-03-01');
  });

  it('Feb 29 on leap year → Feb 29 (year unchanged)', () => {
    // 2028 is leap; today is 2028-01-15, occasion '02-29' → 2028-02-29
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-01-15T12:00:00+05:30'));

    expect(computeNextOccurrence('02-29')).toBe('2028-02-29');
  });

  it('Feb 29 on leap year, but past → next year (which may be non-leap → Mar 1)', () => {
    // After Feb 29 2028 (leap), next year 2029 is non-leap → Mar 1 2029
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-03-15T12:00:00+05:30'));

    expect(computeNextOccurrence('02-29')).toBe('2029-03-01');
  });

  it('Feb 29 on non-leap year past Mar 1 → next leap year Feb 29', () => {
    // 2027-04-01, '02-29': 2027 non-leap so this year = Mar 1, but 2027-03-01 < 2027-04-01.
    // So roll to 2028 (leap) → 2028-02-29.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-04-01T12:00:00+05:30'));

    expect(computeNextOccurrence('02-29')).toBe('2028-02-29');
  });
});

// ─── addOccasion ────────────────────────────────────────────────────────────

describe('addOccasion', () => {
  it('inserts row with computed next_occurrence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const inserted = occRow({ next_occurrence: '2026-06-15' });
    const tx = makeTx([inserted]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    const result = await svc.addOccasion(authCtx(), CUSTOMER, {
      occasionType: 'BIRTHDAY',
      monthDay: '06-15',
    });

    expect(result.nextOccurrence).toBe('2026-06-15');
    expect(result.reminderDays).toBe(7);

    // verify the parameters passed to INSERT
    const params = ((tx.query as any).mock.calls[0][1] as string);
    expect(params).toEqual([CUSTOMER, 'BIRTHDAY', null, '06-15', '2026-06-15', 7]);
  });

  it('uses custom reminder_days when provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const tx = makeTx([occRow({ reminder_days: 14 })]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await svc.addOccasion(authCtx(), CUSTOMER, {
      occasionType: 'ANNIVERSARY',
      monthDay: '06-15',
      reminderDays: 14,
    });

    const params = ((tx.query as any).mock.calls[0][1] as string);
    expect(params[5]).toBe(14);
  });

  it('emits CRM_OCCASION_ADDED audit event', async () => {
    // Don't use fake timers here — the audit fire-and-forget uses microtasks
    // that don't drain under vi.useFakeTimers without explicit advancement.
    const tx = makeTx([occRow()]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await svc.addOccasion(authCtx(), CUSTOMER, {
      occasionType: 'BIRTHDAY',
      monthDay: '06-15',
    });

    await new Promise((r) => setImmediate(r));

    expect(auditLog).toHaveBeenCalledOnce();
    const arg = (auditLog as any).mock.calls[0][1];
    expect(arg.action).toBe(AuditAction.CRM_OCCASION_ADDED);
    expect(arg.subjectType).toBe('customer_occasion');
  });
});

// ─── listOccasions ──────────────────────────────────────────────────────────

describe('listOccasions', () => {
  it('orders by next_occurrence ASC NULLS LAST', async () => {
    const tx = makeTx([occRow()]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await svc.listOccasions(authCtx(), CUSTOMER);

    const sql = ((tx.query as any).mock.calls[0][0] as string);
    expect(sql).toContain('ORDER BY next_occurrence ASC NULLS LAST');
  });

  it('returns mapped responses', async () => {
    const tx = makeTx([
      occRow({ id: 'a', month_day: '01-01' }),
      occRow({ id: 'b', month_day: '12-31' }),
    ]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    const result = await svc.listOccasions(authCtx(), CUSTOMER);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });
});

// ─── deleteOccasion ─────────────────────────────────────────────────────────

describe('deleteOccasion', () => {
  it('deletes when row exists', async () => {
    const tx = makeTx([occRow()]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await expect(svc.deleteOccasion(authCtx(), OCC_ID)).resolves.toBeUndefined();
  });

  it('throws NotFoundException when row does not exist', async () => {
    const tx = makeTx([]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await expect(svc.deleteOccasion(authCtx(), OCC_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── tenant isolation ──────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('addOccasion uses current_setting tenant guard', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00+05:30'));

    const tx = makeTx([occRow()]);
    setupWithTenantTx(tx);
    const svc = new OccasionsService(fakePool());

    await svc.addOccasion(authCtx(), CUSTOMER, { occasionType: 'BIRTHDAY', monthDay: '06-15' });

    const sql = ((tx.query as any).mock.calls[0][0] as string);
    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);
    expect(withTenantTx).toHaveBeenCalled();
  });
});
