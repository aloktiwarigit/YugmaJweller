/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { TryAtHomeBookingsService } from './try-at-home-bookings.service';

// ── constants ──────────────────────────────────────────────────────────────
const SHOP      = '0a1b2c3d-4e5f-4000-8000-000000000001';
const USER      = '11111111-2222-4000-8000-000000000002';
const CUSTOMER  = '22222222-3333-4000-8000-000000000003';
const PROD_A    = 'aaaaaaaa-0000-4000-8000-000000000001';
const PROD_B    = 'bbbbbbbb-0000-4000-8000-000000000002';
const PROD_C    = 'cccccccc-0000-4000-8000-000000000003';
const BOOKING_ID = 'dddddddd-0000-4000-8000-000000000004';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

// ── helpers ────────────────────────────────────────────────────────────────
function fakePool() {
  const poolClient = {
    query:   vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  };
  return {
    connect: vi.fn(async () => poolClient),
    query:   vi.fn(async () => ({ rows: [] })),
  } as unknown as import('pg').Pool;
}

function fakeSettings({ enabled = true, maxPieces = 3 } = {}) {
  return { getTryAtHome: vi.fn(async () => ({ enabled, maxPieces })) };
}

function fakeInventory(products: Record<string, { status: string; sku: string; metal: string; purity: string }> = {}) {
  return {
    getProduct: vi.fn(async (id: string) => {
      const p = products[id];
      if (!p) throw new Error(`product not found: ${id}`);
      return { id, shopId: SHOP, sku: p.sku, metal: p.metal, purity: p.purity, status: p.status } as any;
    }),
    updateStatus: vi.fn(async (id: string, dto: { status: string }) => ({ id, status: dto.status })),
  };
}

function fakeBilling() {
  return {
    createInvoice: vi.fn(async () => ({ id: 'invoice-001', status: 'DRAFT' })),
  };
}

function fakeRepo(overrides: Partial<{
  insert:             (...args: any[]) => Promise<any>;
  findById:           (id: string) => Promise<any>;
  lockForUpdate:      (client: any, id: string) => Promise<any>;
  updateStatusDispatch: (...args: any[]) => Promise<any>;
  updateStatusReturn: (...args: any[]) => Promise<any>;
  list:               (...args: any[]) => Promise<any>;
}> = {}) {
  const booking = {
    id:           BOOKING_ID,
    shop_id:      SHOP,
    customer_id:  CUSTOMER,
    product_ids:  [PROD_A, PROD_B, PROD_C],
    status:       'REQUESTED',
    requested_at: new Date(),
    dispatch_at:  null,
    return_due_at: null,
    notes:        null,
  };
  return {
    insert:               overrides.insert ?? vi.fn(async () => ({ ...booking, product_ids: [PROD_A, PROD_B, PROD_C] })),
    findById:             overrides.findById ?? vi.fn(async () => booking),
    lockForUpdate:        overrides.lockForUpdate ?? vi.fn(async () => booking),
    updateStatusDispatch: overrides.updateStatusDispatch ?? vi.fn(async () => ({ ...booking, status: 'DISPATCHED', dispatch_at: new Date() })),
    updateStatusReturn:   overrides.updateStatusReturn ?? vi.fn(async (_c, _id, remaining, status) => ({ ...booking, product_ids: remaining, status })),
    list:                 overrides.list ?? vi.fn(async () => ({ rows: [booking], total: 1 })),
    getPool:              vi.fn(() => ({ query: vi.fn(async () => ({ rows: [] })) })),
  } as any;
}

function buildSvc(opts: {
  settings?: ReturnType<typeof fakeSettings>;
  inventory?: ReturnType<typeof fakeInventory>;
  billing?:  ReturnType<typeof fakeBilling>;
  repo?:     ReturnType<typeof fakeRepo>;
  pool?:     any;
} = {}) {
  const pool     = opts.pool     ?? fakePool();
  const repo     = opts.repo     ?? fakeRepo();
  const inventory = opts.inventory ?? fakeInventory({
    [PROD_A]: { status: 'IN_STOCK', sku: 'SKU-A', metal: 'GOLD', purity: 'GOLD_22K' },
    [PROD_B]: { status: 'IN_STOCK', sku: 'SKU-B', metal: 'GOLD', purity: 'GOLD_22K' },
    [PROD_C]: { status: 'IN_STOCK', sku: 'SKU-C', metal: 'GOLD', purity: 'GOLD_22K' },
  });
  const billing   = opts.billing  ?? fakeBilling();
  const settings  = opts.settings ?? fakeSettings();

  return new TryAtHomeBookingsService(pool as any, repo, inventory as any, billing as any, settings as any);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('TryAtHomeBookingsService.createBooking — piece count limit', () => {
  it('rejects when feature is disabled', async () => {
    const svc = buildSvc({ settings: fakeSettings({ enabled: false }) });
    await expect(svc.createBooking({ customerId: CUSTOMER, productIds: [PROD_A] }))
      .rejects.toMatchObject({ response: { code: 'try_at_home.feature_disabled' } });
  });

  it('rejects when productIds count exceeds maxPieces', async () => {
    const svc = buildSvc({ settings: fakeSettings({ enabled: true, maxPieces: 2 }) });
    await expect(
      svc.createBooking({ customerId: CUSTOMER, productIds: [PROD_A, PROD_B, PROD_C] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows booking exactly at the limit', async () => {
    const svc = buildSvc({ settings: fakeSettings({ enabled: true, maxPieces: 3 }) });
    const result = await svc.createBooking({ customerId: CUSTOMER, productIds: [PROD_A, PROD_B, PROD_C] });
    expect(result.productIds).toHaveLength(3);
  });

  it('rejects product that is not IN_STOCK', async () => {
    const inventory = fakeInventory({
      [PROD_A]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-A', metal: 'GOLD', purity: 'GOLD_22K' },
    });
    const svc = buildSvc({ inventory });
    await expect(svc.createBooking({ customerId: CUSTOMER, productIds: [PROD_A] }))
      .rejects.toMatchObject({ response: { code: 'try_at_home.product_not_available' } });
  });

  it('rejects empty productIds', async () => {
    const svc = buildSvc();
    await expect(svc.createBooking({ customerId: CUSTOMER, productIds: [] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TryAtHomeBookingsService.dispatchBooking — sets product status to IN_TRY_AT_HOME', () => {
  it('transitions each product to IN_TRY_AT_HOME via InventoryService', async () => {
    const inventory = fakeInventory({
      [PROD_A]: { status: 'IN_STOCK', sku: 'SKU-A', metal: 'GOLD', purity: 'GOLD_22K' },
      [PROD_B]: { status: 'IN_STOCK', sku: 'SKU-B', metal: 'GOLD', purity: 'GOLD_22K' },
      [PROD_C]: { status: 'IN_STOCK', sku: 'SKU-C', metal: 'GOLD', purity: 'GOLD_22K' },
    });
    const svc = buildSvc({ inventory });

    await svc.dispatchBooking(BOOKING_ID);

    expect(inventory.updateStatus).toHaveBeenCalledTimes(3);
    expect(inventory.updateStatus).toHaveBeenCalledWith(PROD_A, { status: 'IN_TRY_AT_HOME' });
    expect(inventory.updateStatus).toHaveBeenCalledWith(PROD_B, { status: 'IN_TRY_AT_HOME' });
    expect(inventory.updateStatus).toHaveBeenCalledWith(PROD_C, { status: 'IN_TRY_AT_HOME' });
  });

  it('rejects dispatch when booking status is not REQUESTED', async () => {
    const repo = fakeRepo({
      lockForUpdate: vi.fn(async () => ({
        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
        product_ids: [PROD_A], status: 'DISPATCHED',
        requested_at: new Date(), dispatch_at: null, return_due_at: null, notes: null,
      })),
    });
    const svc = buildSvc({ repo });
    await expect(svc.dispatchBooking(BOOKING_ID))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('TryAtHomeBookingsService.recordReturn — creates invoice for kept pieces', () => {
  it('creates invoice only for kept products, reverts returned products to IN_STOCK', async () => {
    const dispatchedBooking = {
      id:           BOOKING_ID,
      shop_id:      SHOP,
      customer_id:  CUSTOMER,
      product_ids:  [PROD_A, PROD_B, PROD_C],
      status:       'DISPATCHED',
      requested_at: new Date(),
      dispatch_at:  new Date(),
      return_due_at: null,
      notes:        null,
    };
    const repo = fakeRepo({
      lockForUpdate: vi.fn(async () => dispatchedBooking),
      updateStatusReturn: vi.fn(async (_c, _id, remaining, status) => ({
        ...dispatchedBooking, product_ids: remaining, status,
      })),
    });
    const inventory = fakeInventory({
      [PROD_A]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-A', metal: 'GOLD', purity: 'GOLD_22K' },
      [PROD_B]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-B', metal: 'GOLD', purity: 'GOLD_22K' },
      [PROD_C]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-C', metal: 'GOLD', purity: 'GOLD_22K' },
    });
    const billing = fakeBilling();
    const svc = buildSvc({ repo, inventory, billing });

    const result = await svc.recordReturn(BOOKING_ID, {
      returnedProductIds: [PROD_B, PROD_C],
      keptProductIds:     [PROD_A],
      keptCustomerName:   'राम लाल',
    });

    // Returned products go back to IN_STOCK
    expect(inventory.updateStatus).toHaveBeenCalledWith(PROD_B, { status: 'IN_STOCK' });
    expect(inventory.updateStatus).toHaveBeenCalledWith(PROD_C, { status: 'IN_STOCK' });

    // Invoice created once for kept product
    expect(billing.createInvoice).toHaveBeenCalledOnce();
    const [invoiceDto] = billing.createInvoice.mock.calls[0] as unknown as [any, string];
    expect(invoiceDto.lines).toHaveLength(1);
    expect(invoiceDto.lines[0]!.productId).toBe(PROD_A);
    expect(invoiceDto.customerId).toBe(CUSTOMER);

    // Response includes invoiceId
    expect(result.invoiceId).toBeDefined();
    expect(result.status).toBe('CONVERTED_TO_SALE');
  });

  it('does NOT create invoice when all products are returned', async () => {
    const dispatchedBooking = {
      id:           BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
      product_ids:  [PROD_A, PROD_B], status: 'DISPATCHED',
      requested_at: new Date(), dispatch_at: new Date(), return_due_at: null, notes: null,
    };
    const repo = fakeRepo({ lockForUpdate: vi.fn(async () => dispatchedBooking) });
    const billing = fakeBilling();
    const inventory = fakeInventory({
      [PROD_A]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-A', metal: 'GOLD', purity: 'GOLD_22K' },
      [PROD_B]: { status: 'IN_TRY_AT_HOME', sku: 'SKU-B', metal: 'GOLD', purity: 'GOLD_22K' },
    });
    const svc = buildSvc({ repo, billing, inventory });

    const result = await svc.recordReturn(BOOKING_ID, {
      returnedProductIds: [PROD_A, PROD_B],
      keptProductIds:     [],
    });

    expect(billing.createInvoice).not.toHaveBeenCalled();
    expect(result.status).toBe('RETURNED');
    expect(result.invoiceId).toBeUndefined();
  });

  it('rejects when product is not in the booking', async () => {
    const dispatchedBooking = {
      id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
      product_ids: [PROD_A], status: 'DISPATCHED',
      requested_at: new Date(), dispatch_at: new Date(), return_due_at: null, notes: null,
    };
    const repo = fakeRepo({ lockForUpdate: vi.fn(async () => dispatchedBooking) });
    const svc = buildSvc({ repo });

    await expect(svc.recordReturn(BOOKING_ID, {
      returnedProductIds: [PROD_B], // PROD_B is not in booking
      keptProductIds:     [],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
