import { Injectable, Inject, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SettingsCache } from '@goldsmith/tenant-config';
import { LOYALTY_DEFAULTS } from '@goldsmith/shared';
import type { LoyaltyState, LoyaltyTransaction, AdjustPointsBody } from '@goldsmith/shared';
import { LoyaltyRepository } from './loyalty.repository';
import type { LoyaltyTransactionRow } from './loyalty.repository';

/**
 * Pure accrual math (exported so tests can assert without service plumbing).
 *
 * earnRatePercentage is a 2-decimal string like '1.00' meaning "1 point per ₹100 of gold value".
 * We convert it to integer hundredths-of-percent so the entire calculation is bigint-exact.
 *
 * Formula:
 *   points = floor(goldValuePaise * hundredthsOfPercent / 1_000_000)
 *
 * Justification:
 *   goldValuePaise / 100 = gold value in rupees
 *   earnRate / 100        = earn rate as a fraction
 *   ⇒ points = (goldValuePaise / 100) × (earnRate / 100)
 *            = goldValuePaise × earnRate / 10_000
 *   With earnRate = hundredthsOfPercent / 100, that's
 *            = goldValuePaise × hundredthsOfPercent / 1_000_000
 */
export function computeAccrualPoints(goldValuePaise: bigint, earnRatePercentage: string): number {
  if (goldValuePaise <= 0n) return 0;
  const parsed = parseFloat(earnRatePercentage);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  // Schema enforces ≤ 2 decimals; round defensively in case a future schema relaxes that.
  const hundredths = Math.round(parsed * 100);
  if (hundredths <= 0) return 0;
  const points = (goldValuePaise * BigInt(hundredths)) / 1_000_000n;
  // Points fit comfortably in a JS number (Number.MAX_SAFE_INTEGER ≈ 9e15).
  // Even at 100 crore in gold value (1e10 paise) at 100% rate, points = 1e8 — well safe.
  return Number(points);
}

export interface AccruePointsParams {
  customerId: string;
  invoiceId: string;
  goldValuePaise: bigint;
}

export interface AccruePointsResult {
  pointsDelta: number;
  newBalance: number;
}

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject('PG_POOL')      private readonly pool: Pool,
    @Inject(LoyaltyRepository) private readonly repo: LoyaltyRepository,
    @Inject(SettingsCache)  private readonly settingsCache: SettingsCache,
  ) {}

  // Worker-driven (no actor user). Idempotency is enforced upstream by the queue.
  // Reads only ctx.shopId — works with both authenticated (HTTP) and worker-built
  // (unauthenticated) tenant contexts. Do NOT read ctx.userId or ctx.role here;
  // the worker context has neither.
  async accruePoints(params: AccruePointsParams): Promise<AccruePointsResult> {
    const ctx = tenantContext.requireCurrent();

    const config = (await this.settingsCache.getLoyalty()) ?? LOYALTY_DEFAULTS;
    const pointsDelta = computeAccrualPoints(params.goldValuePaise, config.earnRatePercentage);

    return withTenantTx(this.pool, async (tx) => {
      const aggregate = await this.repo.lockOrCreateAggregate(tx, ctx.shopId, params.customerId);

      // Zero-point accrual — no row inserted, no balance change. Caller still gets a result.
      if (pointsDelta === 0) {
        return { pointsDelta: 0, newBalance: aggregate.points_balance };
      }

      const balanceBefore = aggregate.points_balance;
      const balanceAfter  = balanceBefore + pointsDelta;

      await this.repo.insertTransaction(tx, ctx.shopId, {
        customerId:      params.customerId,
        invoiceId:       params.invoiceId,
        type:            'ACCRUAL',
        pointsDelta,
        balanceBefore,
        balanceAfter,
        reason:          `invoice:${params.invoiceId}`,
        createdByUserId: null, // worker-driven; no human actor
      });

      await this.repo.updateAggregate(tx, ctx.shopId, {
        customerId:    params.customerId,
        pointsDelta,
        lifetimeDelta: pointsDelta, // ACCRUAL: lifetime grows with balance
      });

      void auditLog(this.pool, {
        action:      AuditAction.LOYALTY_POINTS_ACCRUED,
        subjectType: 'customer',
        subjectId:   params.customerId,
        // actorUserId omitted — worker-driven accrual has no human actor
        after: {
          invoice_id:    params.invoiceId,
          points_delta:  pointsDelta,
          balance_after: balanceAfter,
        },
      }).catch(() => undefined);

      return { pointsDelta, newBalance: balanceAfter };
    });
  }

  async getLoyaltyState(customerId: string): Promise<LoyaltyState> {
    const ctx = tenantContext.requireCurrent();
    const exists = await this.repo.customerExists(ctx.shopId, customerId);
    if (!exists) {
      throw new NotFoundException({ code: 'loyalty.customer_not_found' });
    }

    const row = await this.repo.getState(customerId);
    if (!row) {
      return { pointsBalance: 0, lifetimePoints: 0, currentTier: null, tierSince: null };
    }
    return {
      pointsBalance:  row.points_balance,
      lifetimePoints: row.lifetime_points,
      currentTier:    row.current_tier,
      tierSince:      row.tier_since?.toISOString() ?? null,
    };
  }

  async getRecentTransactions(customerId: string, limit: number): Promise<LoyaltyTransaction[]> {
    const ctx = tenantContext.requireCurrent();
    const exists = await this.repo.customerExists(ctx.shopId, customerId);
    if (!exists) {
      throw new NotFoundException({ code: 'loyalty.customer_not_found' });
    }
    const rows = await this.repo.getRecentTransactions(customerId, limit);
    return rows.map(rowToTransactionResponse);
  }

  async adjustPoints(customerId: string, dto: AdjustPointsBody): Promise<AccruePointsResult> {
    const rawCtx = tenantContext.requireCurrent();
    // adjustPoints is HTTP-only; controller has already gated on ctx.authenticated.
    // Runtime guard backs the type cast — fail fast if something ever bypasses the controller.
    if (!rawCtx.authenticated) {
      throw new UnprocessableEntityException({ code: 'loyalty.unauthenticated_context' });
    }
    const ctx = rawCtx as AuthenticatedTenantContext;

    if (dto.pointsDelta === 0) {
      throw new UnprocessableEntityException({ code: 'loyalty.points_delta_nonzero' });
    }

    const exists = await this.repo.customerExists(ctx.shopId, customerId);
    if (!exists) {
      throw new NotFoundException({ code: 'loyalty.customer_not_found' });
    }

    return withTenantTx(this.pool, async (tx) => {
      const aggregate = await this.repo.lockOrCreateAggregate(tx, ctx.shopId, customerId);

      const balanceBefore = aggregate.points_balance;
      const balanceAfter  = balanceBefore + dto.pointsDelta;

      if (balanceAfter < 0) {
        throw new UnprocessableEntityException({
          code: 'loyalty.would_go_negative',
          balanceBefore,
          attemptedDelta: dto.pointsDelta,
        });
      }

      const type = dto.pointsDelta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

      await this.repo.insertTransaction(tx, ctx.shopId, {
        customerId,
        invoiceId:       null,
        type,
        pointsDelta:     dto.pointsDelta,
        balanceBefore,
        balanceAfter,
        reason:          dto.reason,
        createdByUserId: ctx.userId,
      });

      await this.repo.updateAggregate(tx, ctx.shopId, {
        customerId,
        pointsDelta:    dto.pointsDelta,
        lifetimeDelta:  0, // adjustments do NOT change lifetime points
      });

      void auditLog(this.pool, {
        action:      AuditAction.LOYALTY_POINTS_ADJUSTED,
        subjectType: 'customer',
        subjectId:   customerId,
        actorUserId: ctx.userId,
        after: {
          type,
          points_delta:  dto.pointsDelta,
          balance_after: balanceAfter,
          reason:        dto.reason,
        },
      }).catch(() => undefined);

      return { pointsDelta: dto.pointsDelta, newBalance: balanceAfter };
    });
  }
}

function rowToTransactionResponse(row: LoyaltyTransactionRow): LoyaltyTransaction {
  return {
    id:            row.id,
    type:          row.type as LoyaltyTransaction['type'],
    pointsDelta:   row.points_delta,
    balanceBefore: row.balance_before,
    balanceAfter:  row.balance_after,
    reason:        row.reason,
    invoiceId:     row.invoice_id,
    createdAt:     row.created_at.toISOString(),
  };
}
