/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';
import type { CrmRepository } from './crm.repository';
import type { BillingService } from '../billing/billing.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER_ID = 'eeeeeeee-ffff-4000-8000-000000000003';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function baseCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer',
    email: null, address_line1: null, address_line2: null, city: null, state: null,
    pincode: null, dob_year: null, pan_ciphertext: null, pan_key_id: null,
    notes: null, viewing_consent: false, created_by_user_id: USER,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'), ...overrides,
  };
}

function fakeCrmRepo(customer: any = baseCustomerRow()): CrmRepository {
  return {
    getCustomerById: vi.fn(async () => customer),
    insertCustomer: vi.fn(),
    listCustomers: vi.fn(),
    updateCustomer: vi.fn(),
  } as unknown as CrmRepository;
}

function fakeBillingSvc(result: any = { invoices: [], total: 0 }): BillingService {
  return {
    getPurchaseHistoryForCustomer: vi.fn(async () => result),
    createInvoice: vi.fn(),
    getInvoice: vi.fn(),
    listInvoices: vi.fn(),
    decryptInvoicePan: vi.fn(),
  } as unknown as BillingService;
}

function makeSvc(crmRepo?: CrmRepository, billing?: BillingService): HistoryService {
  return new HistoryService(
    billing ?? fakeBillingSvc(),
    crmRepo ?? fakeCrmRepo(),
  );
}

// ─── getPurchaseHistory ────────────────────────────────────────────────────────

describe('getPurchaseHistory', () => {
  it('returns paginated results with invoices and total', async () => {
    const mockInvoices = [
      {
        invoiceId: 'inv-1', invoiceNumber: 'GS-001-001', issuedAt: new Date('2026-04-22'),
        totalFormatted: '₹1,12,440', lineCount: 3, paymentMethod: 'UPI', status: 'ISSUED',
      },
    ];
    const billing = fakeBillingSvc({ invoices: mockInvoices, total: 1 });
    const svc = makeSvc(undefined, billing);

    const result = await svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 20, offset: 0 });

    expect(result.invoices).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.invoices[0]).toMatchObject({ invoiceId: 'inv-1', paymentMethod: 'UPI', lineCount: 3 });
  });

  it('delegates to BillingService — no direct DB queries from CRM module', async () => {
    const billing = fakeBillingSvc({ invoices: [], total: 0 });
    const svc = makeSvc(undefined, billing);

    await svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 10, offset: 5 });

    expect(billing.getPurchaseHistoryForCustomer).toHaveBeenCalledWith(CUSTOMER_ID, { limit: 10, offset: 5 });
  });

  it('throws NotFoundException when customer does not belong to shop', async () => {
    const crmRepo = fakeCrmRepo(null);
    const svc = makeSvc(crmRepo);

    await expect(svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 20, offset: 0 }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes limit and offset through to BillingService', async () => {
    const billing = fakeBillingSvc({ invoices: [], total: 0 });
    const svc = makeSvc(undefined, billing);

    await svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 5, offset: 15 });

    const callArgs = (billing.getPurchaseHistoryForCustomer as any).mock.calls[0];
    expect(callArgs[1]).toMatchObject({ limit: 5, offset: 15 });
  });
});
