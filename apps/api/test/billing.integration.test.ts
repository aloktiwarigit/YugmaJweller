/**
 * Story 5.1 — Billing integration test.
 *
 * Instantiates BillingService + dependencies directly (no NestJS bootstrap) against
 * a real Postgres testcontainer + ioredis-mock. Auth context is injected via
 * tenantContext.runWith(), which is the same pattern used by stock-movements,
 * dead-stock, and search integration tests.
 *
 * Paise-exact test approach: the GOLD_22K rate is pre-seeded into the ioredis-mock
 * `rates:current` cache at 684200 paise/g before the test runs. PricingService reads
 * from Redis on cache-hit, so the value is deterministic without a live IBJA call.
 * Expected paise breakdown for 10g 22K @ 684200 paise/g, making 12%, no stones:
 *   goldValue        = 684200 × 10   = 6,842,000
 *   makingCharge     = 6,842,000 × 12/100 floor = 821,040
 *   gstMetal         = 6,842,000 × 3/100  floor = 205,260
 *   gstMaking        = 821,040  × 5/100   floor =  41,052
 *   lineTotal        = 6,842,000 + 821,040 + 205,260 + 41,052 = 7,909,352
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import IoredisMock from 'ioredis-mock';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SyncLogger } from '@goldsmith/sync';
import { StubStorageAdapter } from '@goldsmith/integrations-storage';
import {
  FallbackChain,
  IbjaAdapter,
  MetalsDevAdapter,
  CircuitBreaker,
  LastKnownGoodCache,
} from '@goldsmith/rates';
import { ComplianceHardBlockError } from '@goldsmith/compliance';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository';
import { InventoryService }    from '../src/modules/inventory/inventory.service';
import { PricingService }      from '../src/modules/pricing/pricing.service';
import { BillingRepository }   from '../src/modules/billing/billing.repository';
import { BillingService }      from '../src/modules/billing/billing.service';
import { VoidService }         from '../src/modules/billing/void.service';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const SHOP_A = 'eeeeeeee-eeee-4444-eeee-aaaaaaaaaaaa';
const SHOP_B = 'ffffffff-ffff-4444-ffff-bbbbbbbbbbbb';
const USER_A = '11111111-0000-4444-0000-000000000001';
const USER_B = '22222222-0000-4444-0000-000000000002';

const tenantA: Tenant = { id: SHOP_A, slug: 'billing-shop-a', display_name: 'Billing Shop A', status: 'ACTIVE' };
const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A, tenant: tenantA, authenticated: true,
  userId: USER_A, role: 'shop_admin',
};

const tenantB: Tenant = { id: SHOP_B, slug: 'billing-shop-b', display_name: 'Billing Shop B', status: 'ACTIVE' };
const ctxB: AuthenticatedTenantContext = {
  shopId: SHOP_B, tenant: tenantB, authenticated: true,
  userId: USER_B, role: 'shop_admin',
};

// ────────────────────────────────────────────────────────────────────────────
// Shared infrastructure
// ────────────────────────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool: Pool;
let sharedRedis: InstanceType<typeof IoredisMock>;
let svcA: BillingService;
let svcB: BillingService;

/** Seed a product row and return its id. Pass huid to make it hallmarked. */
async function seedProduct(opts: {
  ctx: AuthenticatedTenantContext;
  shopId: string;
  sku: string;
  huid?: string;
  purity?: string;
  netWeightG?: string;
}): Promise<string> {
  return tenantContext.runWith(opts.ctx, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            huid, status, created_by_user_id)
         VALUES ($1, $2, 'GOLD', $3, '11.0000', $4, '0.0000', $5, 'IN_STOCK', $6)
         RETURNING id`,
        [
          opts.shopId,
          opts.sku,
          opts.purity ?? '22K',
          opts.netWeightG ?? '10.0000',
          opts.huid ?? null,
          opts.ctx.userId,
        ],
      );
      return r.rows[0]!.id;
    }),
  );
}

/** Build a BillingService wired to the shared pool + Redis for a given shop context. */
function buildBillingService(): BillingService {
  const syncLogger = new SyncLogger();
  const storage    = new StubStorageAdapter();

  const invRepo = new InventoryRepository(pool as never, syncLogger);
  const invSvc  = new InventoryService(invRepo, storage, pool as never);

  const redis     = sharedRedis;
  const lkg       = new LastKnownGoodCache(redis as never);
  const ibjaCb    = new CircuitBreaker(new IbjaAdapter(), redis as never);
  const metalsdevCb = new CircuitBreaker(new MetalsDevAdapter(), redis as never);
  const chain     = new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
  const pricingSvc = new PricingService(pool as never, chain, redis as never);

  const billingRepo = new BillingRepository(pool as never);
  return new BillingService(
    billingRepo,
    invSvc,
    pricingSvc,
    redis as never,      // BILLING_REDIS
    pool as never,       // PG_POOL
    undefined as never,  // KMS_ADAPTER — not used in these tests
    undefined as never,  // SettingsCache — all tests pass makingChargePct explicitly
    undefined as never,  // SettingsRepository — see above
  );
}

beforeAll(async () => {
  container   = await new PostgreSqlContainer('postgres:15.6').start();
  pool        = createPool({ connectionString: container.getConnectionUri() });
  sharedRedis = new IoredisMock();

  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed both shops
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
         ($1, 'billing-shop-a', 'Billing Shop A', 'ACTIVE'),
         ($2, 'billing-shop-b', 'Billing Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally { c.release(); }

  // Pre-seed Redis rates cache for deterministic paise-exact test.
  // GOLD_22K = 684200 paise/g (₹6,842/g). All other purities seeded to avoid
  // cache-miss fallback to the live FallbackChain stub (returns 735000n).
  const now = new Date().toISOString();
  const ratesPayload = JSON.stringify({
    GOLD_24K:   { perGramPaise: '745000', fetchedAt: now },
    GOLD_22K:   { perGramPaise: '684200', fetchedAt: now },
    GOLD_20K:   { perGramPaise: '621000', fetchedAt: now },
    GOLD_18K:   { perGramPaise: '558750', fetchedAt: now },
    GOLD_14K:   { perGramPaise: '435000', fetchedAt: now },
    SILVER_999: { perGramPaise: '9500',   fetchedAt: now },
    SILVER_925: { perGramPaise: '8788',   fetchedAt: now },
    stale: false,
    source: 'ibja',
  });
  await sharedRedis.setex('rates:current', 900, ratesPayload);

  svcA = buildBillingService();
  svcB = buildBillingService();
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Unique idempotency key per test to prevent cross-test interference. */
let keyCounter = 0;
function newKey(): string {
  return `test-idem-${++keyCounter}-${Date.now()}`;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/v1/billing/invoices — service-level integration tests
// ────────────────────────────────────────────────────────────────────────────

describe('BillingService.createInvoice', () => {
  // ── Happy path ──────────────────────────────────────────────────────────
  it('happy path — hallmarked product + valid HUID → invoice created with correct shape', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku: 'BILL-HAPPY-001',
      huid: 'AB12CD',
      purity: '22K',
      netWeightG: '10.0000',
    });

    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'राहुल शर्मा',
      customerPhone: undefined,
      lines: [{
        productId,
        description:      'Gold ring 22K hallmarked',
        huid:             'AB12CD',
        makingChargePct:  '12.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    const result = await tenantContext.runWith(ctxA, () =>
      svcA.createInvoice(dto, newKey()),
    );

    // Shape assertions
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.shopId).toBe(SHOP_A);
    expect(result.invoiceNumber).toMatch(/^GS-[A-Z0-9]{6}-\d{8}-[A-Z0-9]{6}$/);
    expect(result.invoiceType).toBe('B2C');
    expect(result.customerId).toBeNull();  // Epic 6 will add customers
    expect(result.customerName).toBe('राहुल शर्मा');
    expect(result.status).toBe('ISSUED');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.huid).toBe('AB12CD');
    expect(result.lines[0]!.productId).toBe(productId);

    // Paise values must be non-empty strings (BigInt-serialised)
    expect(result.totalPaise).toMatch(/^\d+$/);
    expect(Number(result.totalPaise)).toBeGreaterThan(0);

    // Line total = goldValue + making + gstMetal + gstMaking (no stone, no hallmark)
    const line = result.lines[0]!;
    const goldValue  = BigInt(line.goldValuePaise);
    const making     = BigInt(line.makingChargePaise);
    const gstMetal   = BigInt(line.gstMetalPaise);
    const gstMaking  = BigInt(line.gstMakingPaise);
    const stone      = BigInt(line.stoneChargesPaise);
    const hallmark   = BigInt(line.hallmarkFeePaise);
    const lineTotal  = BigInt(line.lineTotalPaise);
    expect(lineTotal).toBe(goldValue + making + stone + gstMetal + gstMaking + hallmark);
  });

  // ── Idempotent retry ────────────────────────────────────────────────────
  it('idempotent retry — same idempotency key returns the SAME invoice id', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku: 'BILL-IDEM-001',
    });

    const key = newKey();
    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'Idempotency Test Customer',
      lines: [{
        productId,
        description:      'Test ring',
        makingChargePct:  '10.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    const first  = await tenantContext.runWith(ctxA, () => svcA.createInvoice(dto, key));
    const second = await tenantContext.runWith(ctxA, () => svcA.createInvoice(dto, key));

    expect(second.id).toBe(first.id);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(second.totalPaise).toBe(first.totalPaise);
  });

  // ── HUID hard-block ─────────────────────────────────────────────────────
  it('HUID hard-block — hallmarked product with missing HUID on line → compliance.huid_missing', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku: 'BILL-HUID-BLOCK-001',
      huid: 'ZZ9999',  // product is hallmarked on record
    });

    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'HUID Block Customer',
      lines: [{
        productId,
        description:      'Hallmarked ring — missing huid on request',
        // huid intentionally omitted
        makingChargePct:  '12.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    let caught: unknown;
    try {
      await tenantContext.runWith(ctxA, () => svcA.createInvoice(dto, newKey()));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ComplianceHardBlockError);
    const block = caught as ComplianceHardBlockError;
    expect(block.code).toBe('compliance.huid_missing');
    expect((block.meta as { lineIndex: number }).lineIndex).toBe(0);
  });

  // ── Missing Idempotency-Key ─────────────────────────────────────────────
  it('missing idempotency key → BadRequestException invoice.idempotency_key_required', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku: 'BILL-NOIDKEY-001',
    });

    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'No Key Customer',
      lines: [{
        productId,
        description:      'Test product',
        makingChargePct:  '10.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    await expect(
      tenantContext.runWith(ctxA, () => svcA.createInvoice(dto, '')),
    ).rejects.toMatchObject({
      response: { code: 'invoice.idempotency_key_required' },
    });
  });

  // ── Tenant isolation: GET /:id ─────────────────────────────────────────
  it('tenant B cannot read tenant A invoices via getInvoice (returns null → NotFoundException)', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku: 'BILL-ISOL-001',
    });

    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'Shop A Customer',
      lines: [{
        productId,
        description:      'Shop A product',
        makingChargePct:  '10.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    const invoiceA = await tenantContext.runWith(ctxA, () =>
      svcA.createInvoice(dto, newKey()),
    );

    // Tenant B attempts to read tenant A's invoice — RLS must hide it → NotFoundException
    await expect(
      tenantContext.runWith(ctxB, () => svcB.getInvoice(invoiceA.id)),
    ).rejects.toMatchObject({
      response: { code: 'invoice.not_found' },
    });
  });

  // ── List scoping ────────────────────────────────────────────────────────
  it('GET list is tenant-scoped: each tenant sees only their own invoices', async () => {
    const productIdA = await seedProduct({
      ctx: ctxA, shopId: SHOP_A, sku: 'BILL-LIST-A-001',
    });
    const productIdB = await seedProduct({
      ctx: ctxB, shopId: SHOP_B, sku: 'BILL-LIST-B-001',
    });

    // Create one invoice for each tenant
    await tenantContext.runWith(ctxA, () =>
      svcA.createInvoice({
        invoiceType: 'B2C',
        customerName: 'List Customer A',
        lines: [{
          productId:        productIdA,
          description:      'List test A',
          makingChargePct:  '10.00',
          stoneChargesPaise: '0',
          hallmarkFeePaise:  '0',
        }],
      }, newKey()),
    );

    await tenantContext.runWith(ctxB, () =>
      svcB.createInvoice({
        invoiceType: 'B2C',
        customerName: 'List Customer B',
        lines: [{
          productId:        productIdB,
          description:      'List test B',
          makingChargePct:  '10.00',
          stoneChargesPaise: '0',
          hallmarkFeePaise:  '0',
        }],
      }, newKey()),
    );

    const listA = await tenantContext.runWith(ctxA, () => svcA.listInvoices());
    const listB = await tenantContext.runWith(ctxB, () => svcB.listInvoices());

    // Every invoice in list A must belong to shop A
    for (const inv of listA) {
      expect(inv.shopId).toBe(SHOP_A);
    }
    // Every invoice in list B must belong to shop B
    for (const inv of listB) {
      expect(inv.shopId).toBe(SHOP_B);
    }

    // They must be disjoint (no shared invoice ids)
    const idsA = new Set(listA.map((i) => i.id));
    const idsB = new Set(listB.map((i) => i.id));
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });

  // ── Paise-exact ─────────────────────────────────────────────────────────
  // Rate: GOLD_22K = 684200 paise/g (pre-seeded in Redis, deterministic)
  // 10g 22K × 684200 = 6,842,000  (goldValue)
  // making 12%:        6,842,000 × 12/100 = 821,040  (floor)
  // gstMetal 3%:       6,842,000 × 3/100  = 205,260  (floor)
  // gstMaking 5%:        821,040 × 5/100  =  41,052  (floor)
  // lineTotal:         6,842,000 + 821,040 + 205,260 + 41,052 = 7,909,352
  it('paise-exact: 10g 22K @ 684200p/g, making 12%, no stones, no hallmark fee → lineTotal 7,909,352', async () => {
    const productId = await seedProduct({
      ctx: ctxA, shopId: SHOP_A,
      sku:        'BILL-PAISE-001',
      purity:     '22K',
      netWeightG: '10.0000',
    });

    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'Paise Test Customer',
      lines: [{
        productId,
        description:       '22K gold ring 10g',
        makingChargePct:   '12.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
      }],
    };

    const result = await tenantContext.runWith(ctxA, () =>
      svcA.createInvoice(dto, newKey()),
    );

    const line = result.lines[0]!;

    // Structural formula assertions
    const goldValue  = BigInt(line.goldValuePaise);
    const making     = BigInt(line.makingChargePaise);
    const gstMetal   = BigInt(line.gstMetalPaise);
    const gstMaking  = BigInt(line.gstMakingPaise);
    const lineTotal  = BigInt(line.lineTotalPaise);

    // goldValue = rate × weight (floor) = 684200 × 10 = 6,842,000
    expect(goldValue).toBe(6_842_000n);
    // making = goldValue × 12/100 (floor) = 6842000 × 0.12 = 821040
    expect(making).toBe(821_040n);
    // gstMetal = goldValue × 3/100 (integer division = floor) = 205260
    expect(gstMetal).toBe(205_260n);
    // gstMaking = making × 5/100 (integer division = floor) = 41052
    expect(gstMaking).toBe(41_052n);
    // lineTotal = sum of all parts
    expect(lineTotal).toBe(7_909_352n);

    // Invariant: lineTotal === goldValue + making + gstMetal + gstMaking + 0 + 0
    expect(lineTotal).toBe(goldValue + making + gstMetal + gstMaking);

    // Invoice-level total must match line total (single-line invoice)
    expect(BigInt(result.totalPaise)).toBe(lineTotal);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Story 5.11 — Void + Credit Note integration tests
// ────────────────────────────────────────────────────────────────────────────

describe('VoidService — invoice void + credit note (integration)', () => {
  let voidSvcA: VoidService;

  const ctxOwnerA: AuthenticatedTenantContext = {
    shopId: SHOP_A, tenant: tenantA, authenticated: true,
    userId: USER_A, role: 'shop_admin',
  };
  const ctxManagerA: AuthenticatedTenantContext = {
    shopId: SHOP_A, tenant: tenantA, authenticated: true,
    userId: '33333333-0000-4444-0000-000000000003', role: 'shop_manager',
  };

  // Helper: create an invoice for SHOP_A and return its id
  async function createTestInvoice(productId: string, key?: string): Promise<string> {
    const dto = {
      invoiceType: 'B2C' as const,
      customerName: 'Void Test Customer',
      lines: [{
        productId,
        description: 'Gold ring',
        metalType: 'GOLD' as const,
        purity: '22K',
        netWeightG: '10.0000',
        makingChargePct: '12.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise: '0',
      }],
    };
    const inv = await tenantContext.runWith(ctxOwnerA, () => svcA.createInvoice(dto, key ?? newKey()));
    return inv.id;
  }

  beforeAll(() => {
    voidSvcA = new VoidService(pool as never);
  });

  it('voids invoice within 24h — status becomes VOIDED, product quantity restored', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `void-${newKey()}`, purity: '22K', netWeightG: '10.0000' });
    const invoiceId = await createTestInvoice(productId);

    // Verify product quantity decremented to 0 after invoice creation
    const before = await withTenantTx(pool, (tx) =>
      tx.query<{ quantity: number; status: string }>(`SELECT quantity, status FROM products WHERE id = $1`, [productId])
        .then((r) => r.rows[0]!),
    );
    expect(before.quantity).toBe(0);
    expect(before.status).toBe('SOLD');

    // Void within 24h
    const voided = await tenantContext.runWith(ctxOwnerA, () =>
      voidSvcA.voidInvoice({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'test void' }),
    );
    expect(voided.status).toBe('VOIDED');
    expect(voided.void_reason).toBe('test void');
    expect(voided.voided_by_user_id).toBe(USER_A);

    // Verify product quantity restored to 1, status back to IN_STOCK
    const after = await withTenantTx(pool, (tx) =>
      tx.query<{ quantity: number; status: string }>(`SELECT quantity, status FROM products WHERE id = $1`, [productId])
        .then((r) => r.rows[0]!),
    );
    expect(after.quantity).toBe(1);
    expect(after.status).toBe('IN_STOCK');

    // Verify stock movement ADJUSTMENT_IN was recorded
    const movements = await withTenantTx(pool, (tx) =>
      tx.query<{ type: string; reason: string }>(
        `SELECT type, reason FROM stock_movements WHERE product_id = $1 AND type = 'ADJUSTMENT_IN'`,
        [productId],
      ).then((r) => r.rows),
    );
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0]!.reason).toContain(invoiceId);
  });

  it('void after 24h window returns 422 window_expired', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `void-expired-${newKey()}` });
    const invoiceId = await createTestInvoice(productId);

    // Backdate the invoice issued_at to 25h ago to simulate expired window
    await withTenantTx(pool, (tx) =>
      tx.query(
        `UPDATE invoices SET issued_at = now() - interval '25 hours' WHERE id = $1`,
        [invoiceId],
      ),
    );

    try {
      await tenantContext.runWith(ctxOwnerA, () =>
        voidSvcA.voidInvoice({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'late void' }),
      );
      expect.fail('should have thrown');
    } catch (e: unknown) {
      const body = (e as { getResponse?: () => Record<string, unknown> }).getResponse?.();
      expect(body?.code).toBe('billing.void.window_expired');
    }
  });

  it('MANAGER cannot void invoice', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `void-mgr-${newKey()}` });
    const invoiceId = await createTestInvoice(productId);
    await expect(
      tenantContext.runWith(ctxOwnerA, () =>
        voidSvcA.voidInvoice(
          { userId: ctxManagerA.userId, role: 'shop_manager', shopId: SHOP_A },
          invoiceId,
          { reason: 'test' },
        ),
      ),
    ).rejects.toThrow(/* ForbiddenException */);
  });

  it('issues credit note for ISSUED invoice outside 24h window', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `cn-${newKey()}` });
    const invoiceId = await createTestInvoice(productId);

    // Backdate issued_at to 26h ago
    await withTenantTx(pool, (tx) =>
      tx.query(
        `UPDATE invoices SET issued_at = now() - interval '26 hours' WHERE id = $1`,
        [invoiceId],
      ),
    );

    const cn = await tenantContext.runWith(ctxOwnerA, () =>
      voidSvcA.issueCreditNote(
        { userId: USER_A, role: 'shop_admin', shopId: SHOP_A },
        invoiceId,
        { reason: 'customer return' },
      ),
    );
    expect(cn.credit_number).toMatch(/^CN-/);
    expect(cn.reason).toBe('customer return');
    expect(cn.original_invoice_id).toBe(invoiceId);
  });

  it('cannot issue duplicate credit note — 409 already_issued', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `cn-dup-${newKey()}` });
    const invoiceId = await createTestInvoice(productId);
    await withTenantTx(pool, (tx) =>
      tx.query(`UPDATE invoices SET issued_at = now() - interval '26 hours' WHERE id = $1`, [invoiceId]),
    );
    // First credit note
    await tenantContext.runWith(ctxOwnerA, () =>
      voidSvcA.issueCreditNote({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'first' }),
    );
    // Second credit note on same invoice
    try {
      await tenantContext.runWith(ctxOwnerA, () =>
        voidSvcA.issueCreditNote({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'second' }),
      );
      expect.fail('should have thrown');
    } catch (e: unknown) {
      const body = (e as { getResponse?: () => Record<string, unknown> }).getResponse?.();
      expect(body?.code).toBe('billing.credit_note.already_issued');
    }
  });

  // Tenant isolation: SHOP_B cannot void SHOP_A's invoice
  it('tenant isolation — cannot void another shop invoice (returns 404)', async () => {
    const productId = await seedProduct({ ctx: ctxOwnerA, shopId: SHOP_A, sku: `ti-${newKey()}` });
    const invoiceId = await createTestInvoice(productId);

    const ctxOwnerB: AuthenticatedTenantContext = {
      shopId: SHOP_B, tenant: tenantB, authenticated: true,
      userId: USER_B, role: 'shop_admin',
    };

    await expect(
      tenantContext.runWith(ctxOwnerB, () =>
        voidSvcA.voidInvoice({ userId: USER_B, role: 'shop_admin', shopId: SHOP_B }, invoiceId, { reason: 'cross-tenant' }),
      ),
    ).rejects.toThrow(/* NotFoundException — RLS hides cross-tenant rows */);
  });
});
