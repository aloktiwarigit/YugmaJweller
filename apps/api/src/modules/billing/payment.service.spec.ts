/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ComplianceHardBlockError, SECTION_269ST_LIMIT_PAISE } from '@goldsmith/compliance';
import { PaymentService } from './payment.service';

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

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    COMPLIANCE_OVERRIDE_269ST: 'COMPLIANCE_OVERRIDE_269ST',
  },
}));

vi.mock('@goldsmith/db', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/db')>('@goldsmith/db');
  return { ...actual, withTenantTx: vi.fn() };
});

function makeTx(
  invoiceRow: { id: string; customer_id: string | null; customer_phone: string | null } | null,
  existingPaise = 0n,
) {
  return {
    query: vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM invoices')) {
        return { rows: invoiceRow ? [invoiceRow] : [] };
      }
      if (sql.includes('pmla_aggregates_unique')) {
        // pg returns BIGINT as string — mirror that in the mock
        return { rows: [{ cash_total_paise: existingPaise.toString() }] };
      }
      if (sql.includes('UPDATE invoices SET compliance_overrides_jsonb')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO payments')) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
}

function fakePool(
  invoiceRow: { id: string; customer_id: string | null; customer_phone: string | null } | null,
  existingPaise = 0n,
) {
  const tx = makeTx(invoiceRow, existingPaise);
  return { _tx: tx, connect: vi.fn() } as any;
}

import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog } from '@goldsmith/audit';

function setupWithTenantTx(pool: ReturnType<typeof fakePool>) {
  (withTenantTx as any).mockImplementation((_p: any, fn: (tx: any) => Promise<any>) =>
    fn(pool._tx),
  );
}

const INVOICE_ROW = { id: INVOICE, customer_id: null, customer_phone: '+919999999999' };

describe('PaymentService.recordCashPayment', () => {
  let svc: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a cash payment below the limit without override', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(svc.recordCashPayment(INVOICE, 10_000_000n, 'idem-1')).resolves.toBeUndefined();
    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      expect.arrayContaining([INVOICE]),
    );
  });

  it('throws NotFoundException when invoice not found', async () => {
    const pool = fakePool(null, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(svc.recordCashPayment(INVOICE, 1_000_000n, 'idem-2')).rejects.toMatchObject({
      response: { code: 'invoice.not_found' },
    });
  });

  it('throws ComplianceHardBlockError when cash would exceed limit (no override)', async () => {
    // Existing Rs 1,80,000 + new Rs 30,000 = Rs 2,10,000 > Rs 1,99,999
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(
      svc.recordCashPayment(INVOICE, 3_000_000n, 'idem-3'),
    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
  });

  it('succeeds when exactly at limit (Rs 0 existing + Rs 1,99,999 new)', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(
      svc.recordCashPayment(INVOICE, SECTION_269ST_LIMIT_PAISE, 'idem-4'),
    ).resolves.toBeUndefined();
  });

  it('allows override by shop_admin with valid justification', async () => {
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(
      svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-6', { justification: 'Known regular customer bulk purchase' }),
    ).resolves.toBeUndefined();

    // Override metadata must be written to invoice
    expect(pool._tx.query).toHaveBeenCalledWith(
      expect.stringContaining('compliance_overrides_jsonb'),
      expect.any(Array),
    );
  });

  it('fires COMPLIANCE_OVERRIDE_269ST audit log on override', async () => {
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-7', { justification: 'Known regular customer bulk purchase' });

    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'COMPLIANCE_OVERRIDE_269ST' }),
    );
  });

  it('throws ComplianceHardBlockError with role_required for shop_staff override attempt', async () => {
    (tenantContext.requireCurrent as any).mockReturnValue(makeCtx('shop_staff'));
    const pool = fakePool(INVOICE_ROW, 18_000_000n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await expect(
      svc.recordCashPayment(INVOICE, 5_000_000n, 'idem-8', { justification: 'Staff trying to override' }),
    ).rejects.toMatchObject({ code: 'compliance.override.role_required' });
  });

  it('does NOT fire audit log when no override was used', async () => {
    const pool = fakePool(INVOICE_ROW, 0n);
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    await svc.recordCashPayment(INVOICE, 1_000_000n, 'idem-5');

    expect(auditLog).not.toHaveBeenCalled();
  });

  it('does NOT write override metadata or audit when override provided but payment is within limit', async () => {
    const pool = fakePool(INVOICE_ROW, 0n); // zero existing — payment is within limit
    setupWithTenantTx(pool);
    svc = new PaymentService(pool);

    // override provided, but payment (Rs 1L) is under the limit (Rs 1.99999L)
    await svc.recordCashPayment(INVOICE, 10_000_000n, 'idem-9', { justification: 'Override not needed here at all' });

    expect(auditLog).not.toHaveBeenCalled();
    expect(pool._tx.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE invoices SET compliance_overrides_jsonb'),
      expect.any(Array),
    );
  });
});
