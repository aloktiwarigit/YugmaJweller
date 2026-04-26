import { describe, it, expect } from 'vitest';
import { trackPmlaCumulative, istDateStr, istMonthStr } from './cumulative';

// ─── IST date/month helpers ──────────────────────────────────────────────────

describe('istDateStr / istMonthStr — IST boundary', () => {
  it('23:59 IST on 31 Dec → December date', () => {
    // UTC 18:29 on 31 Dec = IST 23:59 on 31 Dec (UTC+5:30)
    const date = new Date('2025-12-31T18:29:00Z');
    expect(istDateStr(date)).toBe('2025-12-31');
    expect(istMonthStr(date)).toBe('2025-12');
  });

  it('00:01 IST on 1 Jan → January date', () => {
    // UTC 18:31 on 31 Dec = IST 00:01 on 1 Jan (UTC+5:30)
    const date = new Date('2025-12-31T18:31:00Z');
    expect(istDateStr(date)).toBe('2026-01-01');
    expect(istMonthStr(date)).toBe('2026-01');
  });

  it('month boundary: last moment of December vs first moment of January', () => {
    const decDate = new Date('2025-12-31T18:29:00Z'); // IST 23:59 Dec 31
    const janDate = new Date('2025-12-31T18:31:00Z'); // IST 00:01 Jan 1
    expect(istMonthStr(decDate)).toBe('2025-12');
    expect(istMonthStr(janDate)).toBe('2026-01');
  });
});

// ─── trackPmlaCumulative DB logic ────────────────────────────────────────────

function makeDbClient(queryFn: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  // Cast to the generic DbClient signature — the mock returns Record<string,unknown>[]
  // which is the non-generic base; safe because tests only read known keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { query: queryFn as any };
}

describe('trackPmlaCumulative', () => {
  it('first payment: upserts row and returns payment amount as monthly total', async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const tx = makeDbClient(async (sql, values = []) => {
      queries.push({ sql, values });
      if (sql.includes('SUM(cash_total_paise)')) {
        // Monthly SUM returns the incremented amount (first payment)
        return { rows: [{ monthly_total: '50000000' }] }; // Rs 5,00,000
      }
      return { rows: [] };
    });

    const result = await trackPmlaCumulative(tx, {
      customerId:         null,
      customerPhone:      '9999999999',
      cashIncrementPaise: 50_000_000n,
      transactionDateIST: new Date('2026-04-25T10:00:00Z'),
    });

    expect(result.cumulativePaise).toBe(50_000_000n);
    expect(result.status).toBe('ok');
    expect(result.monthStr).toBe('2026-04');
    // Verify upsert was called with correct increment
    const upsert = queries.find((q) => q.sql.includes('ON CONFLICT'));
    expect(upsert).toBeDefined();
    expect(upsert?.values).toContain(50_000_000n);
  });

  it('second payment same month: monthly SUM returns accumulated total', async () => {
    const tx = makeDbClient(async (sql, _values) => {
      if (sql.includes('SUM(cash_total_paise)')) {
        return { rows: [{ monthly_total: '80000000' }] }; // Rs 8,00,000 cumulative
      }
      return { rows: [] };
    });

    const result = await trackPmlaCumulative(tx, {
      customerId:         null,
      customerPhone:      '9999999999',
      cashIncrementPaise: 30_000_000n, // Rs 3,00,000 new payment
      transactionDateIST: new Date('2026-04-25T10:00:00Z'),
    });

    expect(result.cumulativePaise).toBe(80_000_000n);
    expect(result.status).toBe('warn'); // Rs 8,00,000 → warn
  });

  it('returns warn at Rs 8,00,000 exact', async () => {
    const tx = makeDbClient(async (sql) => {
      if (sql.includes('SUM')) return { rows: [{ monthly_total: '80000000' }] };
      return { rows: [] };
    });

    const result = await trackPmlaCumulative(tx, {
      customerId: null, customerPhone: '9999999999',
      cashIncrementPaise: 10_000_000n, transactionDateIST: new Date(),
    });
    expect(result.status).toBe('warn');
  });

  it('throws ComplianceHardBlockError at Rs 10,00,000 exact', async () => {
    const tx = makeDbClient(async (sql) => {
      if (sql.includes('SUM')) return { rows: [{ monthly_total: '100000000' }] };
      return { rows: [] };
    });
    await expect(
      trackPmlaCumulative(tx, {
        customerId: null, customerPhone: '9999999999',
        cashIncrementPaise: 10_000_000n, transactionDateIST: new Date(),
      })
    ).rejects.toMatchObject({ code: 'compliance.pmla_threshold_blocked' });
  });

  it('Rs 9,99,999 warns but does NOT throw', async () => {
    const tx = makeDbClient(async (sql) => {
      if (sql.includes('SUM')) return { rows: [{ monthly_total: '99999900' }] };
      return { rows: [] };
    });
    const result = await trackPmlaCumulative(tx, {
      customerId: null, customerPhone: '9999999999',
      cashIncrementPaise: 1_000_000n, transactionDateIST: new Date(),
    });
    expect(result.status).toBe('warn');
  });

  it('month boundary: new month starts fresh (separate SUM scope)', async () => {
    // Payment in month 2 — the monthly_total only includes month 2 data
    const tx = makeDbClient(async (sql, values) => {
      if (sql.includes('SUM(cash_total_paise)')) {
        // DB only returns month 2 total (Rs 5L, not Rs 10L from month 1)
        expect(values?.[0]).toBe('2026-05');
        return { rows: [{ monthly_total: '50000000' }] }; // Rs 5L
      }
      return { rows: [] };
    });

    const result = await trackPmlaCumulative(tx, {
      customerId:         null,
      customerPhone:      '9999999999',
      cashIncrementPaise: 50_000_000n,
      // IST May 1 2026 — different month from April
      transactionDateIST: new Date('2026-04-30T18:31:00Z'), // IST 00:01 May 1
    });

    expect(result.monthStr).toBe('2026-05');
    expect(result.cumulativePaise).toBe(50_000_000n);
    expect(result.status).toBe('ok'); // Rs 5L < Rs 8L warn
  });

  it('uses correct SQL params: dateStr and monthStr passed separately', async () => {
    const capturedValues: unknown[][] = [];
    const tx = makeDbClient(async (sql, values = []) => {
      capturedValues.push(values);
      if (sql.includes('SUM')) return { rows: [{ monthly_total: '0' }] };
      return { rows: [] };
    });

    await trackPmlaCumulative(tx, {
      customerId: 'cust-uuid-123', customerPhone: null,
      cashIncrementPaise: 1_000_000n,
      transactionDateIST: new Date('2026-01-15T10:00:00+05:30'), // IST noon Jan 15
    });

    // First query is the upsert — check dateStr and monthStr
    const upsertValues = capturedValues[0] ?? [];
    const dateStr  = upsertValues[2]; // $3
    const monthStr = upsertValues[3]; // $4
    expect(dateStr).toBe('2026-01-15');
    expect(monthStr).toBe('2026-01');
  });
});
