import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { SyncLogger } from '@goldsmith/sync';
import type { MovementType } from '@goldsmith/shared';

export interface ProductLockRow {
  id: string;
  shop_id: string;
  quantity: number;
  status: string;
}

export interface StockMovementRow {
  id: string;
  shop_id: string;
  product_id: string;
  type: string;
  reason: string;
  quantity_delta: number;
  balance_before: number;
  balance_after: number;
  source_name: string | null;
  source_id: string | null;
  recorded_by_user_id: string;
  recorded_at: Date;
}

export interface InsertMovementInput {
  productId: string;
  type: MovementType;
  reason: string;
  quantityDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  sourceName: string | null;
  sourceId: string | null;
  recordedByUserId: string;
}

const SELECT_COLS = `
  id, shop_id, product_id, type, reason, quantity_delta,
  balance_before, balance_after, source_name, source_id,
  recorded_by_user_id, recorded_at
`;

export class ProductNotFoundForLock extends Error {
  constructor() { super('inventory.product_not_found'); }
}
export class BalanceDriftError extends Error {
  constructor() { super('inventory.balance_drift'); }
}

@Injectable()
export class StockMovementRepository {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly syncLogger: SyncLogger,
  ) {}

  /**
   * Read the product without locking. Used by the service to fast-fail
   * validation (status, balance) before acquiring the write lock.
   */
  async getProductForRead(productId: string): Promise<ProductLockRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ProductLockRow>(
        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1`,
        [productId],
      );
      return r.rows[0] ?? null;
    });
  }

  /**
   * Atomic record operation under a SELECT FOR UPDATE lock.
   *
   * Steps inside a single transaction:
   *   1. SELECT ... FOR UPDATE on the product row (pessimistic lock).
   *   2. Verify the caller's expected balance_before still matches the locked snapshot.
   *   3. INSERT into stock_movements (DB CHECK constraints enforce sign + balance invariants).
   *   4. UPDATE products.quantity (and status if nextStatus is non-null).
   *   5. Emit a 'products' UPDATE sync_change_log entry (mobile reads movements via REST).
   */
  async recordAtomic(
    input: InsertMovementInput,
    nextStatus: string | null,
  ): Promise<StockMovementRow> {
    return withTenantTx(this.pool, async (tx) => {
      // 1. Pessimistic lock — prevents concurrent oversell
      const lockRes = await tx.query<ProductLockRow>(
        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1 FOR UPDATE`,
        [input.productId],
      );
      const product = lockRes.rows[0];
      if (!product) {
        throw new ProductNotFoundForLock();
      }
      if (product.quantity !== input.balanceBefore) {
        // Caller's optimistic read drifted — another tx changed quantity.
        throw new BalanceDriftError();
      }

      // 2. INSERT the movement
      const insertRes = await tx.query<StockMovementRow>(
        `INSERT INTO stock_movements
           (shop_id, product_id, type, reason, quantity_delta,
            balance_before, balance_after, source_name, source_id,
            recorded_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid,
                 $1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING ${SELECT_COLS}`,
        [
          input.productId, input.type, input.reason, input.quantityDelta,
          input.balanceBefore, input.balanceAfter, input.sourceName,
          input.sourceId, input.recordedByUserId,
        ],
      );
      const movement = insertRes.rows[0]!;

      // 3. Update product quantity (+ status if SALE→0 was signalled by service)
      const productUpdate = await tx.query<{ id: string; quantity: number; status: string }>(
        nextStatus
          ? `UPDATE products SET quantity = $1, status = $2, updated_at = now()
             WHERE id = $3 RETURNING id, quantity, status`
          : `UPDATE products SET quantity = $1, updated_at = now()
             WHERE id = $2 RETURNING id, quantity, status`,
        nextStatus
          ? [input.balanceAfter, nextStatus, input.productId]
          : [input.balanceAfter, input.productId],
      );

      // 4. Sync log — products UPDATE (stock_movements is REST-only on mobile)
      const ctx = tenantContext.requireCurrent();
      await this.syncLogger.logInTx(
        tx, ctx.shopId, 'products', input.productId, 'UPDATE',
        productUpdate.rows[0] as unknown as Record<string, unknown>,
      );

      return movement;
    });
  }

  async listMovements(productId: string, limit: number, offset: number): Promise<StockMovementRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<StockMovementRow>(
        `SELECT ${SELECT_COLS} FROM stock_movements
         WHERE product_id = $1
         ORDER BY recorded_at DESC
         LIMIT $2 OFFSET $3`,
        [productId, limit, offset],
      );
      return r.rows;
    });
  }
}
