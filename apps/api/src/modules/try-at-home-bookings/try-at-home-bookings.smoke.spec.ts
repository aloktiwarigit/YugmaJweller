/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Smoke test: 3-piece booking → dispatch → record return (1 kept, 2 returned)
 * Verifies invoice created for 1 kept piece, 2 products revert to IN_STOCK,
 * booking status becomes CONVERTED_TO_SALE.
 */
import { describe, expect, it, vi } from 'vitest';
import { TryAtHomeBookingsService } from './try-at-home-bookings.service';

const SHOP     = '0a1b2c3d-4e5f-4000-8000-000000000001';
const USER     = '11111111-2222-4000-8000-000000000002';
const CUSTOMER = '22222222-3333-4000-8000-000000000003';
const PROD_A   = 'aaaaaaaa-0000-4000-8000-000000000001';
const PROD_B   = 'bbbbbbbb-0000-4000-8000-000000000002';
const PROD_C   = 'cccccccc-0000-4000-8000-000000000003';
const BOOKING_ID = 'dddddddd-0000-4000-8000-000000000004';
const INVOICE_ID = 'invoice-smoke-001';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

describe('Try-at-Home smoke: create → dispatch → return (1 kept, 2 returned)', () => {
  it('runs the full lifecycle correctly', async () => {
    // ── product state tracking ────────────────────────────────────────────
    const productStatuses: Record<string, string> = {
      [PROD_A]: 'IN_STOCK',
      [PROD_B]: 'IN_STOCK',
      [PROD_C]: 'IN_STOCK',
    };

    const inventory = {
      getProduct: vi.fn(async (id: string) => ({
        id, shopId: SHOP, sku: `SKU-${id.slice(0, 4)}`,
        metal: 'GOLD', purity: 'GOLD_22K',
        status: productStatuses[id] ?? 'IN_STOCK',
      })),
      updateStatus: vi.fn(async (id: string, dto: { status: string }) => {
        productStatuses[id] = dto.status;
        return { id, status: dto.status };
      }),
    };

    // ── booking state tracking ────────────────────────────────────────────
    let bookingStatus = 'REQUESTED';
    let bookingProductIds = [PROD_A, PROD_B, PROD_C];

    const poolClient = {
      query:   vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => poolClient),
      query:   vi.fn(async () => ({ rows: [] })),
    };

    const repo = {
      insert: vi.fn(async () => ({
        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
        product_ids: [PROD_A, PROD_B, PROD_C], status: 'REQUESTED',
        requested_at: new Date(), dispatch_at: null, return_due_at: null, notes: null,
      })),
      lockForUpdate: vi.fn(async () => ({
        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
        product_ids: bookingProductIds, status: bookingStatus,
        requested_at: new Date(), dispatch_at: null, return_due_at: null, notes: null,
      })),
      updateStatusDispatch: vi.fn(async () => {
        bookingStatus = 'DISPATCHED';
        return {
          id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
          product_ids: bookingProductIds, status: 'DISPATCHED',
          requested_at: new Date(), dispatch_at: new Date(), return_due_at: null, notes: null,
        };
      }),
      updateStatusReturn: vi.fn(async (_c: any, _id: string, remaining: string[], status: string) => {
        bookingProductIds = remaining;
        bookingStatus = status;
        return {
          id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
          product_ids: remaining, status,
          requested_at: new Date(), dispatch_at: new Date(), return_due_at: null, notes: null,
        };
      }),
      findById: vi.fn(async () => null),
      list:     vi.fn(async () => ({ rows: [], total: 0 })),
      getPool:  vi.fn(() => pool),
    } as any;

    const billing = {
      createInvoice: vi.fn(async () => ({ id: INVOICE_ID, status: 'DRAFT' })),
    };

    const settings = {
      getTryAtHome: vi.fn(async () => ({ enabled: true, maxPieces: 5 })),
    };

    const svc = new TryAtHomeBookingsService(
      pool as any, repo, inventory as any, billing as any, settings as any,
    );

    // ── Step 1: Create booking with 3 pieces ─────────────────────────────
    const booking = await svc.createBooking({
      customerId: CUSTOMER,
      productIds: [PROD_A, PROD_B, PROD_C],
    });
    expect(booking.status).toBe('REQUESTED');
    expect(booking.productIds).toHaveLength(3);

    // ── Step 2: Dispatch → products move to IN_TRY_AT_HOME ───────────────
    const dispatched = await svc.dispatchBooking(BOOKING_ID);
    expect(dispatched.status).toBe('DISPATCHED');

    expect(inventory.updateStatus).toHaveBeenCalledTimes(3);
    expect(productStatuses[PROD_A]).toBe('IN_TRY_AT_HOME');
    expect(productStatuses[PROD_B]).toBe('IN_TRY_AT_HOME');
    expect(productStatuses[PROD_C]).toBe('IN_TRY_AT_HOME');

    // ── Step 3: Record return — PROD_A kept, PROD_B+PROD_C returned ──────
    // lockForUpdate now returns DISPATCHED booking
    const result = await svc.recordReturn(BOOKING_ID, {
      returnedProductIds: [PROD_B, PROD_C],
      keptProductIds:     [PROD_A],
      keptCustomerName:   'राम लाल',
    });

    // Booking becomes CONVERTED_TO_SALE
    expect(result.status).toBe('CONVERTED_TO_SALE');

    // Invoice created for PROD_A only
    expect(billing.createInvoice).toHaveBeenCalledOnce();
    expect(result.invoiceId).toBe(INVOICE_ID);

    // PROD_B and PROD_C reverted to IN_STOCK
    expect(productStatuses[PROD_B]).toBe('IN_STOCK');
    expect(productStatuses[PROD_C]).toBe('IN_STOCK');

    // PROD_A still IN_TRY_AT_HOME (invoice covers the SOLD transition)
    expect(productStatuses[PROD_A]).toBe('IN_TRY_AT_HOME');

    // Invoice DTO has correct product and customer
    const [invoiceDto] = billing.createInvoice.mock.calls[0] as unknown as [any, string];
    expect(invoiceDto.customerId).toBe(CUSTOMER);
    expect(invoiceDto.lines).toHaveLength(1);
    expect(invoiceDto.lines[0]!.productId).toBe(PROD_A);
    expect(invoiceDto.customerName).toBe('राम लाल');
  });
});
