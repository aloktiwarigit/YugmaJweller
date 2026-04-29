/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';

const SHOP      = '0a1b2c3d-4e5f-4000-8000-000000000000';
const USER      = '11111111-2222-4000-8000-000000000000';
const EST_ID    = 'eeeeeeee-0000-4000-8000-000000000001';
const INV_ID    = 'ffffffff-0000-4000-8000-000000000002';
const IDEM_KEY  = 'test-convert-idem-key';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/audit', () => ({
  AuditAction: {
    INVOICE_CREATED:    'INVOICE_CREATED',
    INVOICE_ISSUED:     'INVOICE_ISSUED',
    INVOICE_PAN_ACCESSED: 'INVOICE_PAN_ACCESSED',
  },
  auditLog: vi.fn(async () => undefined),
}));

vi.mock('@goldsmith/observability', () => ({
  trackEvent: vi.fn(),
}));

function makeEstimate(overrides: Partial<any> = {}): any {
  return {
    id:                   EST_ID,
    shopId:               SHOP,
    customerId:           null,
    lineItems: [{
      productId:          null,
      description:        '22K Gold Necklace',
      hsnCode:            '7113',
      huid:               null,
      metalType:          'GOLD',
      purity:             '22K',
      netWeightG:         '10.0000',
      ratePerGramPaise:   '684200',
      makingChargePct:    '12.00',
      goldValuePaise:     '6842000',
      makingChargePaise:  '821040',
      stoneChargesPaise:  '0',
      hallmarkFeePaise:   '0',
      gstMetalPaise:      '205260',
      gstMakingPaise:     '41052',
      lineTotalPaise:     '7909352',
      sortOrder:          0,
    }],
    goldRatePaisePerGram: '684200',
    subtotalPaise:        '7663040',
    gstPaise:             '246312',
    totalPaise:           '7909352',
    status:               'draft',
    expiresAt:            null,
    convertedInvoiceId:   null,
    createdByUserId:      USER,
    createdAt:            new Date().toISOString(),
    ...overrides,
  };
}

function makeInvoiceRow(): any {
  return {
    id:                   INV_ID,
    shop_id:              SHOP,
    invoice_number:       'GS-ABC123',
    invoice_type:         'B2C',
    buyer_gstin:          null,
    buyer_business_name:  null,
    seller_state_code:    '09',
    gst_treatment:        'CGST_SGST',
    customer_id:          null,
    customer_name:        'ग्राहक (अनुमान से)',
    customer_phone:       null,
    status:               'ISSUED',
    subtotal_paise:       7663040n,
    gst_metal_paise:      246312n,
    gst_making_paise:     0n,
    total_paise:          7909352n,
    cgst_metal_paise:     0n, sgst_metal_paise: 0n, cgst_making_paise: 0n,
    sgst_making_paise:    0n, igst_metal_paise: 0n, igst_making_paise: 0n,
    idempotency_key:      IDEM_KEY,
    issued_at:            new Date(),
    created_by_user_id:   USER,
    pan_ciphertext:       null, pan_key_id: null,
    form60_encrypted:     null, form60_key_id: null,
    tcs_collected_paise:  0n,
    voided_at:            null, voided_by_user_id: null, void_reason: null,
    created_at:           new Date(), updated_at: new Date(),
  };
}

function fakeRedis(): any {
  const store = new Map<string, string>();
  return {
    get:    vi.fn(async (k: string) => store.get(k) ?? null),
    setex:  vi.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); }),
    del:    vi.fn(async (k: string) => { store.delete(k); }),
    _store: store,
  };
}

function fakePool(): any {
  return {
    connect: vi.fn(),
    query:   vi.fn(async () => ({ rows: [{ exists: true }] })),
  };
}

function fakeRepo(invoiceRow = makeInvoiceRow()): any {
  return {
    insertInvoice:              vi.fn(async () => ({ invoice: invoiceRow, items: [] })),
    getInvoiceByIdempotencyKey: vi.fn(async () => null),
    getInvoice:                 vi.fn(async () => null),
    listInvoices:               vi.fn(async () => []),
  };
}

function fakeEstimateService(estimate = makeEstimate()): any {
  return {
    getEstimate:    vi.fn(async () => estimate),
    markConverted:  vi.fn(async () => undefined),
  };
}

function buildSvc(overrides: {
  repo?: any;
  estimateSvc?: any;
  redis?: any;
  pool?: any;
} = {}): BillingService {
  return new BillingService(
    overrides.repo ?? fakeRepo(),
    undefined as any,     // inventory
    undefined as any,     // pricing
    overrides.redis ?? fakeRedis(),
    overrides.pool ?? fakePool(),
    undefined as any,     // kms
    undefined as any,     // settingsCache
    undefined as any,     // settingsRepo
    undefined,            // events
    undefined,            // loyaltyService
    overrides.estimateSvc ?? fakeEstimateService(),
  );
}

describe('BillingService.convertEstimateToInvoice', () => {
  it('inserts invoice from estimate and marks estimate converted', async () => {
    const repo = fakeRepo();
    const estimateSvc = fakeEstimateService();
    const svc = buildSvc({ repo, estimateSvc });

    const result = await svc.convertEstimateToInvoice(EST_ID, IDEM_KEY);

    expect(result.id).toBe(INV_ID);
    expect(repo.insertInvoice).toHaveBeenCalledOnce();
    expect(estimateSvc.markConverted).toHaveBeenCalledWith(EST_ID, INV_ID, SHOP);
  });

  it('throws when estimate is already converted', async () => {
    const svc = buildSvc({
      estimateSvc: fakeEstimateService(makeEstimate({ status: 'converted' })),
    });
    await expect(svc.convertEstimateToInvoice(EST_ID, IDEM_KEY)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when estimate is expired', async () => {
    const svc = buildSvc({
      estimateSvc: fakeEstimateService(makeEstimate({ status: 'expired' })),
    });
    await expect(svc.convertEstimateToInvoice(EST_ID, IDEM_KEY)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when idempotency key is missing', async () => {
    const svc = buildSvc();
    await expect(svc.convertEstimateToInvoice(EST_ID, '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns cached invoice on duplicate idempotency key', async () => {
    const cachedInvoice = {
      id: 'cached-inv', shopId: SHOP, invoiceNumber: 'GS-CACHED',
      invoiceType: 'B2C', customerId: null, customerName: 'Cached',
      customerPhone: null, status: 'ISSUED',
      subtotalPaise: '100', gstMetalPaise: '3', gstMakingPaise: '0', totalPaise: '103',
      idempotencyKey: IDEM_KEY, issuedAt: null,
      createdByUserId: USER, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      lines: [], buyerGstin: null, buyerBusinessName: null, gstTreatment: 'CGST_SGST',
      cgstMetalPaise: '0', sgstMetalPaise: '0', cgstMakingPaise: '0', sgstMakingPaise: '0',
      igstMetalPaise: '0', igstMakingPaise: '0', voidedAt: null, voidedByUserId: null,
      voidReason: null, tcsCollectedPaise: '0',
    };
    const redis = fakeRedis();
    await redis.setex(`invoice:idempotency:${SHOP}:${IDEM_KEY}`, 86400, JSON.stringify(cachedInvoice));

    const repo = fakeRepo();
    const svc = buildSvc({ repo, redis });

    const result = await svc.convertEstimateToInvoice(EST_ID, IDEM_KEY);
    expect(result.id).toBe('cached-inv');
    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });
});
