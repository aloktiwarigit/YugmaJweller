import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface DailySummaryResult {
  date: string;
  total_paise: string;
  cash_paise: string;
  upi_paise: string;
  other_paise: string;
  invoice_count: number;
  gold_weight_mg: string;
}

export interface OutstandingItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string | null;
  total_paise: string;
  balance_due_paise: string;
  issued_at: string | null;
}

export interface OutstandingResult {
  items: OutstandingItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerLtvItem {
  customer_id: string;
  name: string;
  phone: string;
  ltv_paise: string;
}

export interface LoyaltySummaryResult {
  points_issued: number;
  points_redeemed: number;
  members_by_tier: { tier: string | null; count: number }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ReportsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getDailySummary(date: string): Promise<DailySummaryResult> {
    if (!DATE_RE.test(date)) {
      throw new BadRequestException({ code: 'reports.invalid_date' });
    }

    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{
        total_paise:    string;
        cash_paise:     string;
        upi_paise:      string;
        other_paise:    string;
        invoice_count:  string;
        gold_weight_mg: string;
      }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `WITH daily_invoices AS (
           SELECT id, total_paise
           FROM invoices
           WHERE status = 'ISSUED'
             AND DATE(issued_at AT TIME ZONE 'Asia/Kolkata') = $1::date
         ),
         daily_payments AS (
           SELECT p.method, p.amount_paise
           FROM payments p
           JOIN daily_invoices di ON di.id = p.invoice_id
           WHERE p.status = 'CONFIRMED'
         ),
         daily_items AS (
           SELECT ii.net_weight_g
           FROM invoice_items ii
           JOIN daily_invoices di ON di.id = ii.invoice_id
           WHERE ii.metal_type = 'GOLD'
         )
         SELECT
           COALESCE((SELECT SUM(total_paise)     FROM daily_invoices), 0)::text AS total_paise,
           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method = 'CASH'), 0)::text AS cash_paise,
           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method = 'UPI'),  0)::text AS upi_paise,
           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method NOT IN ('CASH','UPI')), 0)::text AS other_paise,
           COALESCE((SELECT COUNT(*)              FROM daily_invoices), 0)::text AS invoice_count,
           COALESCE((SELECT SUM((net_weight_g * 1000)::bigint) FROM daily_items), 0)::text AS gold_weight_mg`,
        [date],
      );

      const row = r.rows[0]!;
      return {
        date,
        total_paise:    row.total_paise,
        cash_paise:     row.cash_paise,
        upi_paise:      row.upi_paise,
        other_paise:    row.other_paise,
        invoice_count:  parseInt(row.invoice_count, 10),
        gold_weight_mg: row.gold_weight_mg,
      };
    });
  }

  async getOutstanding(page: number, limit: number): Promise<OutstandingResult> {
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset    = (safePage - 1) * safeLimit;

    return withTenantTx(this.pool, async (tx) => {
      const countRes = await tx.query<{ total: string }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT COUNT(*)::text AS total
         FROM invoices i
         WHERE i.status = 'ISSUED'
           AND i.total_paise - COALESCE(
             (SELECT SUM(p.amount_paise)
              FROM payments p
              WHERE p.invoice_id = i.id AND p.status = 'CONFIRMED'), 0
           ) > 0`,
        [],
      );

      const itemsRes = await tx.query<{
        id:               string;
        invoice_number:   string;
        customer_name:    string;
        customer_phone:   string | null;
        total_paise:      string;
        balance_due_paise: string;
        issued_at:        Date | null;
      }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT
           i.id,
           i.invoice_number,
           i.customer_name,
           i.customer_phone,
           i.total_paise::text,
           (i.total_paise - COALESCE(
             (SELECT SUM(p.amount_paise)
              FROM payments p
              WHERE p.invoice_id = i.id AND p.status = 'CONFIRMED'), 0
           ))::text AS balance_due_paise,
           i.issued_at
         FROM invoices i
         WHERE i.status = 'ISSUED'
           AND i.total_paise - COALESCE(
             (SELECT SUM(p.amount_paise)
              FROM payments p
              WHERE p.invoice_id = i.id AND p.status = 'CONFIRMED'), 0
           ) > 0
         ORDER BY i.issued_at DESC
         LIMIT $1 OFFSET $2`,
        [safeLimit, offset],
      );

      return {
        items: itemsRes.rows.map((row) => ({
          id:               row.id,
          invoice_number:   row.invoice_number,
          customer_name:    row.customer_name,
          customer_phone:   row.customer_phone,
          total_paise:      row.total_paise,
          balance_due_paise: row.balance_due_paise,
          issued_at:        row.issued_at?.toISOString() ?? null,
        })),
        total: parseInt(countRes.rows[0]!.total, 10),
        page:  safePage,
        limit: safeLimit,
      };
    });
  }

  async getCustomerLtv(limit: number): Promise<CustomerLtvItem[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{
        customer_id: string;
        name:        string;
        phone:       string;
        ltv_paise:   string;
      }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT
           c.id AS customer_id,
           c.name,
           c.phone,
           SUM(i.total_paise)::text AS ltv_paise
         FROM customers c
         JOIN invoices i ON i.customer_id = c.id AND i.status = 'ISSUED'
         GROUP BY c.id, c.name, c.phone
         ORDER BY SUM(i.total_paise) DESC
         LIMIT $1`,
        [safeLimit],
      );
      return r.rows;
    });
  }

  async getLoyaltySummary(): Promise<LoyaltySummaryResult> {
    return withTenantTx(this.pool, async (tx) => {
      const issuedRes = await tx.query<{ points_issued: string; points_redeemed: string }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'ACCRUAL'    THEN points_delta ELSE 0 END), 0)::text AS points_issued,
           COALESCE(SUM(CASE WHEN type = 'REDEMPTION' THEN ABS(points_delta) ELSE 0 END), 0)::text AS points_redeemed
         FROM loyalty_transactions`,
        [],
      );

      const tierRes = await tx.query<{ tier: string | null; count: string }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT current_tier AS tier, COUNT(*)::text AS count
         FROM customer_loyalty
         GROUP BY current_tier
         ORDER BY count DESC`,
        [],
      );

      const row = issuedRes.rows[0]!;
      return {
        points_issued:   parseInt(row.points_issued, 10),
        points_redeemed: parseInt(row.points_redeemed, 10),
        members_by_tier: tierRes.rows.map((r) => ({
          tier:  r.tier,
          count: parseInt(r.count, 10),
        })),
      };
    });
  }
}
