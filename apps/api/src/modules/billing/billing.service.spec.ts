/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';
import { ComplianceHardBlockError } from '@goldsmith/compliance';

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

function fakeRepo() {
  return {
    insertInvoice: vi.fn(async (input: any) => ({
      invoice: {
        id: 'inv-1', shop_id: SHOP,
        invoice_number: input.invoiceNumber,
        invoice_type: input.invoiceType,
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
    );

    await expect(
      svc.createInvoice(
        { customerName: 'राम', lines: [
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

    const svc = new BillingService(repo as any, inv as any, fakePricing() as any, redis as any, fakePool());
    const out = await svc.createInvoice(
      { customerName: 'Smoke', lines: [{ description: 'x', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
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
    );

    // Request line has no huid; product on record DOES (hallmarked) → must hard-block
    await expect(
      svc.createInvoice(
        { customerName: 'राम', lines: [{ productId: 'p1', description: 'Gold Chain', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
        'idem-bypass-attempt',
      ),
    ).rejects.toBeInstanceOf(ComplianceHardBlockError);
  });

  it('rejects when idempotencyKey is empty', async () => {
    const repo = fakeRepo();
    const inv  = fakeInventory();
    const svc  = new BillingService(repo as any, inv as any, fakePricing() as any, fakeRedis() as any, fakePool());

    await expect(
      svc.createInvoice(
        { customerName: 'X', lines: [{ description: 'x', makingChargePct: '12.00', stoneChargesPaise: '0', hallmarkFeePaise: '0' } as any] },
        '',
      ),
    ).rejects.toMatchObject({
      response: { code: 'invoice.idempotency_key_required' },
    });
  });
});
