import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type {
  RecordMovementBodyDto,
  StockMovementResponse,
  MovementType,
} from '@goldsmith/shared';
import { assertValidTransition } from './state-machine';
import type { ProductStatus } from './state-machine';
import {
  StockMovementRepository,
  ProductNotFoundForLock,
  BalanceDriftError,
  type StockMovementRow,
} from './stock-movement.repository';

function mapRow(row: StockMovementRow): StockMovementResponse {
  return {
    id: row.id,
    shopId: row.shop_id,
    productId: row.product_id,
    type: row.type as MovementType,
    reason: row.reason,
    quantityDelta: row.quantity_delta,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    sourceName: row.source_name,
    sourceId: row.source_id,
    recordedByUserId: row.recorded_by_user_id,
    recordedAt: row.recorded_at.toISOString(),
  };
}

@Injectable()
export class StockMovementService {
  constructor(
    @Inject(StockMovementRepository) private readonly repo: StockMovementRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async recordMovement(
    dto: RecordMovementBodyDto & { productId: string },
  ): Promise<StockMovementResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    // 1. Pre-lock read — fast-fails 404 / 422 / state-transition errors before
    //    holding the row lock on a doomed transaction.
    const product = await this.repo.getProductForRead(dto.productId);
    if (!product) {
      throw new NotFoundException({ code: 'inventory.product_not_found' });
    }

    // 2. Optimistic balance arithmetic
    const balanceBefore = product.quantity;
    const balanceAfter = balanceBefore + dto.quantityDelta;
    if (balanceAfter < 0) {
      throw new UnprocessableEntityException({
        code: 'inventory.insufficient_stock',
        message: `Cannot reduce below 0. Current: ${balanceBefore}`,
      });
    }

    // 3. Auto-status: only SALE→0 transitions to SOLD.
    //    ADJUSTMENT_OUT/TRANSFER_OUT are physical movements, not sales —
    //    they leave status as-is.
    let nextStatus: string | null = null;
    if (dto.type === 'SALE' && balanceAfter === 0) {
      assertValidTransition(product.status as ProductStatus, 'SOLD');
      nextStatus = 'SOLD';
    }

    // 4. Atomic write under SELECT FOR UPDATE
    let row: StockMovementRow;
    try {
      row = await this.repo.recordAtomic(
        {
          productId: dto.productId,
          type: dto.type,
          reason: dto.reason,
          quantityDelta: dto.quantityDelta,
          balanceBefore,
          balanceAfter,
          sourceName: dto.sourceName ?? null,
          sourceId: dto.sourceId ?? null,
          recordedByUserId: ctx.userId,
        },
        nextStatus,
      );
    } catch (err) {
      if (err instanceof ProductNotFoundForLock) {
        throw new NotFoundException({ code: 'inventory.product_not_found' });
      }
      if (err instanceof BalanceDriftError) {
        // Lost the race — another tx changed quantity between our read and our lock.
        // Surface as the same 422 the client knows how to handle (refresh + retry).
        throw new UnprocessableEntityException({
          code: 'inventory.insufficient_stock',
          message: 'Stock changed concurrently; please refresh and try again',
        });
      }
      throw err;
    }

    // 5. Audit — no PII in payload (reason is free-text; semgrep guards against
    //    phone/PAN/aadhaar regex patterns at WS-C2).
    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_STOCK_MOVEMENT_RECORDED,
      subjectType: 'product',
      subjectId: dto.productId,
      actorUserId: ctx.userId,
      before: { quantity: balanceBefore, status: product.status },
      after: {
        quantity: balanceAfter,
        status: nextStatus ?? product.status,
        movement_id: row.id,
        type: dto.type,
        quantity_delta: dto.quantityDelta,
      },
    }).catch(() => undefined);

    return mapRow(row);
  }

  async listMovements(
    productId: string,
    limit = 50,
    offset = 0,
  ): Promise<StockMovementResponse[]> {
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    const safeOffset = Math.max(offset, 0);
    const rows = await this.repo.listMovements(productId, cappedLimit, safeOffset);
    return rows.map(mapRow);
  }
}
