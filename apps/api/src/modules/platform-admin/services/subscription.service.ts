import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

export type SubscriptionPlan = 'trial' | 'starter' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

export interface UpsertSubscriptionArgs {
  shopId: string;
  plan: SubscriptionPlan;
  mrrPaise: number;
  status?: SubscriptionStatus;
  billingCycleStart?: string; // YYYY-MM-DD
  platformUserId: string;
}

export interface SubscriptionRow {
  id: string;
  shopId: string;
  displayName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  mrrPaise: number;
}

const PLANS = new Set<SubscriptionPlan>(['trial', 'starter', 'growth', 'enterprise']);

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    // SET LOCAL ROLE is transaction-scoped; wrap in BEGIN/COMMIT so the role persists
    // across all queries inside fn(). Atomic-by-default is also a correctness win for
    // helpers that pair a write with an audit insert.
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE platform_admin');
    try {
      const result = await fn(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  } finally {
    c.release();
  }
}

@Injectable()
export class SubscriptionService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async upsertSubscription(a: UpsertSubscriptionArgs): Promise<{ id: string }> {
    if (!PLANS.has(a.plan)) throw new BadRequestException({ code: 'subscription.invalid_plan' });
    if (!Number.isInteger(a.mrrPaise) || a.mrrPaise < 0) {
      throw new BadRequestException({ code: 'subscription.invalid_mrr' });
    }
    return withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
         VALUES ($1, $2, COALESCE($3, 'active'), $4, $5)
         ON CONFLICT (shop_id) DO UPDATE
           SET plan = EXCLUDED.plan,
               status = EXCLUDED.status,
               mrr_paise = EXCLUDED.mrr_paise,
               billing_cycle_start = EXCLUDED.billing_cycle_start,
               updated_at = now()
         RETURNING id`,
        [a.shopId, a.plan, a.status ?? null, a.mrrPaise, a.billingCycleStart ?? null],
      );
      const id = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          'subscription.upserted',
          a.platformUserId,
          a.shopId,
          JSON.stringify({ plan: a.plan, status: a.status ?? 'active', mrrPaise: a.mrrPaise }),
        ],
      );
      return { id };
    });
  }

  async listSubscriptions(): Promise<SubscriptionRow[]> {
    return withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query<{
        id: string;
        shop_id: string;
        display_name: string;
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
        mrr_paise: string;
      }>(
        `SELECT s.id, s.shop_id, sh.display_name, s.plan, s.status, s.mrr_paise
           FROM platform_subscriptions s
           JOIN shops sh ON sh.id = s.shop_id
           ORDER BY sh.display_name`,
      );
      return r.rows.map((x) => ({
        id: x.id,
        shopId: x.shop_id,
        displayName: x.display_name,
        plan: x.plan,
        status: x.status,
        mrrPaise: Number(x.mrr_paise),
      }));
    });
  }
}
