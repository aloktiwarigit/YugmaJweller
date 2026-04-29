/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock @goldsmith/tenant-context before any imports that reference it
const SHOP = '0a1b2c3d-4e5f-4000-8000-000000000000';
const USER = '11111111-2222-4000-8000-000000000000';
const CUSTOMER_ID = 'cccccccc-dddd-4000-8000-000000000001';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: any) => Promise<unknown>) => {
    const fakeTx = { query: vi.fn(async () => ({ rows: [] })) };
    return fn(fakeTx);
  }),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    INVOICE_CREATED: 'INVOICE_CREATED',
    LOYALTY_POINTS_REDEEMED: 'LOYALTY_POINTS_REDEEMED',
  },
}));

vi.mock('@goldsmith/observability', () => ({
  trackEvent: vi.fn(),
}));

import { BillingService } from './billing.service';

const INVOICE_ID = 'inv-loyalty-test-001';

// Fake PoolClient passed to onAfterInsert
const fakeTxForInsert = { query: vi.fn() } as unknown as import('pg').PoolClient;

function fakeRepo(opts: { totalPaiseCapture?: (v: bigint) => void } = {}) {
  return {
    insertInvoice: vi.fn(async (input: any, insertOpts?: { onAfterInsert?: any }) => {
      opts.totalPaiseCapture?.(input.totalPaise);
      if (insertOpts?.onAfterInsert) {
        await insertOpts.onAfterInsert(fakeTxForInsert, INVOICE_ID);
      }
      return {
        invoice: {
          id: INVOICE_ID,
          shop_id: SHOP,
          invoice_number: input.invoiceNumber,
          invoice_type: input.invoiceType ?? 'B2C',
          buyer_gstin: null, buyer_business_name: null,
          seller_state_code: '09', gst_treatment: 'CGST_SGST',
          cgst_metal_paise: 0n, sgst_metal_paise: 0n,
          cgst_making_paise: 0n, sgst_making_paise: 0n,
          igst_metal_paise: 0n, igst_making_paise: 0n,
          customer_id: input.customerId ?? null,
          customer_name: input.customerName,
          customer_phone: input.customerPhone ?? null,
          status: 'ISSUED',
          subtotal_paise: input.subtotalPaise,
          gst_metal_paise: input.gstMetalPaise,
          gst_making_paise: input.gstMakingPaise,
          total_paise: input.totalPaise,
          idempotency_key: input.idempotencyKey,
          issued_at: input.issuedAt,
          created_by_user_id: input.createdByUserId,
          pan_ciphertext: null, pan_key_id: null,
          form60_encrypted: null, form60_key_id: null,
          tcs_collected_paise: input.tcsCollectedPaise ?? 0n,
          voided_at: null, voided_by_user_id: null, void_reason: null,
          created_at: new Date(), updated_at: new Date(),
        },
        items: input.items.map((it: any, i: number) => ({
          id: `item-${i}`, shop_id: SHOP, invoice_id: INVOICE_ID,
          product_id: it.productId, description: it.description, hsn_code: it.hsnCode,
          huid: it.huid, metal_type: it.metalType, purity: it.purity,
          net_weight_g: it.netWeightG, rate_per_gram_paise: it.ratePerGramPaise,
          making_charge_pct: it.makingChargePct, gold_value_paise: it.goldValuePaise,
          making_charge_paise: it.makingChargePaise, stone_charges_paise: it.stoneChargesPaise,
          hallmark_fee_paise: it.hallmarkFeePaise, gst_metal_paise: it.gstMetalPaise,
          gst_making_paise: it.gstMakingPaise, line_total_paise: it.lineTotalPaise,
          sort_order: it.sortOrder,
        })),
      };
    }),
    getInvoiceByIdempotencyKey: vi.fn(async () => null),
    getInvoice: vi.fn(async () => null),
  };
}

function fakePricing() {
  return {
    getCurrentRatesForTenant: vi.fn(async () => ({
      GOLD_22K: { perGramPaise: 684_200n, fetchedAt: new Date() },
      GOLD_24K: { perGramPaise: 700_000n, fetchedAt: new Date() },
      GOLD_20K: { perGramPaise: 600_000n, fetchedAt: new Date() },
      GOLD_18K: { perGramPaise: 500_000n, fetchedAt: new Date() },
      GOLD_14K: { perGramPaise: 400_000n, fetchedAt: new Date() },
      SILVER_999: { perGramPaise: 8_000n, fetchedAt: new Date() },
      SILVER_925: { perGramPaise: 7_500n, fetchedAt: new Date() },
      stale: false, source: 'ibja', overriddenPurities: [],
    })),
  };
}

function fakeInventory() {
  return {
    getProductRowForBilling: vi.fn(async (id: string) => ({
      id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
      net_weight_g: '10.0000', huid: 'AB12CD', status: 'IN_STOCK', category: null,
    })),
  };
}

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
    del: vi.fn(async (k: string) => { store.delete(k); }),
    setex: vi.fn(async (k: string, _t: number, v: string) => { store.set(k, v); }),
  };
}

function fakeLoyaltyService() {
  return {
    redeemPointsInTx: vi.fn(async () => undefined),
  };
}

function buildSvc(
  repo: ReturnType<typeof fakeRepo>,
  loyaltyService?: ReturnType<typeof fakeLoyaltyService>,
) {
  return new BillingService(
    repo as any,
    fakeInventory() as any,
    fakePricing() as any,
    fakeRedis() as any,
    // pool: customer existence check returns exists=true
    { query: vi.fn(async () => ({ rows: [{ exists: true }] })), connect: vi.fn() } as any,
    { encrypt: vi.fn(), decrypt: vi.fn() } as any,
    { getMakingCharges: vi.fn(async () => null), getLoyalty: vi.fn(async () => null) } as any,
    { getMakingCharges: vi.fn(async () => null) } as any,
    undefined, // events (@Optional)
    loyaltyService as any,
  );
}

function manualLineDto(overrides: Record<string, unknown> = {}) {
  return {
    invoiceType: 'B2C' as const,
    customerId: CUSTOMER_ID,
    customerName: 'राम',
    lines: [{
      description: 'Gold Bangle',
      metalType: 'GOLD' as const,
      purity: 'GOLD_22K',
      netWeightG: '10.0000',
      makingChargePct: '12.00',
      stoneChargesPaise: '0',
      hallmarkFeePaise: '0',
    }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (fakeTxForInsert as any).query.mockReset?.();
});

describe('BillingService — loyalty redemption', () => {
  it('loyaltyPointsToRedeem reduces totalPaise by points (1 point = 1 paise)', async () => {
    const POINTS = 500;
    let baseTotal = 0n;
    let discountedTotal = 0n;

    const repoBase = fakeRepo({ totalPaiseCapture: (v) => { baseTotal = v; } });
    await buildSvc(repoBase).createInvoice(
      manualLineDto({ loyaltyPointsToRedeem: undefined }),
      'idem-base',
    );

    const repoDisc = fakeRepo({ totalPaiseCapture: (v) => { discountedTotal = v; } });
    await buildSvc(repoDisc, fakeLoyaltyService()).createInvoice(
      manualLineDto({ loyaltyPointsToRedeem: POINTS }),
      'idem-disc',
    );

    expect(discountedTotal).toBe(baseTotal - BigInt(POINTS));
  });

  it('redeemPointsInTx called with the invoice tx, shopId and correct params', async () => {
    const loyalty = fakeLoyaltyService();
    const repo = fakeRepo();
    await buildSvc(repo, loyalty).createInvoice(
      manualLineDto({ loyaltyPointsToRedeem: 200 }),
      'idem-atomic',
    );

    expect(loyalty.redeemPointsInTx).toHaveBeenCalledOnce();
    const [tx, shopId, params] = (loyalty.redeemPointsInTx as any).mock.calls[0];
    expect(tx).toBe(fakeTxForInsert);
    expect(shopId).toBe(SHOP);
    expect(params).toMatchObject({
      customerId:     CUSTOMER_ID,
      invoiceId:      INVOICE_ID,
      pointsToRedeem: 200,
    });
  });

  it('no redemption when loyaltyPointsToRedeem is 0 or absent', async () => {
    const loyalty = fakeLoyaltyService();

    await buildSvc(fakeRepo(), loyalty).createInvoice(
      manualLineDto({ loyaltyPointsToRedeem: 0 }), 'idem-zero',
    );
    await buildSvc(fakeRepo(), loyalty).createInvoice(
      manualLineDto({}), 'idem-absent',
    );

    expect(loyalty.redeemPointsInTx).not.toHaveBeenCalled();
  });

  it('no redemption for walk-in invoice (customerId absent)', async () => {
    const loyalty = fakeLoyaltyService();
    await buildSvc(fakeRepo(), loyalty).createInvoice(
      {
        invoiceType: 'B2C' as const,
        customerName: 'Walk-in',
        lines: [{
          description: 'Gold Ring',
          metalType: 'GOLD' as const,
          purity: 'GOLD_22K',
          netWeightG: '5.0000',
          makingChargePct: '12.00',
          stoneChargesPaise: '0',
          hallmarkFeePaise: '0',
        }],
        loyaltyPointsToRedeem: 300,
      },
      'idem-walkin',
    );

    expect(loyalty.redeemPointsInTx).not.toHaveBeenCalled();
  });
});
