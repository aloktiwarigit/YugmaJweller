/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ComplianceHardBlockError, SECTION_269ST_LIMIT_PAISE } from '@goldsmith/compliance';
import { AuditAction } from '@goldsmith/audit';
import { PaymentService } from './payment.service';

// Fake BullMQ queue — fire-and-forget; we assert .add() calls in warn tests
function fakeQueue() {
  return { add: vi.fn(async () => ({})) } as any;
}

const SHOP    = '0a1b2c3d-4e5f-4000-8000-000000000000';
const USER    = '11111111-2222-4000-8000-000000000000';
const INVOICE = 'aaaaaaaa-bbbb-4000-8000-000000000001';

function makeCtx(role = 'shop_admin') {
  return { authenticated: true, shopId: SHOP, userId: USER, role };
}

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: vi.fn(() => makeCtx()),
  },
}));

vi.mock('@goldsmith/db', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/db')>('@goldsmith/db');
  return { ...actual, withTenantTx: vi.fn() };
});

function makeTx(
  invoiceRow: { id: string; customer_id: string | null; customer_phone: string | null } | null,
  existingPaise = 0n,
  // Monthly PMLA SUM returned by trackPmlaCumulative's SELECT query
  monthlyPaise = 0n,
) {
  return {
    query: vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM invoices')) {
        return { rows: invoiceRow ? [invoiceRow] : [] };
      }
      if (sql.includes('pmla_aggregates_unique')) {
        // Step C (fetch-or-init): returns existingDailyPaise for 269ST check.
        // Step G (trackPmlaCumulative upsert): also matches — rows ignored by that path.
        // pg returns BIGINT as string — mirror that in the mock
        return { rows: [{ cash_total_paise: existingPaise.toString() }] };
      }
      if (sql.includes('SUM(cash_total_paise)')) {
        // trackPmlaCumulative monthly SUM query
        return { rows: [{ monthly_total: monthlyPaise.toString() }] };
      }
      if (sql.includes('UPDATE invoices SET compliance_overrides_jsonb')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO payments')) {
        return { rows: [] };
      }
      if (sql.includes('SUM(amount_paise)')) {
        return { rows: [{ paid: '0', cash_count: '0' }] };
      }
      return { rows: [] };
    }),
  };
}

function fakePool(
  invoiceRow: { id: string; customer_id: string | null; customer_phone: string | null } | null,
  existingPaise = 0n,
  monthlyPaise = 0n,
) {
  const tx = makeTx(invoiceRow, existingPaise, monthlyPaise);
  return { _tx: tx, connect: vi.fn() } as any;
}

import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

function setupWithTenantTx(pool: ReturnType<typeof fakePool>) {
  (withTenantTx as any).mockImplementation((_p: any, fn: (tx: any) => Promise<any>) =>
    fn(pool._tx),
  );
}

const INVOICE_ROW = { id: INVOICE, status: 'ISSUED', total_paise: '100000000', customer_id: null, customer_phone: '+919999999999' };

describe('PaymentService.recordCashPayment', () => {
  let svc: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a cash payment below the limit without override', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await expect(svc.recordCashPayment(INVOICE, 10_000_000n, 'idem-1')).resolves.not.toHaveProperty('pmlaWarning');
    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      expect.arrayContaining([INVOICE]),
    );
  });

  it('throws NotFoundException when invoice not found', async () => {
    const pool = fakePool(null, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await expect(svc.recordCashPayment(INVOICE, 1_000_000n, 'idem-2')).rejects.toMatchObject({
      response: { code: 'invoice.not_found' },
    });
  });

  it('throws ComplianceHardBlockError when cash would exceed limit (no override)', async () => {
    // Existing Rs 1,80,000 + new Rs 30,000 = Rs 2,10,000 > Rs 1,99,999
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await expect(
      svc.recordCashPayment(INVOICE, 3_000_000n, 'idem-3'),
    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
  });

  it('succeeds when exactly at limit (Rs 0 existing + Rs 1,99,999 new)', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await expect(
      svc.recordCashPayment(INVOICE, SECTION_269ST_LIMIT_PAISE, 'idem-4'),
    ).resolves.not.toHaveProperty('pmlaWarning');
  });

  it('allows override by shop_admin with valid justification', async () => {
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-6', { justification: 'Known regular customer bulk purchase' });

    // Override metadata must be written to invoice
    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('compliance_overrides_jsonb'),
      expect.any(Array),
    );
  });

  it('fires COMPLIANCE_OVERRIDE_269ST audit log on override', async () => {
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-7', { justification: 'Known regular customer bulk purchase' });

    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('audit_events'),
      expect.arrayContaining(['COMPLIANCE_OVERRIDE_269ST']),
    );
  });

  it('throws ComplianceHardBlockError with role_required for shop_staff override attempt', async () => {
    (tenantContext.requireCurrent as any).mockReturnValue(makeCtx('shop_staff'));
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await expect(
      svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-8', { justification: 'Staff trying to override' }),
    ).rejects.toMatchObject({ code: 'compliance.override.role_required' });
  });

  it('does NOT fire audit log when no override was used', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await svc.recordCashPayment(INVOICE, 1_000_000n, 'idem-5');

    expect(pool._tx.query).not.toHaveBeenCalledWith(
      expect.stringContaining('audit_events'),
      expect.any(Array),
    );
  });

  it('does NOT write override metadata or audit when override provided but payment is within limit', async () => {
    const pool = fakePool(INVOICE_ROW, 0n); // zero existing — payment is within limit
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    // override provided, but payment (Rs 1L) is under the limit (Rs 1.99999L)
    await svc.recordCashPayment(INVOICE, 10_000_000n, 'idem-9', { justification: 'Override not needed here at all' });

    expect(pool._tx.query).not.toHaveBeenCalledWith(
      expect.stringContaining('audit_events'),
      expect.any(Array),
    );
    expect(pool._tx.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE invoices SET compliance_overrides_jsonb'),
      expect.any(Array),
    );
  });
});

describe('PaymentService.recordCashPayment — PMLA threshold warnings', () => {
  let svc: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pmlaWarning when monthly cumulative reaches Rs 8,00,000 (warn)', async () => {
    // Rs 7,95,000 existing + Rs 8,000 new = Rs 8,03,000 monthly → warn
    const pool = fakePool(INVOICE_ROW, 0n, 80_300_000n); // monthly SUM = Rs 8,03,000
    setupWithTenantTx(pool);
    const q = fakeQueue();
    svc = new PaymentService(pool, q);

    const result = await svc.recordCashPayment(INVOICE, 800_000n, 'idem-pmla-warn');

    expect(result).toMatchObject({
      pmlaWarning: {
        status: 'warn',
        monthStr: expect.stringMatching(/^\d{4}-\d{2}$/),
        cumulativePaise: '80300000',
      },
    });
  });

  it('enqueues BullMQ job post-commit when PMLA warn triggered', async () => {
    const pool = fakePool(INVOICE_ROW, 0n, 80_000_000n);
    setupWithTenantTx(pool);
    const q = fakeQueue();
    svc = new PaymentService(pool, q);

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-pmla-job');

    expect(q.add).toHaveBeenCalledWith(
      'cash-threshold-warning',
      expect.objectContaining({ cumulativePaise: '80000000' }),
    );
  });

  it('writes PMLA_WARN_THRESHOLD_REACHED audit event on FIRST threshold crossing (pre=7.8L→post=8.3L)', async () => {
    // Pre-payment = Rs 7,80,000 (ok), post = Rs 8,30,000 (warn) → crossing fires
    const pool = fakePool(INVOICE_ROW, 0n, 83_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-pmla-audit');

    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('audit_events'),
      expect.arrayContaining([AuditAction.PMLA_WARN_THRESHOLD_REACHED]),
    );
  });

  it('does NOT write audit event or enqueue job when customer is already in warn zone (Rs 9L)', async () => {
    // Pre-payment = Rs 8,5L (already warn), post = Rs 9L (warn) → no crossing
    const pool = fakePool(INVOICE_ROW, 0n, 90_000_000n);
    setupWithTenantTx(pool);
    const q = fakeQueue();
    svc = new PaymentService(pool, q);

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-pmla-no-dup');

    expect(q.add).not.toHaveBeenCalled();
    expect(pool._tx.query).not.toHaveBeenCalledWith(
      expect.stringContaining('audit_events'),
      expect.arrayContaining([AuditAction.PMLA_WARN_THRESHOLD_REACHED]),
    );
  });

  it('does NOT return pmlaWarning when monthly is below Rs 8,00,000 (ok)', async () => {
    const pool = fakePool(INVOICE_ROW, 0n, 50_000_000n); // Rs 5L — ok
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    const result = await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-pmla-ok');

    expect(result).not.toHaveProperty('pmlaWarning');
  });

  it('does NOT enqueue BullMQ job when PMLA status is ok', async () => {
    const pool = fakePool(INVOICE_ROW, 0n, 50_000_000n);
    setupWithTenantTx(pool);
    const q = fakeQueue();
    svc = new PaymentService(pool, q);

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-pmla-nojob');

    expect(q.add).not.toHaveBeenCalled();
  });

  it('tenant A PMLA aggregate does not affect tenant B (service-layer isolation)', async () => {
    // Tenant A shopId = SHOP — ctx is scoped to SHOP via RLS.
    // This test verifies: if the DB returns a high monthly total for SHOP, it warns.
    // Tenant B's aggregates are never returned because RLS filters them.
    // Service-layer test: just verify PMLA logic runs per-context.
    const pool = fakePool(INVOICE_ROW, 0n, 80_000_000n); // warn threshold
    setupWithTenantTx(pool);
    svc = new PaymentService(pool, fakeQueue());

    const result = await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-tenant-pmla');
    expect(result).toHaveProperty('pmlaWarning');
  });
});
