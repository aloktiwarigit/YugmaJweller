import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface CustomerLoyaltyRow {
  id: string;
  shop_id: string;
  customer_id: string;
  points_balance: number;
  lifetime_points: number;
  current_tier: string | null;
  tier_since: Date | null;
  last_updated_at: Date;
}

export interface LoyaltyTransactionRow {
  id: string;
  shop_id: string;
  customer_id: string;
  invoice_id: string | null;
  type: string;
  points_delta: number;
  balance_before: number;
  balance_after: number;
  reason: string;
  created_by_user_id: string | null;
  created_at: Date;
}

export interface InsertTransactionInput {
  customerId: string;
  invoiceId: string | null;
  type: 'ACCRUAL' | 'REDEMPTION' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'REVERSAL';
  pointsDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  createdByUserId: string | null;
}

export interface AggregateUpdateInput {
  customerId: string;
  pointsDelta: number;     // signed
  lifetimeDelta: number;   // 0 for non-ACCRUAL types
}

// Minimal tx shape — matches what withTenantTx hands us (a `query` method is enough).
export interface TxLike {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
}

@Injectable()
export class LoyaltyRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // Upserts an aggregate row (creating with zero balance/lifetime if missing) and returns
  // the row WITH a row-level FOR UPDATE lock held until the surrounding transaction commits.
  // Caller must already be inside a withTenantTx; the lock prevents concurrent accrual races.
  /* eslint-disable goldsmith/no-raw-shop-id-param */
  async lockOrCreateAggregate(
    tx: TxLike,
    shopId: string,
    customerId: string,
  ): Promise<CustomerLoyaltyRow> { /* eslint-enable goldsmith/no-raw-shop-id-param */
    // INSERT ... ON CONFLICT DO NOTHING is idempotent; we then SELECT FOR UPDATE.
    // Using the unique (shop_id, customer_id) constraint added in 0037.
    await tx.query(
      `INSERT INTO customer_loyalty (shop_id, customer_id, points_balance, lifetime_points)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (shop_id, customer_id) DO NOTHING`,
      [shopId, customerId],
    );
    const r = await tx.query(
      `SELECT id, shop_id, customer_id, points_balance, lifetime_points,
              current_tier, tier_since, last_updated_at
       FROM customer_loyalty
       WHERE shop_id = $1 AND customer_id = $2
       FOR UPDATE`,
      [shopId, customerId],
    );
    if (r.rows.length === 0) {
      // Should be impossible: INSERT...ON CONFLICT either inserted or row already existed.
      throw new Error('loyalty_aggregate_missing_after_upsert');
    }
    return r.rows[0] as CustomerLoyaltyRow;
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal; shopId from auth context
  async insertTransaction(tx: TxLike, shopId: string, input: InsertTransactionInput): Promise<LoyaltyTransactionRow> {
    const r = await tx.query(
      `INSERT INTO loyalty_transactions
         (shop_id, customer_id, invoice_id, type, points_delta,
          balance_before, balance_after, reason, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, shop_id, customer_id, invoice_id, type, points_delta,
                 balance_before, balance_after, reason, created_by_user_id, created_at`,
      [
        shopId,
        input.customerId,
        input.invoiceId,
        input.type,
        input.pointsDelta,
        input.balanceBefore,
        input.balanceAfter,
        input.reason,
        input.createdByUserId,
      ],
    );
    return r.rows[0] as LoyaltyTransactionRow;
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal; shopId from auth context
  async updateAggregate(tx: TxLike, shopId: string, input: AggregateUpdateInput): Promise<void> {
    await tx.query(
      `UPDATE customer_loyalty
       SET points_balance  = points_balance + $1,
           lifetime_points = lifetime_points + $2,
           last_updated_at = now()
       WHERE shop_id = $3 AND customer_id = $4`,
      [input.pointsDelta, input.lifetimeDelta, shopId, input.customerId],
    );
  }

  async getState(customerId: string): Promise<CustomerLoyaltyRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query(
        `SELECT id, shop_id, customer_id, points_balance, lifetime_points,
                current_tier, tier_since, last_updated_at
         FROM customer_loyalty
         WHERE customer_id = $1`,
        [customerId],
      );
      return (r.rows[0] as CustomerLoyaltyRow | undefined) ?? null;
    });
  }

  async getRecentTransactions(customerId: string, limit: number): Promise<LoyaltyTransactionRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query(
        `SELECT id, shop_id, customer_id, invoice_id, type, points_delta,
                balance_before, balance_after, reason, created_by_user_id, created_at
         FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [customerId, safeLimit],
      );
      return r.rows as LoyaltyTransactionRow[];
    });
  }

  // Verifies the customer exists and belongs to the current tenant.
  // Defense-in-depth: explicit shop_id predicate in addition to RLS scope.
  // Mirrors family.repository.customerBelongsToShop — never trust RLS alone
  // at the service boundary.
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal; shopId from auth context
  async customerExists(shopId: string, customerId: string): Promise<boolean> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query(
        `SELECT 1 FROM customers WHERE id = $1 AND shop_id = $2`,
        [customerId, shopId],
      );
      return r.rows.length > 0;
    });
  }
}
