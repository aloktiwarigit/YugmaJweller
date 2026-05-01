import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL_ADMIN } from '../platform-admin.tokens';

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

// Pool here is PG_POOL_ADMIN, which connects directly as platform_admin.
// BEGIN/COMMIT remains for atomicity — upsert + audit insert must succeed or fail together.
async function inTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
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
  constructor(@Inject(PG_POOL_ADMIN) private readonly pool: Pool) {}

  async upsertSubscription(a: UpsertSubscriptionArgs): Promise<{ id: string }> {
    if (!PLANS.has(a.plan)) throw new BadRequestException({ code: 'subscription.invalid_plan' });
    if (!Number.isInteger(a.mrrPaise) || a.mrrPaise < 0) {
      throw new BadRequestException({ code: 'subscription.invalid_mrr' });
    }
    return inTx(this.pool, async (c) => {
      // On UPDATE: refer to the parameters ($3 / $5) directly so we can preserve the existing
      // row's status / billing_cycle_start when the caller omits them. Using EXCLUDED.* here
      // is a footgun because EXCLUDED.status is COALESCE($3, 'active') — omitting the field
      // on update would silently reactivate a suspended sub and clear its billing cycle.
      const r = await c.query<{ id: string }>(
        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
         VALUES ($1, $2, COALESCE($3, 'active'), $4, $5)
         ON CONFLICT (shop_id) DO UPDATE
           SET plan = EXCLUDED.plan,
               status = COALESCE($3, platform_subscriptions.status),
               mrr_paise = EXCLUDED.mrr_paise,
               billing_cycle_start = COALESCE($5, platform_subscriptions.billing_cycle_start),
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
          JSON.stringify({ plan: a.plan, status: a.status ?? null, mrrPaise: a.mrrPaise }),
        ],
      );
      return { id };
    });
  }

  async listSubscriptions(): Promise<SubscriptionRow[]> {
    return inTx(this.pool, async (c) => {
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
