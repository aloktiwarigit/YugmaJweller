import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { ProductNotFoundForLock, BalanceDriftError } from './stock-movement.repository';

const SHOP_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '33333333-3333-3333-3333-333333333333';

const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_ID,
  tenant: { id: SHOP_ID, slug: 's', display_name: 'S', status: 'ACTIVE' },
  authenticated: true,
  userId: USER_ID,
} as never;

function makeRepo(initial: { quantity: number; status: string } | null) {
  return {
    getProductForRead: vi.fn().mockResolvedValue(
      initial ? { id: PRODUCT_ID, shop_id: SHOP_ID, quantity: initial.quantity, status: initial.status } : null,
    ),
    recordAtomic: vi.fn().mockImplementation(async (input: { quantityDelta: number; balanceBefore: number; balanceAfter: number; type: string; reason: string; sourceName: string | null; sourceId: string | null; recordedByUserId: string }) => ({
      id: 'm-1',
      shop_id: SHOP_ID,
      product_id: PRODUCT_ID,
      type: input.type,
      reason: input.reason,
      quantity_delta: input.quantityDelta,
      balance_before: input.balanceBefore,
      balance_after: input.balanceAfter,
      source_name: input.sourceName,
      source_id: input.sourceId,
      recorded_by_user_id: input.recordedByUserId,
      recorded_at: new Date('2026-04-25T00:00:00Z'),
    })),
    listMovements: vi.fn(),
  };
}

describe('StockMovementService.recordMovement', () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: StockMovementService;

  beforeEach(() => {
    repo = makeRepo({ quantity: 0, status: 'IN_STOCK' });
    svc = new StockMovementService(repo as never, {} as never);
  });

  it('PURCHASE happy path returns mapped response', async () => {
    const r = await tenantContext.runWith(ctx, () => svc.recordMovement({
      productId: PRODUCT_ID, type: 'PURCHASE', quantityDelta: 3, reason: 'restock',
    }));
    expect(r.balanceBefore).toBe(0);
    expect(r.balanceAfter).toBe(3);
    expect(r.type).toBe('PURCHASE');
    expect(repo.recordAtomic).toHaveBeenCalledOnce();
    // nextStatus should be null for PURCHASE
    expect(repo.recordAtomic).toHaveBeenCalledWith(expect.any(Object), null);
  });

  it('rejects SALE that would drop balance below 0 with 422 inventory.insufficient_stock', async () => {
    repo = makeRepo({ quantity: 1, status: 'IN_STOCK' });
    svc = new StockMovementService(repo as never, {} as never);
    await expect(
      tenantContext.runWith(ctx, () => svc.recordMovement({
        productId: PRODUCT_ID, type: 'SALE', quantityDelta: -3, reason: 'oversell test',
      })),
    ).rejects.toMatchObject({
      response: { code: 'inventory.insufficient_stock' },
    });
    expect(repo.recordAtomic).not.toHaveBeenCalled();
  });

  it('SALE that drops balance to 0 from IN_STOCK transitions status to SOLD', async () => {
    repo = makeRepo({ quantity: 1, status: 'IN_STOCK' });
    svc = new StockMovementService(repo as never, {} as never);
    await tenantContext.runWith(ctx, () => svc.recordMovement({
      productId: PRODUCT_ID, type: 'SALE', quantityDelta: -1, reason: 'final unit',
    }));
    expect(repo.recordAtomic).toHaveBeenCalledWith(expect.any(Object), 'SOLD');
  });

  it('ADJUSTMENT_OUT that drops balance to 0 does NOT auto-set SOLD', async () => {
    repo = makeRepo({ quantity: 1, status: 'IN_STOCK' });
    svc = new StockMovementService(repo as never, {} as never);
    await tenantContext.runWith(ctx, () => svc.recordMovement({
      productId: PRODUCT_ID, type: 'ADJUSTMENT_OUT', quantityDelta: -1, reason: 'damage',
    }));
    expect(repo.recordAtomic).toHaveBeenCalledWith(expect.any(Object), null);
  });

  it('SALE on WITH_KARIGAR product is rejected (no valid transition to SOLD) before lock acquisition', async () => {
    repo = makeRepo({ quantity: 1, status: 'WITH_KARIGAR' });
    svc = new StockMovementService(repo as never, {} as never);
    await expect(
      tenantContext.runWith(ctx, () => svc.recordMovement({
        productId: PRODUCT_ID, type: 'SALE', quantityDelta: -1, reason: 'cannot sell from karigar',
      })),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.recordAtomic).not.toHaveBeenCalled();
  });

  it('product not found returns 404', async () => {
    repo = makeRepo(null);
    svc = new StockMovementService(repo as never, {} as never);
    await expect(
      tenantContext.runWith(ctx, () => svc.recordMovement({
        productId: PRODUCT_ID, type: 'PURCHASE', quantityDelta: 1, reason: 'x',
      })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BalanceDriftError from repo surfaces as 422 inventory.insufficient_stock', async () => {
    repo = makeRepo({ quantity: 5, status: 'IN_STOCK' });
    repo.recordAtomic.mockRejectedValueOnce(new BalanceDriftError());
    svc = new StockMovementService(repo as never, {} as never);
    await expect(
      tenantContext.runWith(ctx, () => svc.recordMovement({
        productId: PRODUCT_ID, type: 'SALE', quantityDelta: -1, reason: 'race lost',
      })),
    ).rejects.toMatchObject({
      response: { code: 'inventory.insufficient_stock' },
    });
  });

  it('ProductNotFoundForLock from repo surfaces as 404', async () => {
    repo = makeRepo({ quantity: 5, status: 'IN_STOCK' });
    repo.recordAtomic.mockRejectedValueOnce(new ProductNotFoundForLock());
    svc = new StockMovementService(repo as never, {} as never);
    await expect(
      tenantContext.runWith(ctx, () => svc.recordMovement({
        productId: PRODUCT_ID, type: 'SALE', quantityDelta: -1, reason: 'product deleted between read and lock',
      })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
