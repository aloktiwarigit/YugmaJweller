import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { customAlphabet } from 'nanoid';
import { withTenantTx } from '@goldsmith/db';
import { buildUrdSelfInvoice } from '@goldsmith/compliance';
import { auditLog, AuditAction } from '@goldsmith/audit';

const generateSuffix = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecordUrdPurchaseDto {
  customerId?:     string;
  customerName:    string;
  customerPhone?:  string;
  metalType:       'GOLD' | 'SILVER';
  purity:          string;
  weightG:         string;
  agreedRatePaise: string;
}

export interface UrdPurchaseRow {
  id:                    string;
  shop_id:               string;
  customer_id:           string | null;
  customer_name:         string;
  customer_phone:        string | null;
  metal_type:            string;
  purity:                string;
  weight_g:              string;
  agreed_rate_paise:     bigint;
  gold_value_paise:      bigint;
  rcm_gst_paise:         bigint;
  net_to_customer_paise: bigint;
  self_invoice_number:   string;
  self_invoice_text:     string;
  linked_invoice_id:     string | null;
  recorded_by_user_id:   string;
  created_at:            Date;
}

export interface UrdPurchaseResponse {
  id: string; shopId: string; customerId: string | null; customerName: string;
  customerPhone: string | null; metalType: string; purity: string; weightG: string;
  agreedRatePaise: string; goldValuePaise: string; rcmGstPaise: string;
  netToCustomerPaise: string; selfInvoiceNumber: string; selfInvoiceText: string;
  linkedInvoiceId: string | null; recordedByUserId: string; createdAt: string;
}

function toResponse(r: UrdPurchaseRow): UrdPurchaseResponse {
  return {
    id: r.id, shopId: r.shop_id, customerId: r.customer_id, customerName: r.customer_name,
    customerPhone: r.customer_phone, metalType: r.metal_type, purity: r.purity, weightG: r.weight_g,
    agreedRatePaise: r.agreed_rate_paise.toString(), goldValuePaise: r.gold_value_paise.toString(),
    rcmGstPaise: r.rcm_gst_paise.toString(), netToCustomerPaise: r.net_to_customer_paise.toString(),
    selfInvoiceNumber: r.self_invoice_number, selfInvoiceText: r.self_invoice_text,
    linkedInvoiceId: r.linked_invoice_id, recordedByUserId: r.recorded_by_user_id,
    createdAt: r.created_at.toISOString(),
  };
}

const URD_COLS = `id, shop_id, customer_id, customer_name, customer_phone, metal_type, purity, weight_g,
  agreed_rate_paise, gold_value_paise, rcm_gst_paise, net_to_customer_paise,
  self_invoice_number, self_invoice_text, linked_invoice_id, recorded_by_user_id, created_at`;

@Injectable()
export class UrdService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async recordUrdPurchase(
    ctx: { userId: string; shopId: string },
    dto: RecordUrdPurchaseDto,
  ): Promise<UrdPurchaseResponse> {
    const shopRes = await this.pool.query<{ display_name: string; gstin: string | null }>(
      'SELECT display_name, gstin FROM shops WHERE id = $1', [ctx.shopId],
    );
    const shop = shopRes.rows[0];
    if (!shop) throw new NotFoundException({ code: 'shop.not_found' });
    if (!shop.gstin) throw new UnprocessableEntityException({ code: 'urd.shop_gstin_required' });
    if (!UUID_RE.test(ctx.shopId)) throw new UnprocessableEntityException({ code: 'urd.invalid_shop_id' });
    const now = new Date();
    const shopPrefix = ctx.shopId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
    const mm   = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd   = now.getUTCDate().toString().padStart(2, '0');
    const selfInvoiceNumber = `URD-${shopPrefix}-${yyyy}${mm}${dd}-${generateSuffix()}`;
    const result = buildUrdSelfInvoice({
      shopName: shop.display_name, shopGstin: shop.gstin,
      customerName: dto.customerName, customerPhone: dto.customerPhone ?? null,
      metalType: dto.metalType, purity: dto.purity, weightG: dto.weightG,
      agreedRatePaise: BigInt(dto.agreedRatePaise), invoiceDate: now, invoiceNumber: selfInvoiceNumber,
    });
    let urdRow: UrdPurchaseRow;
    await withTenantTx(this.pool, async (tx) => {
      const res = await tx.query<UrdPurchaseRow>(
        `INSERT INTO urd_purchases
           (shop_id, customer_id, customer_name, customer_phone, metal_type, purity, weight_g,
            agreed_rate_paise, gold_value_paise, rcm_gst_paise, net_to_customer_paise,
            self_invoice_number, self_invoice_text, recorded_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING ${URD_COLS}`,
        [dto.customerId ?? null, dto.customerName, dto.customerPhone ?? null,
         dto.metalType, dto.purity, dto.weightG, BigInt(dto.agreedRatePaise),
         result.goldValuePaise, result.rcmGstPaise, result.netToCustomerPaise,
         selfInvoiceNumber, result.selfInvoiceText, ctx.userId],
      );
      urdRow = res.rows[0]!;
    });
    void auditLog(this.pool, {
      actorUserId: ctx.userId, action: AuditAction.URD_PURCHASE_RECORDED,
      subjectType: 'urd_purchase', subjectId: urdRow!.id,
      after: {
        metalType: dto.metalType, purity: dto.purity, weightG: dto.weightG,
        goldValuePaise: result.goldValuePaise.toString(), rcmGstPaise: result.rcmGstPaise.toString(),
        netToCustomerPaise: result.netToCustomerPaise.toString(), selfInvoiceNumber,
      },
    });
    return toResponse(urdRow!);
  }

  async applyUrdToInvoice(
    ctx: { userId: string; shopId: string },
    urdPurchaseId: string,
    invoiceId: string,
  ): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      const urdRes = await tx.query<{ id: string; linked_invoice_id: string | null; net_to_customer_paise: bigint }>(
        'SELECT id, linked_invoice_id, net_to_customer_paise FROM urd_purchases WHERE id = $1 FOR UPDATE',
        [urdPurchaseId],
      );
      const urd = urdRes.rows[0];
      if (!urd) throw new NotFoundException({ code: 'urd.not_found' });
      if (urd.linked_invoice_id !== null) throw new ConflictException({ code: 'urd.already_applied' });
      const invRes = await tx.query<{ id: string }>(
        'SELECT id FROM invoices WHERE id = $1', [invoiceId],
      );
      if (!invRes.rows[0]) throw new NotFoundException({ code: 'invoice.not_found' });
      await tx.query(
        'UPDATE urd_purchases SET linked_invoice_id = $1 WHERE id = $2',
        [invoiceId, urdPurchaseId],
      );
      await tx.query(
        `INSERT INTO payments (shop_id, invoice_id, method, amount_paise, created_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, 'OLD_GOLD', $2, $3)`,
        [invoiceId, urd.net_to_customer_paise, ctx.userId],
      );
    });
    void auditLog(this.pool, {
      actorUserId: ctx.userId, action: AuditAction.URD_APPLIED_TO_INVOICE,
      subjectType: 'urd_purchase', subjectId: urdPurchaseId, after: { invoiceId },
    });
  }

  async listUrdPurchases(
    _ctx: { shopId: string },
    opts: { page?: number; pageSize?: number } = {},
  ): Promise<UrdPurchaseResponse[]> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const res = await this.pool.query<UrdPurchaseRow>(
      `SELECT ${URD_COLS} FROM urd_purchases ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize],
    );
    return res.rows.map(toResponse);
  }

  async getSelfInvoice(
    _ctx: { shopId: string },
    urdPurchaseId: string,
  ): Promise<{ selfInvoiceText: string; selfInvoiceNumber: string }> {
    const res = await this.pool.query<{ self_invoice_text: string; self_invoice_number: string }>(
      'SELECT self_invoice_text, self_invoice_number FROM urd_purchases WHERE id = $1', [urdPurchaseId],
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundException({ code: 'urd.not_found' });
    return { selfInvoiceText: row.self_invoice_text, selfInvoiceNumber: row.self_invoice_number };
  }
}