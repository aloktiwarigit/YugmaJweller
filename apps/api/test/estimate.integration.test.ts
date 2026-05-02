/**
 * Estimate-to-invoice smoke integration test (FR41 + FR42).
 *
 * Runs EstimateService + BillingService against a real Postgres testcontainer.
 * Verifies the golden path:
 *   POST /billing/estimates → estimate created, status='draft'
 *   POST /billing/estimates/:id/convert → invoice created, estimate status='converted',
 *     estimate.converted_invoice_id = invoice.id, totals match.
 *
 * Also verifies:
 *   - Cannot convert an already-converted estimate (estimate.already_converted)
 *   - Cannot convert an expired estimate (estimate.expired)
 *   - Expired-by-timestamp estimate rejected even when status='draft'
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import IoredisMock from 'ioredis-mock';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SyncLogger } from '@goldsmith/sync';
import {
  FallbackChain,
  IbjaAdapter,
  MetalsDevAdapter,
  CircuitBreaker,
  LastKnownGoodCache,
} from '@goldsmith/rates';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository';
import { InventoryService }    from '../src/modules/inventory/inventory.service';
import { PricingService }      from '../src/modules/pricing/pricing.service';
import { BillingRepository }   from '../src/modules/billing/billing.repository';
import { BillingService }      from '../src/modules/billing/billing.service';
import { EstimateService }     from '../src/modules/billing/estimate.service';

// ── Constants ────────────────────────────────────────────────────────────────

const SHOP = 'aaaabbbb-0000-4000-0000-000000000001';
const USER = '11110000-0000-4000-0000-000000000001';

const tenant: Tenant = { id: SHOP, slug: 'estimate-shop', display_name: 'Estimate Shop', status: 'ACTIVE' };
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP, tenant, authenticated: true,
  userId: USER, role: 'shop_admin',
};

// ── Shared infra ─────────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool:      Pool;
let redis:     InstanceType<typeof IoredisMock>;
let svc:       BillingService;
let estSvc:    EstimateService;

let keyCounter = 0;
function newKey(): string { return `est-idem-${++keyCounter}-${Date.now()}`; }

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool      = createPool({ connectionString: container.getConnectionUri() });
  redis     = new IoredisMock();

  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'estimate-shop', 'Estimate Shop', 'ACTIVE')`,
      [SHOP],
    );
  } finally { c.release(); }

  // Pre-seed rates cache (GOLD_22K = 684200 paise/g)
  const now = new Date().toISOString();
  await redis.setex('rates:current', 900, JSON.stringify({
    GOLD_24K:   { perGramPaise: '745000', fetchedAt: now },
    GOLD_22K:   { perGramPaise: '684200', fetchedAt: now },
    GOLD_20K:   { perGramPaise: '621000', fetchedAt: now },
    GOLD_18K:   { perGramPaise: '558750', fetchedAt: now },
    GOLD_14K:   { perGramPaise: '435000', fetchedAt: now },
    SILVER_999: { perGramPaise: '9500',   fetchedAt: now },
    SILVER_925: { perGramPaise: '8788',   fetchedAt: now },
    stale: false, source: 'ibja',
  }));

  estSvc = new EstimateService(pool as never);

  const invRepo  = new InventoryRepository(pool as never, new SyncLogger());
  const invSvc   = new InventoryService(invRepo, pool as never);
  const lkg      = new LastKnownGoodCache(redis as never);
  const chain    = new FallbackChain(
    new CircuitBreaker(new IbjaAdapter(), redis as never),
    new CircuitBreaker(new MetalsDevAdapter(), redis as never),
    lkg, console,
  );
  const pricingSvc  = new PricingService(pool as never, chain, redis as never);
  const billingRepo = new BillingRepository(pool as never);

  svc = new BillingService(
    billingRepo, invSvc, pricingSvc,
    redis as never, pool as never,
    undefined as never, undefined as never, undefined as never,
    undefined, undefined, estSvc,
  );
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EstimateService.createEstimate', () => {
  it('creates an estimate with status=draft and correct totals', async () => {
    // goldValue = 684200 × 10 = 6,842,000
    // making    = 684200 × 10 × 12/100 floor = 821,040
    // gstMetal  = 6,842,000 × 3/100 floor = 205,260
    // gstMaking = 821,040 × 5/100 floor   = 41,052
    // lineTotal = 7,909,352
    const estimate = await tenantContext.runWith(ctx, () =>
      estSvc.createEstimate({
        lineItems: [{
          description:       '22K Gold Necklace',
          hsnCode:           '7113',
          huid:              null,
          metalType:         'GOLD',
          purity:            '22K',
          netWeightG:        '10.0000',
          ratePerGramPaise:  '684200',
          makingChargePct:   '12.00',
          goldValuePaise:    '6842000',
          makingChargePaise: '821040',
          stoneChargesPaise: '0',
          hallmarkFeePaise:  '0',
          gstMetalPaise:     '205260',
          gstMakingPaise:    '41052',
          lineTotalPaise:    '7909352',
          sortOrder:         0,
        }],
        goldRatePaisePerGram: 684200n,
        subtotalPaise:        7663040n,  // goldValue + making
        gstPaise:             246312n,   // gstMetal + gstMaking
        totalPaise:           7909352n,
      }),
    );

    expect(estimate.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(estimate.shopId).toBe(SHOP);
    expect(estimate.status).toBe('draft');
    expect(estimate.totalPaise).toBe('7909352');
    expect(estimate.subtotalPaise).toBe('7663040');
    expect(estimate.gstPaise).toBe('246312');
    expect(estimate.goldRatePaisePerGram).toBe('684200');
    expect(estimate.convertedInvoiceId).toBeNull();
  });
});

describe('BillingService.convertEstimateToInvoice', () => {
  it('golden path — estimate converted to invoice, estimate status=converted, IDs match', async () => {
    // Create estimate
    const estimate = await tenantContext.runWith(ctx, () =>
      estSvc.createEstimate({
        lineItems: [{
          description:       '22K Gold Ring',
          hsnCode:           '7113',
          huid:              null,
          metalType:         'GOLD',
          purity:            '22K',
          netWeightG:        '5.0000',
          ratePerGramPaise:  '684200',
          makingChargePct:   '12.00',
          goldValuePaise:    '3421000',
          makingChargePaise: '410520',
          stoneChargesPaise: '0',
          hallmarkFeePaise:  '0',
          gstMetalPaise:     '102630',
          gstMakingPaise:    '20526',
          lineTotalPaise:    '3954676',
          sortOrder:         0,
        }],
        goldRatePaisePerGram: 684200n,
        subtotalPaise:        3831520n,
        gstPaise:             123156n,
        totalPaise:           3954676n,
      }),
    );

    expect(estimate.status).toBe('draft');

    // Convert to invoice
    const invoice = await tenantContext.runWith(ctx, () =>
      svc.convertEstimateToInvoice(estimate.id, newKey()),
    );

    // Invoice assertions
    expect(invoice.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(invoice.shopId).toBe(SHOP);
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.subtotalPaise).toBe('3831520');
    // TCS should be 0 for totals < Rs 2,00,000 (3954676 paise = ~₹39,547)
    expect(invoice.tcsCollectedPaise).toBe('0');
    expect(invoice.lines.length).toBe(1);
    expect(invoice.lines[0]!.description).toBe('22K Gold Ring');

    // Verify estimate now has status='converted' and points to the invoice
    const updatedEstimate = await tenantContext.runWith(ctx, () =>
      estSvc.getEstimate(estimate.id, SHOP),
    );
    expect(updatedEstimate.status).toBe('converted');
    expect(updatedEstimate.convertedInvoiceId).toBe(invoice.id);
  });

  it('blocks second conversion attempt with estimate.already_converted', async () => {
    const estimate = await tenantContext.runWith(ctx, () =>
      estSvc.createEstimate({
        lineItems: [{
          description: 'Silver Chain', hsnCode: '7113', huid: null,
          metalType: 'SILVER', purity: '999', netWeightG: '20.0000',
          ratePerGramPaise: '9500', makingChargePct: '8.00',
          goldValuePaise: '190000', makingChargePaise: '15200',
          stoneChargesPaise: '0', hallmarkFeePaise: '0',
          gstMetalPaise: '5700', gstMakingPaise: '760',
          lineTotalPaise: '211660', sortOrder: 0,
        }],
        goldRatePaisePerGram: 9500n,
        subtotalPaise:        205200n,
        gstPaise:             6460n,
        totalPaise:           211660n,
      }),
    );

    const key1 = newKey();
    await tenantContext.runWith(ctx, () =>
      svc.convertEstimateToInvoice(estimate.id, key1),
    );

    // Second conversion attempt must fail
    await expect(
      tenantContext.runWith(ctx, () =>
        svc.convertEstimateToInvoice(estimate.id, newKey()),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects conversion of an estimate expired by status', async () => {
    const estimate = await tenantContext.runWith(ctx, () =>
      estSvc.createEstimate({
        lineItems: [{
          description: 'Gold Earrings', hsnCode: '7113', huid: null,
          metalType: 'GOLD', purity: '18K', netWeightG: '3.0000',
          ratePerGramPaise: '558750', makingChargePct: '14.00',
          goldValuePaise: '1676250', makingChargePaise: '234675',
          stoneChargesPaise: '0', hallmarkFeePaise: '0',
          gstMetalPaise: '50288', gstMakingPaise: '11734',
          lineTotalPaise: '1972947', sortOrder: 0,
        }],
        goldRatePaisePerGram: 558750n,
        subtotalPaise:        1910925n,
        gstPaise:             62022n,
        totalPaise:           1972947n,
      }),
    );

    // Manually expire the estimate
    await tenantContext.runWith(ctx, () =>
      estSvc.expireEstimate(estimate.id, SHOP),
    );

    await expect(
      tenantContext.runWith(ctx, () =>
        svc.convertEstimateToInvoice(estimate.id, newKey()),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects conversion of estimate past its expiresAt timestamp (P2 — clock check)', async () => {
    const estimate = await tenantContext.runWith(ctx, () =>
      estSvc.createEstimate({
        lineItems: [{
          description: 'Diamond Pendant', hsnCode: '7113', huid: null,
          metalType: 'GOLD', purity: '22K', netWeightG: '2.0000',
          ratePerGramPaise: '684200', makingChargePct: '12.00',
          goldValuePaise: '1368400', makingChargePaise: '164208',
          stoneChargesPaise: '50000', hallmarkFeePaise: '0',
          gstMetalPaise: '41052', gstMakingPaise: '8210',
          lineTotalPaise: '1631870', sortOrder: 0,
        }],
        goldRatePaisePerGram: 684200n,
        subtotalPaise:        1582608n,
        gstPaise:             49262n,
        totalPaise:           1631870n,
        expiresAt: new Date(Date.now() - 3_600_000), // 1 hour in the past
      }),
    );

    // Estimate status is still 'draft' but expiresAt is in the past
    const fetched = await tenantContext.runWith(ctx, () =>
      estSvc.getEstimate(estimate.id, SHOP),
    );
    expect(fetched.status).toBe('draft');

    await expect(
      tenantContext.runWith(ctx, () =>
        svc.convertEstimateToInvoice(estimate.id, newKey()),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('EstimateService CRUD', () => {
  it('listEstimates returns all estimates for the tenant', async () => {
    const list = await tenantContext.runWith(ctx, () =>
      estSvc.listEstimates(SHOP),
    );
    // We've created several estimates in prior tests — list should be non-empty
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(3);
    // All should belong to the test shop (RLS enforcement)
    list.forEach((e) => expect(e.shopId).toBe(SHOP));
  });

  it('getEstimate throws NotFoundException for unknown id', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(
      tenantContext.runWith(ctx, () =>
        estSvc.getEstimate('00000000-0000-0000-0000-000000000000', SHOP),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
