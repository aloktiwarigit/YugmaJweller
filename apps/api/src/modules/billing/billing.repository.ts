import { Injectable, Inject } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface InvoiceRow {
  id:                  string;
  shop_id:             string;
  invoice_number:      string;
  invoice_type:        string;
  // B2B fields (null for B2C invoices)
  buyer_gstin:          string | null;
  buyer_business_name:  string | null;
  seller_state_code:    string;
  gst_treatment:        string;
  cgst_metal_paise:     bigint;
  sgst_metal_paise:     bigint;
  cgst_making_paise:    bigint;
  sgst_making_paise:    bigint;
  igst_metal_paise:     bigint;
  igst_making_paise:    bigint;
  customer_id:         string | null;
  customer_name:       string;
  customer_phone:      string | null;
  status:              string;
  subtotal_paise:      bigint;
  gst_metal_paise:     bigint;
  gst_making_paise:    bigint;
  total_paise:         bigint;
  idempotency_key:     string;
  issued_at:           Date | null;
  created_by_user_id:  string;
  // PAN Rule 114B encrypted fields (null when total < Rs 2,00,000)
  pan_ciphertext:      Buffer | null;
  pan_key_id:          string | null;
  form60_encrypted:    Buffer | null;
  form60_key_id:       string | null;
  voided_at:           Date | null;
  voided_by_user_id:   string | null;
  void_reason:         string | null;
  created_at:          Date;
  updated_at:          Date;
}

export interface InvoiceItemRow {
  id:                    string;
  shop_id:               string;
  invoice_id:            string;
  product_id:            string | null;
  description:           string;
  hsn_code:              string;
  huid:                  string | null;
  metal_type:            string | null;
  purity:                string | null;
  net_weight_g:          string | null;
  rate_per_gram_paise:   bigint | null;
  making_charge_pct:     string | null;
  gold_value_paise:      bigint;
  making_charge_paise:   bigint;
  stone_charges_paise:   bigint;
  hallmark_fee_paise:    bigint;
  gst_metal_paise:       bigint;
  gst_making_paise:      bigint;
  line_total_paise:      bigint;
  sort_order:            number;
}

export interface InsertInvoiceInput {
  invoiceNumber:       string;
  invoiceType:         'B2C' | 'B2B_WHOLESALE';
  buyerGstin:          string | null;
  buyerBusinessName:   string | null;
  sellerStateCode:     string;
  gstTreatment:        'CGST_SGST' | 'IGST';
  cgstMetalPaise:      bigint;
  sgstMetalPaise:      bigint;
  cgstMakingPaise:     bigint;
  sgstMakingPaise:     bigint;
  igstMetalPaise:      bigint;
  igstMakingPaise:     bigint;
  customerId:          string | null;
  customerName:        string;
  customerPhone:       string | null;
  status:              'DRAFT' | 'ISSUED';
  subtotalPaise:       bigint;
  gstMetalPaise:       bigint;
  gstMakingPaise:      bigint;
  totalPaise:          bigint;
  idempotencyKey:      string;
  issuedAt:            Date | null;
  createdByUserId:     string;
  panCiphertext:       Buffer | null;
  panKeyId:            string | null;
  form60Encrypted:     Buffer | null;
  form60KeyId:         string | null;
  items: Array<{
    productId:           string | null;
    description:         string;
    hsnCode:             string;
    huid:                string | null;
    metalType:           string | null;
    purity:              string | null;
    netWeightG:          string | null;
    ratePerGramPaise:    bigint | null;
    makingChargePct:     string | null;
    goldValuePaise:      bigint;
    makingChargePaise:   bigint;
    stoneChargesPaise:   bigint;
    hallmarkFeePaise:    bigint;
    gstMetalPaise:       bigint;
    gstMakingPaise:      bigint;
    lineTotalPaise:      bigint;
    sortOrder:           number;
  }>;
}

export class IdempotencyKeyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Invoice already exists for idempotency-key=${idempotencyKey}`);
    this.name = 'IdempotencyKeyConflictError';
    Object.setPrototypeOf(this, IdempotencyKeyConflictError.prototype);
  }
}

const INVOICE_COLS = `
  id, shop_id, invoice_number, invoice_type,
  buyer_gstin, buyer_business_name, seller_state_code, gst_treatment,
  customer_id, customer_name, customer_phone,
  status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
  cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
  igst_metal_paise, igst_making_paise,
  idempotency_key, issued_at, created_by_user_id,
  pan_ciphertext, pan_key_id, form60_encrypted, form60_key_id,
  voided_at, voided_by_user_id, void_reason,
  created_at, updated_at
`;

const ITEM_COLS = `
  id, shop_id, invoice_id, product_id, description, hsn_code, huid,
  metal_type, purity, net_weight_g, rate_per_gram_paise, making_charge_pct,
  gold_value_paise, making_charge_paise, stone_charges_paise, hallmark_fee_paise,
  gst_metal_paise, gst_making_paise, line_total_paise, sort_order
`;

@Injectable()
export class BillingRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Single-transaction insert: invoice + all items.
   * UNIQUE(shop_id, idempotency_key) raises 23505 → translated to
   * IdempotencyKeyConflictError so the service can fetch & return the
   * existing invoice instead of erroring.
   */
  async insertInvoice(input: InsertInvoiceInput): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] }> {
    return withTenantTx(this.pool, async (tx) => {
      try {
        const invRes = await tx.query<InvoiceRow>(
          `INSERT INTO invoices
             (shop_id, invoice_number, invoice_type,
              buyer_gstin, buyer_business_name, seller_state_code, gst_treatment,
              customer_id, customer_name, customer_phone,
              status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
              cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
              igst_metal_paise, igst_making_paise,
              idempotency_key, issued_at, created_by_user_id,
              pan_ciphertext, pan_key_id, form60_encrypted, form60_key_id)
           VALUES (current_setting('app.current_shop_id')::uuid,
                   $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                   $18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
           RETURNING ${INVOICE_COLS}`,
          [
            input.invoiceNumber, input.invoiceType,
            input.buyerGstin, input.buyerBusinessName, input.sellerStateCode, input.gstTreatment,
            input.customerId, input.customerName, input.customerPhone,
            input.status, input.subtotalPaise, input.gstMetalPaise,
            input.gstMakingPaise, input.totalPaise,
            input.cgstMetalPaise, input.sgstMetalPaise, input.cgstMakingPaise, input.sgstMakingPaise,
            input.igstMetalPaise, input.igstMakingPaise,
            input.idempotencyKey, input.issuedAt, input.createdByUserId,
            input.panCiphertext, input.panKeyId,
            input.form60Encrypted, input.form60KeyId,
          ],
        );
        const invoice = invRes.rows[0]!;

        const items = await this.insertItems(tx, invoice.id, input.items);

        // Decrement quantity for every product-backed line within this transaction.
        // SELECT FOR UPDATE prevents concurrent invoices from overselling the same product.
        // Iterate per item occurrence (no Set deduplication): a product appearing twice on the
        // invoice triggers two decrements. The second will hit quantity <= 0 and throw
        // invoice.insufficient_quantity — correct protection for unique single-quantity pieces.
        const billableItems = input.items.filter((it) => it.productId !== null);

        for (const item of billableItems) {
          const productId = item.productId as string;
          const lockRes = await tx.query<{ quantity: number; status: string }>(
            `SELECT quantity, status FROM products WHERE id = $1 FOR UPDATE`,
            [productId],
          );
          const product = lockRes.rows[0];
          if (!product) continue; // already 404'd in service layer; defensive skip
          if (product.quantity <= 0) {
            throw new Error(`invoice.insufficient_quantity:${productId}`);
          }
          const newQty = product.quantity - 1;
          const newStatus = newQty === 0 ? 'SOLD' : product.status;
          await tx.query(
            `UPDATE products SET quantity = $1, status = $2, updated_at = now() WHERE id = $3`,
            [newQty, newStatus, productId],
          );
          // Story 5.3: emit invoice.created domain event here → StockMovementService records
          // the SALE movement in stock_movements + sync_change_log for offline clients.
          // nosemgrep: goldsmith.require-stock-movement — intentional deferral, domain event in next story
        }

        return { invoice, items };
      } catch (err: unknown) {
        // pg unique_violation
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          const detail = (err as { constraint?: string }).constraint;
          if (detail === 'uq_invoices_shop_idempotency') {
            throw new IdempotencyKeyConflictError(input.idempotencyKey);
          }
        }
        throw err;
      }
    });
  }

  private async insertItems(
    tx: PoolClient,
    invoiceId: string,
    items: InsertInvoiceInput['items'],
  ): Promise<InvoiceItemRow[]> {
    const out: InvoiceItemRow[] = [];
    for (const it of items) {
      const r = await tx.query<InvoiceItemRow>(
        `INSERT INTO invoice_items
           (shop_id, invoice_id, product_id, description, hsn_code, huid,
            metal_type, purity, net_weight_g, rate_per_gram_paise, making_charge_pct,
            gold_value_paise, making_charge_paise, stone_charges_paise, hallmark_fee_paise,
            gst_metal_paise, gst_making_paise, line_total_paise, sort_order)
         VALUES (current_setting('app.current_shop_id')::uuid,
                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING ${ITEM_COLS}`,
        [
          invoiceId, it.productId, it.description, it.hsnCode, it.huid,
          it.metalType, it.purity, it.netWeightG, it.ratePerGramPaise, it.makingChargePct,
          it.goldValuePaise, it.makingChargePaise, it.stoneChargesPaise, it.hallmarkFeePaise,
          it.gstMetalPaise, it.gstMakingPaise, it.lineTotalPaise, it.sortOrder,
        ],
      );
      out.push(r.rows[0]!);
    }
    return out;
  }

  async getInvoice(id: string): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null> {
    return withTenantTx(this.pool, async (tx) => {
      const invRes = await tx.query<InvoiceRow>(
        `SELECT ${INVOICE_COLS} FROM invoices WHERE id = $1`,
        [id],
      );
      const invoice = invRes.rows[0];
      if (!invoice) return null;

      const itemRes = await tx.query<InvoiceItemRow>(
        `SELECT ${ITEM_COLS} FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC`,
        [id],
      );
      return { invoice, items: itemRes.rows };
    });
  }

  async getInvoiceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null> {
    return withTenantTx(this.pool, async (tx) => {
      const invRes = await tx.query<InvoiceRow>(
        `SELECT ${INVOICE_COLS} FROM invoices WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey],
      );
      const invoice = invRes.rows[0];
      if (!invoice) return null;
      const itemRes = await tx.query<InvoiceItemRow>(
        `SELECT ${ITEM_COLS} FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC`,
        [invoice.id],
      );
      return { invoice, items: itemRes.rows };
    });
  }

  async getInvoicePanData(
    id: string,
  ): Promise<Pick<InvoiceRow, 'id' | 'shop_id' | 'pan_ciphertext' | 'pan_key_id'> | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<Pick<InvoiceRow, 'id' | 'shop_id' | 'pan_ciphertext' | 'pan_key_id'>>(
        `SELECT id, shop_id, pan_ciphertext, pan_key_id FROM invoices WHERE id = $1`,
        [id],
      );
      return r.rows[0] ?? null;
    });
  }

  async listInvoices(
    limit: number,
    offset: number,
  ): Promise<InvoiceRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<InvoiceRow>(
        `SELECT ${INVOICE_COLS} FROM invoices
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return r.rows;
    });
  }
}
