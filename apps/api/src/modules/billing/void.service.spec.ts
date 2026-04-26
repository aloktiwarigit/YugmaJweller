/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { VoidService } from './void.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SHOP  = '0a1b2c3d-4e5f-4000-8000-000000000000';
const OWNER = '11111111-2222-4000-8000-000000000001';
const MGR   = '22222222-3333-4000-8000-000000000002';

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

function issuedAt(offsetMs = 60_000): Date {
  return new Date(Date.now() - offsetMs);
}

function invoiceRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'inv-1',
    shop_id: SHOP,
    invoice_number: 'GS-0A1B2C-20260425-ABCDEF',
    invoice_type: 'B2C',
    buyer_gstin: null, buyer_business_name: null,
    seller_state_code: '09', gst_treatment: 'CGST_SGST',
    customer_id: null, customer_name: 'Test Customer', customer_phone: null,
    status: 'ISSUED',
    subtotal_paise: 100_000n, gst_metal_paise: 3_000n, gst_making_paise: 600n,
    total_paise: 103_600n,
    cgst_metal_paise: 0n, sgst_metal_paise: 0n, cgst_making_paise: 0n,
    sgst_making_paise: 0n, igst_metal_paise: 0n, igst_making_paise: 0n,
    idempotency_key: 'idem-1',
    issued_at: issuedAt(60_000),
    created_by_user_id: OWNER,
    pan_ciphertext: null, pan_key_id: null, form60_encrypted: null, form60_key_id: null,
    voided_at: null, voided_by_user_id: null, void_reason: null,
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

// ── Mock pg pool (withTenantTx runs the callback on a fake client) ────────────

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (pool: any, fn: (client: any) => Promise<unknown>) => {
    return fn(pool.__client);
  },
}));

vi.mock('@goldsmith/audit', () => ({
  AuditAction: {
    INVOICE_VOIDED:    'INVOICE_VOIDED',
    CREDIT_NOTE_ISSUED: 'CREDIT_NOTE_ISSUED',
  },
  auditLog: vi.fn(),
}));

function makePool(querySeq: Array<{ rows: unknown[] }>): any {
  let idx = 0;
  const client = {
    query: vi.fn(async () => {
      const r = querySeq[idx++] ?? { rows: [] };
      return r;
    }),
  };
  return { __client: client, _client: client };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VoidService.voidInvoice', () => {
  it('throws ForbiddenException for MANAGER role', async () => {
    const svc = new VoidService(makePool([]));
    await expect(
      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for STAFF role', async () => {
    const svc = new VoidService(makePool([]));
    await expect(
      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException with billing.void.role_required code', async () => {
    const svc = new VoidService(makePool([]));
    try {
      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'billing.void.role_required' });
    }
  });

  it('throws NotFoundException when invoice not found', async () => {
    const pool = makePool([{ rows: [] }]); // SELECT FOR UPDATE returns nothing
    const svc = new VoidService(pool);
    await expect(
      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException for VOIDED invoice (invalid_status)', async () => {
    const pool = makePool([{ rows: [invoiceRow({ status: 'VOIDED', voided_at: new Date() })] }]);
    const svc = new VoidService(pool);
    try {
      await svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
    } catch (e: any) {
      expect(e.getResponse?.()?.code ?? e.message).toContain('invalid_status');
    }
  });

  it('throws UnprocessableEntityException for ISSUED invoice outside 24h window', async () => {
    const expiredIssuedAt = new Date(Date.now() - VOID_WINDOW_MS - 60_000);
    const pool = makePool([{ rows: [invoiceRow({ issued_at: expiredIssuedAt })] }]);
    const svc = new VoidService(pool);
    try {
      await svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
    } catch (e: any) {
      expect(e.getResponse?.()?.code ?? e.message).toContain('window_expired');
    }
  });

  it('succeeds for OWNER within 24h, returns VOIDED invoice', async () => {
    const voidedRow = invoiceRow({ status: 'VOIDED', voided_at: new Date(), void_reason: 'test reason' });
    const pool = makePool([
      { rows: [invoiceRow()] },           // SELECT FOR UPDATE → ISSUED invoice
      { rows: [voidedRow] },              // UPDATE invoices → VOIDED
      { rows: [] },                       // SELECT invoice_items (no product-backed items)
      { rows: [] },                       // SELECT payments (no cash payments)
    ]);
    const svc = new VoidService(pool);
    const result = await svc.voidInvoice(
      { userId: OWNER, role: 'shop_admin', shopId: SHOP },
      'inv-1',
      { reason: 'test reason' },
    );
    expect(result.status).toBe('VOIDED');
    expect(result.void_reason).toBe('test reason');
  });
});

describe('VoidService.issueCreditNote', () => {
  it('throws ForbiddenException for non-OWNER', async () => {
    const svc = new VoidService(makePool([]));
    await expect(
      svc.issueCreditNote({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when invoice not found', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new VoidService(pool);
    await expect(
      svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException with billing.credit_note.use_void_instead when within 24h', async () => {
    // Invoice issued 1h ago — still within window
    const pool = makePool([{ rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: issuedAt(60 * 60 * 1000), total_paise: 100_000n, shop_id: SHOP }] }]);
    const svc = new VoidService(pool);
    try {
      await svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'billing.credit_note.use_void_instead',
      });
    }
  });

  it('succeeds and returns credit note for ISSUED invoice outside 24h', async () => {
    const oldIssuedAt = new Date(Date.now() - VOID_WINDOW_MS - 2 * 60 * 60 * 1000); // 26h ago
    const cnRow = {
      id: 'cn-1', shop_id: SHOP, original_invoice_id: 'inv-1',
      credit_number: 'CN-0A1B2C-20260425-ABCDEF',
      reason: 'test', total_paise: 100_000n,
      issued_at: new Date(), issued_by_user_id: OWNER, created_at: new Date(),
    };
    const pool = makePool([
      { rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: oldIssuedAt, total_paise: 100_000n, shop_id: SHOP }] },
      { rows: [cnRow] }, // INSERT credit_notes
    ]);
    const svc = new VoidService(pool);
    const result = await svc.issueCreditNote(
      { userId: OWNER, role: 'shop_admin', shopId: SHOP },
      'inv-1',
      { reason: 'test' },
    );
    expect(result.id).toBe('cn-1');
    expect(result.creditNumber).toMatch(/^CN-/);
  });

  it('throws ConflictException with billing.credit_note.already_issued on duplicate', async () => {
    const oldIssuedAt = new Date(Date.now() - VOID_WINDOW_MS - 2 * 60 * 60 * 1000);
    const pgDupError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: oldIssuedAt, total_paise: 100_000n, shop_id: SHOP }] })
        .mockRejectedValueOnce(pgDupError),
    };
    const pool = { __client: mockClient };
    const svc = new VoidService(pool as any);
    try {
      await svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'billing.credit_note.already_issued' });
    }
  });
});
