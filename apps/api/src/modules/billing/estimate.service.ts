import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface EstimateLineItem {
  productId?:          string | null;
  description:         string;
  metalType?:          string | null;
  purity?:             string | null;
  netWeightG?:         string | null;
  goldValuePaise:      string;
  makingChargePaise:   string;
  stoneChargesPaise:   string;
  hallmarkFeePaise:    string;
  gstPaise:            string;
  lineTotalPaise:      string;
}

export interface CreateEstimateInput {
  customerId?:          string | null;
  lineItems:            EstimateLineItem[];
  goldRatePaisePerGram: bigint;
  subtotalPaise:        bigint;
  gstPaise:             bigint;
  totalPaise:           bigint;
  expiresAt?:           Date | null;
}

export interface EstimateResponse {
  id:                     string;
  shopId:                 string;
  customerId:             string | null;
  lineItems:              EstimateLineItem[];
  goldRatePaisePerGram:   string;
  subtotalPaise:          string;
  gstPaise:               string;
  totalPaise:             string;
  status:                 'draft' | 'sent' | 'converted' | 'expired';
  expiresAt:              string | null;
  convertedInvoiceId:     string | null;
  createdByUserId:        string;
  createdAt:              string;
}

interface EstimateRow {
  id:                       string;
  shop_id:                  string;
  customer_id:              string | null;
  line_items:               EstimateLineItem[];
  gold_rate_paise_per_gram: bigint;
  subtotal_paise:           bigint;
  gst_paise:                bigint;
  total_paise:              bigint;
  status:                   string;
  expires_at:               Date | null;
  converted_invoice_id:     string | null;
  created_by_user_id:       string;
  created_at:               Date;
}

function rowToResponse(row: EstimateRow): EstimateResponse {
  return {
    id:                   row.id,
    shopId:               row.shop_id,
    customerId:           row.customer_id,
    lineItems:            row.line_items,
    goldRatePaisePerGram: row.gold_rate_paise_per_gram.toString(),
    subtotalPaise:        row.subtotal_paise.toString(),
    gstPaise:             row.gst_paise.toString(),
    totalPaise:           row.total_paise.toString(),
    status:               row.status as EstimateResponse['status'],
    expiresAt:            row.expires_at?.toISOString() ?? null,
    convertedInvoiceId:   row.converted_invoice_id,
    createdByUserId:      row.created_by_user_id,
    createdAt:            row.created_at.toISOString(),
  };
}

@Injectable()
export class EstimateService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async createEstimate(input: CreateEstimateInput): Promise<EstimateResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    if (input.totalPaise <= 0n) {
      throw new BadRequestException({ code: 'estimate.total_must_be_positive' });
    }

    const row = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<EstimateRow>(
        `INSERT INTO estimates
           (shop_id, customer_id, line_items, gold_rate_paise_per_gram,
            subtotal_paise, gst_paise, total_paise, expires_at, created_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid,
                 $1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
           id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
           subtotal_paise, gst_paise, total_paise, status, expires_at,
           converted_invoice_id, created_by_user_id, created_at`,
        [
          input.customerId ?? null,
          JSON.stringify(input.lineItems),
          input.goldRatePaisePerGram,
          input.subtotalPaise,
          input.gstPaise,
          input.totalPaise,
          input.expiresAt ?? null,
          ctx.userId,
        ],
      );
      return r.rows[0]!;
    });

    void auditLog(this.pool, {
      action: AuditAction.ESTIMATE_CREATED,
      subjectType: 'estimate',
      subjectId: row.id,
      actorUserId: ctx.userId,
      after: { total_paise: row.total_paise.toString(), status: row.status },
    }).catch(() => undefined);

    return rowToResponse(row);
  }

  async getEstimate(id: string, shopId: string): Promise<EstimateResponse> {
    const row = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<EstimateRow>(
        `SELECT id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
                subtotal_paise, gst_paise, total_paise, status, expires_at,
                converted_invoice_id, created_by_user_id, created_at
         FROM estimates WHERE id = $1`,
        [id],
      );
      return r.rows[0] ?? null;
    });

    if (!row || row.shop_id !== shopId) {
      throw new NotFoundException({ code: 'estimate.not_found' });
    }
    return rowToResponse(row);
  }

  async listEstimates(shopId: string, limit = 50, offset = 0): Promise<EstimateResponse[]> {
    const rows = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<EstimateRow>(
        `SELECT id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
                subtotal_paise, gst_paise, total_paise, status, expires_at,
                converted_invoice_id, created_by_user_id, created_at
         FROM estimates
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(limit, 100), offset],
      );
      return r.rows;
    });

    void shopId; // RLS already scopes to current tenant; shopId used for type safety only
    return rows.map(rowToResponse);
  }

  async expireEstimate(id: string, shopId: string): Promise<EstimateResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    const row = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<EstimateRow>(
        `UPDATE estimates
         SET status = 'expired'
         WHERE id = $1 AND status IN ('draft','sent')
         RETURNING
           id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
           subtotal_paise, gst_paise, total_paise, status, expires_at,
           converted_invoice_id, created_by_user_id, created_at`,
        [id],
      );
      return r.rows[0] ?? null;
    });

    if (!row || row.shop_id !== shopId) {
      throw new NotFoundException({ code: 'estimate.not_found' });
    }

    void auditLog(this.pool, {
      action: AuditAction.ESTIMATE_EXPIRED,
      subjectType: 'estimate',
      subjectId: id,
      actorUserId: ctx.userId,
    }).catch(() => undefined);

    return rowToResponse(row);
  }

  async markConverted(id: string, invoiceId: string, shopId: string): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    const r = await withTenantTx(this.pool, async (tx) => {
      const res = await tx.query<{ id: string }>(
        `UPDATE estimates
         SET status = 'converted', converted_invoice_id = $1
         WHERE id = $2 AND status NOT IN ('converted','expired')
         RETURNING id`,
        [invoiceId, id],
      );
      return res.rows[0] ?? null;
    });

    if (!r) {
      throw new NotFoundException({ code: 'estimate.not_found_or_already_converted' });
    }

    void shopId;

    void auditLog(this.pool, {
      action: AuditAction.ESTIMATE_CONVERTED,
      subjectType: 'estimate',
      subjectId: id,
      actorUserId: ctx.userId,
      after: { converted_invoice_id: invoiceId },
    }).catch(() => undefined);
  }
}
