import { Injectable, Inject } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { POISON_UUID } from '@goldsmith/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecordViewParams {
  shopId: string;
  productId: string;
  customerId?: string;
  sessionId: string;
  durationSeconds?: number;
}

export interface ViewSummary {
  totalViews: number;
  uniqueViewers: number;
  avgDurationSeconds: number | null;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async recordView(params: RecordViewParams): Promise<void> {
    // Fire-and-forget: drop silently on invalid input rather than surfacing errors to anonymous callers.
    if (!UUID_RE.test(params.shopId) || !UUID_RE.test(params.productId) || !UUID_RE.test(params.sessionId)) {
      return;
    }
    if (params.customerId !== undefined && !UUID_RE.test(params.customerId)) {
      return;
    }

    await this.withShopTx(params.shopId, async (tx) => {
      if (params.customerId !== undefined) {
        const consent = await tx.query<{ consent_given: boolean }>(
          // nosemgrep: goldsmith.require-tenant-transaction
          `SELECT consent_given FROM viewing_consent
           WHERE shop_id = $1 AND customer_id = $2`,
          [params.shopId, params.customerId],
        );
        if (!consent.rows[0]?.consent_given) return;
      }

      const recent = await tx.query<{ id: string }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT id FROM product_views
         WHERE session_id = $1 AND product_id = $2
           AND viewed_at > NOW() - INTERVAL '30 seconds'
         LIMIT 1`,
        [params.sessionId, params.productId],
      );
      if (recent.rows.length > 0) return;

      await tx.query(
        // nosemgrep: goldsmith.require-tenant-transaction
        `INSERT INTO product_views (shop_id, product_id, customer_id, session_id, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          params.shopId,
          params.productId,
          params.customerId ?? null,
          params.sessionId,
          params.durationSeconds ?? null,
        ],
      );
    });
  }

  async getProductViewSummary(params: {
    shopId: string;
    productId: string;
    days: 30 | 90 | 365;
  }): Promise<ViewSummary> {
    if (!UUID_RE.test(params.shopId) || !UUID_RE.test(params.productId)) {
      throw new Error('analytics.invalid_params');
    }
    return this.withShopTx(params.shopId, async (tx) => {
      const r = await tx.query<{
        total_views: string;
        unique_viewers: string;
        avg_duration_seconds: string | null;
      }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT
           COUNT(*)::text                   AS total_views,
           COUNT(DISTINCT session_id)::text AS unique_viewers,
           AVG(duration_seconds)::text      AS avg_duration_seconds
         FROM product_views
         WHERE product_id = $1
           AND viewed_at > NOW() - INTERVAL '1 day' * $2`,
        [params.productId, params.days],
      );
      const row = r.rows[0]!;
      return {
        totalViews:         parseInt(row.total_views, 10),
        uniqueViewers:      parseInt(row.unique_viewers, 10),
        avgDurationSeconds: row.avg_duration_seconds !== null
          ? parseFloat(row.avg_duration_seconds)
          : null,
      };
    });
  }

  private async withShopTx<T>(shopId: string, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_user');
      await client.query(`SET LOCAL app.current_shop_id = '${shopId}'`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      await client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      client.release();
    }
  }
}
