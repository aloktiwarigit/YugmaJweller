/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { IdempotencyKeyConflictError } from './billing.repository';
import { ComplianceHardBlockError } from '@goldsmith/compliance';
import type { MakingChargeConfig } from '@goldsmith/shared';

const SHOP = '0a1b2c3d-4e5f-4000-8000-000000000000';
const USER = '11111111-2222-4000-8000-000000000000';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

function fakePool() {
  return { connect: vi.fn() } as unknown as import('pg').Pool;
}

function fakeRedis(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get:   vi.fn(async (k: string) => store.get(k) ?? null),
    setex: vi.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); }),
    del:   vi.fn(async (k: string) => { store.delete(k); }),
    _store: store,
  };
}

function fakePricing() {
  return {
    getCurrentRatesForTenant: vi.fn(async () => ({
      GOLD_24K: { perGramPaise: 700_000n, fetchedAt: new Date() },
      GOLD_22K: { perGramPaise: 684_200n, fetchedAt: new Date() },
      GOLD_20K: { perGramPaise: 600_000n, fetchedAt: new Date() },
      GOLD_18K: { perGramPaise: 500_000n, fetchedAt: new Date() },
      GOLD_14K: { perGramPaise: 400_000n, fetchedAt: new Date() },
      SILVER_999: { perGramPaise: 8_000n, fetchedAt: new Date() },
      SILVER_925: { perGramPaise: 7_500n, fetchedAt: new Date() },
      stale: false,
      source: 'ibja',
      overriddenPurities: [],
    })),
  };
}

function fakeInventory() {
  return {
    // Returns the hallmarked product the service needs to know about.
    getProductRowForBilling: vi.fn(async (id: string) => ({
      id,
      shop_id: SHOP,
      metal: 'GOLD',
      purity: 'GOLD_22K',
      net_weight_g: '10.0000',
      huid: 'AB12CD',
      status: 'IN_STOCK',
    })),
  };
}

function fakeSettingsCache(configs: MakingChargeConfig[] | null = null) {
  return {
    getMakingCharges: vi.fn(async () => configs),
    setMakingCharges: vi.fn(async () => undefined),
  };
}

function fakeSettingsRepo(configs: MakingChargeConfig[] | null = null) {
  return {
    getMakingCharges: vi.fn(async () => configs),
  };
}

function fakeRepo() {
  return {
    insertInvoice: vi.fn(async (input: any) => ({
      invoice: {
        id: 'inv-1', shop_id: SHOP,
        invoice_number: input.invoiceNumber,
        invoice_type: input.invoiceType,
        buyer_gstin: input.buyerGstin ?? null,
        buyer_business_name: input.buyerBusinessName ?? null,
        seller_state_code: input.sellerStateCode ?? '09',
        gst_treatment: input.gstTreatment ?? 'CGST_SGST',
        cgst_metal_paise: input.cgstMetalPaise ?? 0n,
        sgst_metal_paise: input.sgstMetalPaise ?? 0n,
        cgst_making_paise: input.cgstMakingPaise ?? 0n,
        sgst_making_paise: input.sgstMakingPaise ?? 0n,
        igst_metal_paise: input.igstMetalPaise ?? 0n,
        igst_making_paise: input.igstMakingPaise ?? 0n,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        status: input.status,
        subtotal_paise: input.subtotalPaise,
        gst_metal_paise: input.gstMetalPaise,
        gst_making_paise: input.gstMakingPaise,
        total_paise: input.totalPaise,
        idempotency_key: input.idempotencyKey,
        issued_at: input.issuedAt,
        created_by_user_id: input.createdByUserId,
        pan_ciphertext: null,
        pan_key_id: null,
        form60_encrypted: null,
        form60_key_id: null,
        created_at: new Date(), updated_at: new Date(),
      },
      items: input.items.map((it: any, i: number) => ({
        id: `item-${i}`, shop_id: SHOP, invoice_id: 'inv-1',
        ...it,
        // map camelCase → snake_case for the row shape the service expects from the repo
        product_id: it.productId,
        hsn_code: it.hsnCode,
        metal_type: it.metalType,
        net_weight_g: it.netWeightG,
        rate_per_gram_paise: it.ratePerGramPaise,
        making_charge_pct: it.makingChargePct,
        gold_value_paise: it.goldValuePaise,
        making_charge_paise: it.makingChargePaise,
        stone_charges_paise: it.stoneChargesPaise,
        hallmark_fee_paise: it.hallmarkFeePaise,
        gst_metal_paise: it.gstMetalPaise,
        gst_making_paise: it.gstMakingPaise,
        line_total_paise: it.lineTotalPaise,
        sort_order: it.sortOrder,
      })),
    })),
    getInvoice: vi.fn(async () => null),
    getInvoiceByIdempotencyKey: vi.fn(async () => null),
    listInvoices: vi.fn(async () => []),
  };
}

describe('BillingService.createInvoice', () => {
  it('hard-blocks when a hallmarked line omits HUID — no DB write', async () => {
    const repo = fakeRepo();
    const inv  = fakeInventory();
    const svc  = new BillingService(
      repo as any, inv as any, fakePricing() as any,
      fakeRedis() as any, fakePool(),
      undefined as any, undefined as any, undefined as any,
    );

    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'राम', lines: [
          { productId: 'p1', description: 'Gold Chain', huid: null, makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
        ]},
        'idem-1',
      ),
    ).rejects.toBeInstanceOf(ComplianceHardBlockError);

    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });

  it('returns cached invoice on idempotency-key hit (no insert)', async () => {
    const repo = fakeRepo();
    const inv  = fakeInventory();
    const cached = {
      id: 'inv-cached',
      shopId: SHOP,
      invoiceNumber: 'GS-XXX-20260425-AAA111',
      invoiceType: 'B2C',
      customerId: null,
      customerName: 'Cached',
      customerPhone: null,
      status: 'ISSUED',
      subtotalPaise: '0', gstMetalPaise: '0', gstMakingPaise: '0', totalPaise: '1',
      idempotencyKey: 'idem-cached',
      issuedAt: new Date().toISOString(),
      createdByUserId: USER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [],
    };
    const redis = fakeRedis({ [`invoice:idempotency:${SHOP}:idem-cached`]: JSON.stringify(cached) });

    const svc = new BillingService(repo as any, inv as any, fakePricing() as any, redis as any, fakePool(), undefined as any, undefined as any, undefined as any);
    const out = await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'Smoke', lines: [{ description: 'x', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
      'idem-cached',
    );

    expect(out.id).toBe('inv-cached');
    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });

  it('uses the product HUID, not the request HUID, to decide hallmark gate', async () => {
    const repo = fakeRepo();
    const inv  = fakeInventory();
    const svc  = new BillingService(
      repo as any, inv as any, fakePricing() as any,
      fakeRedis() as any, fakePool(),
      undefined as any, undefined as any, undefined as any,
    );

    // Request line has no huid; product on record DOES (hallmarked) → must hard-block
    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'राम', lines: [{ productId: 'p1', description: 'Gold Chain', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
        'idem-bypass-attempt',
      ),
    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
  });

  it('rejects when idempotencyKey is empty', async () => {
    const repo = fakeRepo();
    const inv  = fakeInventory();
    const svc  = new BillingService(repo as any, inv as any, fakePricing() as any, fakeRedis() as any, fakePool(), undefined as any, undefined as any, undefined as any);

    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'X', lines: [{ description: 'x', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
        '',
      ),
    ).rejects.toMatchObject({
      response: { code: 'invoice.idempotency_key_required' },
    });
  });

  it('status guard — SOLD product → BadRequestException invoice.product_not_billable', async () => {
    const repo = fakeRepo();
    const inv  = {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id,
        shop_id: SHOP,
        metal: 'GOLD',
        purity: 'GOLD_22K',
        net_weight_g: '10.0000',
        huid: null,
        status: 'SOLD',  // product already sold
      })),
    };
    const svc = new BillingService(
      repo as any, inv as any, fakePricing() as any,
      fakeRedis() as any, fakePool(),
      undefined as any, undefined as any, undefined as any,
    );

    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'राम', lines: [
          { productId: 'p-sold', description: 'Already sold item', makingChargePct: '10.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
        ]},
        'idem-sold-guard',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const err = await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'p-sold', description: 'Already sold item', makingChargePct: '10.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-sold-guard-2',
    ).catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'invoice.product_not_billable',
      status: 'SOLD',
    });
    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });

  it('insufficient_quantity — repo throws typed error → UnprocessableEntityException', async () => {
    const repo = {
      ...fakeRepo(),
      insertInvoice: vi.fn(async () => {
        throw new Error('invoice.insufficient_quantity:prod-xyz');
      }),
    };
    const inv = {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id,
        shop_id: SHOP,
        metal: 'GOLD',
        purity: 'GOLD_22K',
        net_weight_g: '10.0000',
        huid: null,
        status: 'IN_STOCK',
      })),
    };
    const svc = new BillingService(
      repo as any, inv as any, fakePricing() as any,
      fakeRedis() as any, fakePool(),
      undefined as any, undefined as any, undefined as any,
    );

    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'राम', lines: [
          { productId: 'prod-xyz', description: 'Zero qty item', makingChargePct: '10.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
        ]},
        'idem-insufficient',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const err = await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'prod-xyz', description: 'Zero qty item', makingChargePct: '10.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-insufficient-2',
    ).catch((e: unknown) => e);

    expect((err as UnprocessableEntityException).getResponse()).toMatchObject({
      code: 'invoice.insufficient_quantity',
      productId: 'prod-xyz',
    });
  });
});

describe('BillingService.createInvoice — making charges from shop settings', () => {
  function fakeInventoryWithCategory(category: string | null) {
    return {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id,
        shop_id: SHOP,
        metal: 'GOLD',
        purity: 'GOLD_22K',
        net_weight_g: '10.0000',
        huid: null,
        status: 'IN_STOCK',
        category,
      })),
    };
  }

  it('uses category making charge from shop settings when DTO omits makingChargePct', async () => {
    const repo = fakeRepo();
    const sc = fakeSettingsCache([{ category: 'BRIDAL', type: 'percent', value: '14.00' }]);
    const svc = new BillingService(
      repo as any,
      fakeInventoryWithCategory('BRIDAL') as any,
      fakePricing() as any,
      fakeRedis() as any,
      fakePool(),
      undefined as any,
      sc as any,
      fakeSettingsRepo() as any,
    );

    await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'p1', description: 'Bridal Set', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-bridal',
    );

    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
    expect(item.makingChargePct).toBe('14.00');
  });

  it('falls back to 12.00 when category has no matching config in shop settings', async () => {
    const repo = fakeRepo();
    const svc = new BillingService(
      repo as any,
      fakeInventoryWithCategory('RINGS') as any,
      fakePricing() as any,
      fakeRedis() as any,
      fakePool(),
      undefined as any,
      fakeSettingsCache([{ category: 'CHAINS', type: 'percent', value: '10.00' }]) as any,
      fakeSettingsRepo() as any,
    );

    await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'p1', description: 'Ring', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-rings-fallback',
    );

    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
    expect(item.makingChargePct).toBe('12.00');
  });

  it('DTO makingChargePct wins over shop settings', async () => {
    const repo = fakeRepo();
    const svc = new BillingService(
      repo as any,
      fakeInventoryWithCategory('BRIDAL') as any,
      fakePricing() as any,
      fakeRedis() as any,
      fakePool(),
      undefined as any,
      fakeSettingsCache([{ category: 'BRIDAL', type: 'percent', value: '14.00' }]) as any,
      fakeSettingsRepo() as any,
    );

    await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'p1', description: 'Bridal Override', huid: 'AB12CD', makingChargePct: '8.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-dto-override',
    );

    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
    expect(item.makingChargePct).toBe('8.00');
  });

  it('cache miss → fetches from DB via settingsRepo → uses DB value and warms cache', async () => {
    const repo = fakeRepo();
    const sc = fakeSettingsCache(null); // cache miss
    const sr = fakeSettingsRepo([{ category: 'CHAINS', type: 'percent', value: '10.00' }]);
    const svc = new BillingService(
      repo as any,
      fakeInventoryWithCategory('CHAINS') as any,
      fakePricing() as any,
      fakeRedis() as any,
      fakePool(),
      undefined as any,
      sc as any,
      sr as any,
    );

    await svc.createInvoice(
      { invoiceType: 'B2C', customerName: 'राम', lines: [
        { productId: 'p1', description: 'Chain', huid: 'AB12CD', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
      ]},
      'idem-cache-miss',
    );

    const item = (repo.insertInvoice.mock.calls[0][0] as any).items[0];
    expect(item.makingChargePct).toBe('10.00');
    expect(sr.getMakingCharges).toHaveBeenCalled();
    expect(sc.setMakingCharges).toHaveBeenCalledWith([{ category: 'CHAINS', type: 'percent', value: '10.00' }]);
  });
});

describe('BillingService — tenant isolation (service-layer RLS defense-in-depth)', () => {
  it('Tenant A B2B invoice is not readable by Tenant B (service-layer RLS check)', async () => {
    // This tests the defence-in-depth guard in billing.service.ts at the
    // idempotency-conflict handler (lines ~516-518):
    //   if (existing.invoice.shop_id !== ctx.shopId) throw BadRequestException
    //
    // The actual RLS enforcement lives in PostgreSQL (tested by integration tests).
    // This test covers the service-layer check that fires when the DB returns a
    // row with a mismatched shop_id — e.g. if a misconfigured RLS policy leaked
    // a cross-tenant invoice through the idempotency key fetch.
    //
    // Setup:
    //   - ctx.shopId = SHOP (shop-a)
    //   - repo.insertInvoice throws IdempotencyKeyConflictError (simulates key collision)
    //   - repo.getInvoiceByIdempotencyKey returns an invoice with shop_id = 'shop-b-uuid'
    //   - Service MUST throw BadRequestException (not return the other tenant's invoice)

    const SHOP_B = 'ffffffff-ffff-4000-8000-000000000099';

    const inv = {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id,
        shop_id: SHOP,
        metal: 'GOLD',
        purity: 'GOLD_22K',
        net_weight_g: '10.0000',
        huid: null,
        status: 'IN_STOCK',
      })),
    };

    const repo = {
      insertInvoice: vi.fn(async () => {
        throw new IdempotencyKeyConflictError('idem-cross-tenant');
      }),
      // First call: pre-flight check at line ~226 → returns null (no early return)
      // Second call: inside catch(IdempotencyKeyConflictError) → returns cross-tenant invoice
      getInvoiceByIdempotencyKey: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          invoice: {
            id: 'inv-tenant-b',
            shop_id: SHOP_B,  // Different tenant — must not be returned to SHOP
            invoice_number: 'GS-XXX-20260425-BBB999',
            invoice_type: 'B2B',
            buyer_gstin: '27ABCDE1234F1Z3',
            buyer_business_name: 'Other Jeweller',
            seller_state_code: '09',
            gst_treatment: 'IGST',
            cgst_metal_paise: 0n,
            sgst_metal_paise: 0n,
            cgst_making_paise: 0n,
            sgst_making_paise: 0n,
            igst_metal_paise: 900n,
            igst_making_paise: 250n,
            customer_id: null,
            customer_name: 'Other Customer',
            customer_phone: null,
            status: 'ISSUED',
            subtotal_paise: 30_000n,
            gst_metal_paise: 900n,
            gst_making_paise: 250n,
            total_paise: 31_150n,
            idempotency_key: 'idem-cross-tenant',
            issued_at: new Date(),
            created_by_user_id: 'some-other-user',
            pan_ciphertext: null,
            pan_key_id: null,
            form60_encrypted: null,
            form60_key_id: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
          items: [],
        }),
      getInvoice: vi.fn(async () => null),
      listInvoices: vi.fn(async () => []),
    };

    const svc = new BillingService(
      repo as any,
      inv as any,
      fakePricing() as any,
      fakeRedis() as any,
      fakePool(),
      undefined as any,
      undefined as any,
      undefined as any,
    );

    // The service must throw, not silently return Tenant B's invoice
    await expect(
      svc.createInvoice(
        { invoiceType: 'B2C', customerName: 'राम', lines: [
          { productId: 'p1', description: 'Ring', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any,
        ]},
        'idem-cross-tenant',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The cross-tenant invoice must never have been returned
    expect(repo.getInvoiceByIdempotencyKey).toHaveBeenCalled();
  });
});
