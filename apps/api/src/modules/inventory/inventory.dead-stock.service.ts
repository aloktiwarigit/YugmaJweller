import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { TenantContext } from '@goldsmith/tenant-context';

export interface DeadStockProduct {
  id:                       string;
  sku:                      string;
  metal:                    string;
  purity:                   string;
  weightG:                  string;   // gross_weight_g as string
  status:                   string;
  firstListedAt:            Date;
  daysInStock:              number;
  estimatedValueFormatted?: string;   // TODO Story 4.x: inject PricingService to compute estimatedValueFormatted
  suggestedAction:          'DISCOUNT' | 'KARIGAR' | 'REPURPOSE';
}

function suggestedAction(
  daysInStock: number,
  threshold: number,
): 'DISCOUNT' | 'KARIGAR' | 'REPURPOSE' {
  if (daysInStock < threshold * 1.5) return 'DISCOUNT';
  if (daysInStock < threshold * 3)   return 'KARIGAR';
  return 'REPURPOSE';
}

@Injectable()
export class InventoryDeadStockService {
  private readonly logger = new Logger(InventoryDeadStockService.name);

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getDeadStock(ctx: TenantContext): Promise<DeadStockProduct[]> {
    const { shopId } = ctx;

    // nosemgrep: javascript.pg.sql-injection — RLS tenant context is set by the
    // TenantInterceptor at the connection level before any query executes.
    const client = await this.pool.connect();
    try {
      // 1. Get dead_stock_threshold_days from shop_settings; default 180 if no row.
      const thresholdResult = await client.query<{ threshold: number }>(
        `SELECT COALESCE(dead_stock_threshold_days, 180) AS threshold
         FROM shop_settings
         WHERE shop_id = $1`,
        [shopId],
      );

      const threshold: number =
        thresholdResult.rows.length > 0
          ? thresholdResult.rows[0]!.threshold
          : 180;

      // 2. Query products that have been IN_STOCK longer than the threshold.
      const deadStockResult = await client.query<{
        id:            string;
        sku:           string;
        metal:         string;
        purity:        string;
        weightG:       string;
        status:        string;
        created_at:    Date;
        days_in_stock: number;
      }>(
        `SELECT id, sku, metal, purity, gross_weight_g::text AS "weightG",
                status, created_at,
                FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int AS days_in_stock
         FROM products
         WHERE shop_id = $1
           AND status = 'IN_STOCK'
           AND created_at < now() - ($2 || ' days')::interval
         ORDER BY created_at ASC`,
        [shopId, threshold],
      );

      return deadStockResult.rows.map((row) => ({
        id:            row.id,
        sku:           row.sku,
        metal:         row.metal,
        purity:        row.purity,
        weightG:       row.weightG,
        status:        row.status,
        firstListedAt: row.created_at,
        daysInStock:   row.days_in_stock,
        // estimatedValueFormatted is omitted (rates unavailable without PricingService).
        // TODO Story 4.x: inject PricingService to compute estimatedValueFormatted once
        // circular-module dependency is resolved.
        suggestedAction: suggestedAction(row.days_in_stock, threshold),
      }));
    } catch (err) {
      this.logger.error('getDeadStock query failed', err);
      throw err;
    } finally {
      client.release();
    }
  }
}
