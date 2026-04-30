/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

const SHOP     = '0a1b2c3d-4e5f-4000-8000-aaaaaaaaaaaa';
const USER     = '11111111-2222-4000-8000-000000000000';
const CUSTOMER = 'cccccccc-dddd-4000-8000-000000000001';
const BOOKING  = 'bbbbbbbb-1111-4000-8000-000000000001';
const INV_ID   = 'inv-ratelock-test-001';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: any) => Promise<unknown>) => {
    const fakeTx = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };
    return fn(fakeTx);
  }),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    INVOICE_CREATED: 'INVOICE_CREATED',
    INVOICE_ISSUED: 'INVOICE_ISSUED',
    RATE_LOCK_USED: 'RATE_LOCK_USED',
  },
}));

vi.mock('@goldsmith/observability', () => ({ trackEvent: vi.fn() }));

import { BillingService } from './billing.service';
import { applyRateLockScaling } from '../rate-lock-bookings/rate-lock-bookings.service';

const LIVE_RATES = {
  GOLD_24K:   { perGramPaise: 700_000n, fetchedAt: new Date() },
  GOLD_22K:   { perGramPaise: 641_667n, fetchedAt: new Date() },
  GOLD_20K:   { perGramPaise: 583_333n, fetchedAt: new Date() },
  GOLD_18K:   { perGramPaise: 525_000n, fetchedAt: new Date() },
  GOLD_14K:   { perGramPaise: 408_333n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 8_000n,   fetchedAt: new Date() },
  SILVER_925: { perGramPaise: 7_500n,   fetchedAt: new Date() },
  stale: false, source: 'ibja', overriddenPurities: [],
};

// ── applyRateLockScaling unit tests ─────────────────────────────────────────

describe('applyRateLockScaling', () => {
  it('scales GOLD_* purities proportionally', () => {
    const locked = 630_000n;
    const scaled = applyRateLockScaling(LIVE_RATES as any, locked);
    // 24K: 700_000 × 630_000 / 700_000 + 350_000/700_000 = 630_000 (exact)
    expect((scaled as any).GOLD_24K.perGramPaise).toBe(630_000n);
    // Silver unchanged
    expect((scaled as any).SILVER_999.perGramPaise).toBe(8_000n);
  });

  it('returns rates unchanged when current24k === 0n', () => {
    const zero = { ...LIVE_RATES, GOLD_24K: { perGramPaise: 0n, fetchedAt: new Date() } };
    const result = applyRateLockScaling(zero as any, 500_000n);
    expect((result as any).GOLD_24K.perGramPaise).toBe(0n);
  });
});

// ── BillingService rate-lock integration ────────────────────────────────────

describe('BillingService rate-lock integration', () => {
  const fakeTxForInsert = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };

  function makeRateLockSvc(hasLock: boolean, confirmResult = true) {
    return {
      peekActiveLock:   vi.fn(async () =>
        hasLock ? { bookingId: BOOKING, lockedRate24kPaise: 630_000n } : null,
      ),
      confirmAndMarkUsed: vi.fn(async () => confirmResult),
    };
  }

  function makeRepo(captureRate?: (rate: bigint) => void) {
    return {
      getInvoiceByIdempotencyKey: vi.fn(async () => null),
      insertInvoice: vi.fn(async (input: any, opts?: { onAfterInsert?: any }) => {
        captureRate?.(input.items[0]?.ratePerGramPaise);
        if (opts?.onAfterInsert) await opts.onAfterInsert(fakeTxForInsert, INV_ID);
        return {
          invoice: {
            id: INV_ID, shop_id: SHOP, invoice_number: 'INV-001',
            invoice_type: 'B2C', buyer_gstin: null, buyer_business_name: null,
            seller_state_code: '09', gst_treatment: 'CGST_SGST',
            cgst_metal_paise: 0n, sgst_metal_paise: 0n,
            cgst_making_paise: 0n, sgst_making_paise: 0n,
            igst_metal_paise: 0n, igst_making_paise: 0n,
            customer_id: CUSTOMER, customer_name: 'Test', customer_phone: null,
            status: 'ISSUED', subtotal_paise: 0n,
            gst_metal_paise: 0n, gst_making_paise: 0n, total_paise: input.totalPaise,
            idempotency_key: input.idempotencyKey, issued_at: input.issuedAt,
            created_by_user_id: input.createdByUserId,
            pan_ciphertext: null, pan_key_id: null,
            form60_encrypted: null, form60_key_id: null,
            tcs_collected_paise: 0n,
            voided_at: null, voided_by_user_id: null, void_reason: null,
            created_at: new Date(), updated_at: new Date(),
          },
          items: input.items.map((it: any, i: number) => ({
            id: `item-${i}`, shop_id: SHOP, invoice_id: INV_ID,
            product_id: it.productId, description: it.description, hsn_code: '7113',
            huid: it.huid ?? null, metal_type: it.metalType, purity: it.purity,
            net_weight_g: it.netWeightG, rate_per_gram_paise: it.ratePerGramPaise,
            making_charge_pct: it.makingChargePct, gold_value_paise: it.goldValuePaise,
            making_charge_paise: it.makingChargePaise,
            stone_charges_paise: it.stoneChargesPaise,
            hallmark_fee_paise: it.hallmarkFeePaise,
            gst_metal_paise: it.gstMetalPaise, gst_making_paise: it.gstMakingPaise,
            line_total_paise: it.lineTotalPaise, sort_order: i,
          })),
        };
      }),
    };
  }

  function makeSvc(rateLockSvc: any, repo: any) {
    const pool = {
      query: vi.fn(async () => ({ rows: [{ exists: true }] })),
      connect: vi.fn(),
    };
    const redis = {
      get:   vi.fn(async () => null),
      setex: vi.fn(async () => undefined),
      del:   vi.fn(async () => undefined),
    };
    const pricing = {
      getCurrentRatesForTenant: vi.fn(async () => LIVE_RATES),
    };
    const inventory = {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
        net_weight_g: '10.000', huid: 'AB12CD',
        huid_exemption_category: 'none', status: 'IN_STOCK', category: 'RING',
      })),
    };
    const settingsCache = { getMakingCharges: vi.fn(async () => null), setMakingCharges: vi.fn() };
    const settingsRepo  = { getMakingCharges: vi.fn(async () => null) };
    const kms = { encrypt: vi.fn(), decrypt: vi.fn() };
    return new BillingService(
      repo as any,
      inventory as any,
      pricing as any,
      redis as any,
      pool as any,
      kms as any,
      settingsCache as any,
      settingsRepo as any,
      undefined,          // events
      undefined,          // loyaltyService
      undefined,          // estimateService
      rateLockSvc as any, // rateLockService — new last param
    );
  }

  const invoiceDto = {
    customerName: 'Ramesh Kumar',
    customerId:   CUSTOMER,
    lines: [{
      productId:         'prod-001',
      description:       '22K Gold Ring',
      huid:              'AB12CD', // matches inventory mock's huid field
      stoneChargesPaise: '0',
      hallmarkFeePaise:  '0',
    }],
    loyaltyPointsToRedeem: 0,
  };

  it('uses locked rate when active lock exists', async () => {
    let capturedRate: bigint | undefined;
    const svc = makeSvc(makeRateLockSvc(true), makeRepo((r) => { capturedRate = r; }));
    await svc.createInvoice(invoiceDto as any, 'idem-rl-001');
    // GOLD_22K live = 641_667, locked24k = 630_000, current24k = 700_000
    // scaled = (641_667 × 630_000 + 350_000) / 700_000 = 404_250_560_000 / 700_000 = 577_500
    expect(capturedRate).toBe(577_500n);
  });

  it('uses live rate when no active lock exists', async () => {
    let capturedRate: bigint | undefined;
    const svc = makeSvc(makeRateLockSvc(false), makeRepo((r) => { capturedRate = r; }));
    await svc.createInvoice(invoiceDto as any, 'idem-rl-002');
    expect(capturedRate).toBe(641_667n); // live 22K rate unchanged
  });

  it('calls confirmAndMarkUsed inside invoice tx when lock exists', async () => {
    const rlSvc = makeRateLockSvc(true);
    const svc = makeSvc(rlSvc, makeRepo());
    await svc.createInvoice(invoiceDto as any, 'idem-rl-003');
    expect(rlSvc.confirmAndMarkUsed).toHaveBeenCalledWith(BOOKING, fakeTxForInsert);
  });

  it('skips peekActiveLock for walk-in invoice (no customerId)', async () => {
    const rlSvc = makeRateLockSvc(false);
    const svc = makeSvc(rlSvc, makeRepo());
    await svc.createInvoice({ ...invoiceDto, customerId: undefined } as any, 'idem-rl-004');
    expect(rlSvc.peekActiveLock).not.toHaveBeenCalled();
  });
});
