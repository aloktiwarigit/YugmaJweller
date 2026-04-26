import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { customAlphabet } from 'nanoid';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { assertCanVoid, canVoid } from './invoice.state-machine';
import type { InvoiceRow } from './billing.repository';

const generateCreditSuffix = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

export interface CreditNoteRow {
  id:                   string;
  shop_id:              string;
  original_invoice_id:  string;
  credit_number:        string;
  reason:               string;
  total_paise:          bigint;
  issued_at:            Date;
  issued_by_user_id:    string;
  created_at:           Date;
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

@Injectable()
export class VoidService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async voidInvoice(
    ctx: { userId: string; role: string; shopId: string },
    invoiceId: string,
    dto: { reason: string },
  ): Promise<InvoiceRow> {
    if (ctx.role !== 'shop_admin') {
      throw new ForbiddenException({ code: 'billing.void.role_required' });
    }

    let voidedInvoice: InvoiceRow;

    await withTenantTx(this.pool, async (tx) => {
      // 1. Lock invoice row to prevent concurrent voids
      const invRes = await tx.query<InvoiceRow>(
        `SELECT ${INVOICE_COLS} FROM invoices WHERE id = $1 FOR UPDATE`,
        [invoiceId],
      );
      const invoice = invRes.rows[0];
      if (!invoice) throw new NotFoundException({ code: 'invoice.not_found' });

      // 2. Assert void is valid (status + 24h window)
      assertCanVoid({ status: invoice.status as 'DRAFT' | 'ISSUED' | 'VOIDED', issuedAt: invoice.issued_at, id: invoice.id });

      // 3. Update invoice to VOIDED
      const updRes = await tx.query<InvoiceRow>(
        `UPDATE invoices
         SET status = 'VOIDED',
             voided_at = now(),
             voided_by_user_id = $1,
             void_reason = $2,
             updated_at = now()
         WHERE id = $3
         RETURNING ${INVOICE_COLS}`,
        [ctx.userId, dto.reason, invoiceId],
      );
      voidedInvoice = updRes.rows[0]!;

      // 4. Fetch product-backed line items for inventory restock
      const itemRes = await tx.query<{ product_id: string }>(
        `SELECT product_id FROM invoice_items WHERE invoice_id = $1 AND product_id IS NOT NULL`,
        [invoiceId],
      );

      // 5. Restock each product atomically (same tx — mirrors billing.repository.ts decrement pattern)
      for (const { product_id: productId } of itemRes.rows) {
        const prodRes = await tx.query<{ quantity: number; status: string }>(
          `SELECT quantity, status FROM products WHERE id = $1 FOR UPDATE`,
          [productId],
        );
        const prod = prodRes.rows[0];
        if (!prod) continue;

        const newQty = prod.quantity + 1;
        // Reactivate product if it was auto-SOLD when invoiced
        const newStatus = prod.status === 'SOLD' ? 'IN_STOCK' : prod.status;
        await tx.query(
          `UPDATE products SET quantity = $1, status = $2, updated_at = now() WHERE id = $3`,
          [newQty, newStatus, productId],
        );

        // Record compensating ADJUSTMENT_IN stock movement
        const beforeQty = prod.quantity;
        await tx.query(
          `INSERT INTO stock_movements
             (shop_id, product_id, type, reason, quantity_delta, balance_before, balance_after,
              source_name, source_id, recorded_by_user_id, recorded_at)
           VALUES (current_setting('app.current_shop_id', true)::uuid,
                   $1, 'ADJUSTMENT_IN', $2, 1, $3, $4, 'invoice_void', $5, $6, now())`,
          [productId, `Invoice voided: ${invoiceId}`, beforeQty, newQty, invoiceId, ctx.userId],
        );
      }

      // 6. Reverse PMLA cash aggregate for any CASH payments on this invoice
      const payRes = await tx.query<{ amount_paise: bigint; recorded_at: Date }>(
        `SELECT amount_paise, recorded_at
         FROM payments
         WHERE invoice_id = $1 AND method = 'CASH'`,
        [invoiceId],
      );

      for (const pay of payRes.rows) {
        // aggregate_date is the IST calendar date the payment was recorded
        const payDateIst = new Date(pay.recorded_at.getTime() + 5.5 * 60 * 60 * 1000);
        const aggDateStr = payDateIst.toISOString().slice(0, 10); // YYYY-MM-DD
        await tx.query(
          `UPDATE pmla_aggregates
           SET cash_total_paise = GREATEST(0, cash_total_paise - $1),
               invoice_count    = GREATEST(0, invoice_count - 1),
               updated_at       = now()
           WHERE shop_id = current_setting('app.current_shop_id', true)::uuid
             AND aggregate_date = $2
             AND (
               (customer_id = $3 AND $3 IS NOT NULL)
               OR (customer_id IS NULL AND customer_phone = $4 AND $4 IS NOT NULL)
             )`,
          [pay.amount_paise, aggDateStr, invoice.customer_id ?? null, invoice.customer_phone ?? null],
        );
      }
    });

    void auditLog(this.pool, {
      actorUserId:  ctx.userId,
      action:       AuditAction.INVOICE_VOIDED,
      subjectType:  'invoice',
      subjectId:    invoiceId,
      before:       { status: 'ISSUED' },
      after:        { status: 'VOIDED', voidReason: dto.reason },
    });

    return voidedInvoice!;
  }

  async issueCreditNote(
    ctx: { userId: string; role: string; shopId: string },
    originalInvoiceId: string,
    dto: { reason: string },
  ): Promise<CreditNoteRow> {
    if (ctx.role !== 'shop_admin') {
      throw new ForbiddenException({ code: 'billing.void.role_required' });
    }

    let creditNote: CreditNoteRow;

    await withTenantTx(this.pool, async (tx) => {
      // 1. Fetch original invoice (no lock needed — we're only inserting a new row)
      const invRes = await tx.query<{ id: string; status: string; issued_at: Date | null; total_paise: bigint; shop_id: string }>(
        `SELECT id, status, issued_at, total_paise, shop_id FROM invoices WHERE id = $1`,
        [originalInvoiceId],
      );
      const invoice = invRes.rows[0];
      if (!invoice) throw new NotFoundException({ code: 'invoice.not_found' });

      // 2. Status must be ISSUED
      if (invoice.status !== 'ISSUED') {
        throw new NotFoundException({ code: 'invoice.not_found' });
      }

      // 3. If still within 24h window, caller should use void instead
      if (canVoid({ status: 'ISSUED', issuedAt: invoice.issued_at })) {
        throw new ConflictException({ code: 'billing.credit_note.use_void_instead' });
      }

      // 4. Generate credit number: CN-{first6OfShopId}-{YYYYMMDD}-{nanoid(6)}
      const now = new Date();
      const shopPrefix = ctx.shopId.replace(/-/g, '').slice(0, 6).toUpperCase();
      const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
      const mm   = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd   = now.getUTCDate().toString().padStart(2, '0');
      const creditNumber = `CN-${shopPrefix}-${yyyy}${mm}${dd}-${generateCreditSuffix()}`;

      // 5. Insert credit note; unique index (shop_id, original_invoice_id) prevents duplicates
      try {
        const cnRes = await tx.query<CreditNoteRow>(
          `INSERT INTO credit_notes
             (shop_id, original_invoice_id, credit_number, reason, total_paise, issued_by_user_id)
           VALUES (current_setting('app.current_shop_id', true)::uuid,
                   $1, $2, $3, $4, $5)
           RETURNING id, shop_id, original_invoice_id, credit_number, reason, total_paise,
                     issued_at, issued_by_user_id, created_at`,
          [originalInvoiceId, creditNumber, dto.reason, invoice.total_paise, ctx.userId],
        );
        creditNote = cnRes.rows[0]!;
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          throw new ConflictException({ code: 'billing.credit_note.already_issued' });
        }
        throw err;
      }
    });

    void auditLog(this.pool, {
      actorUserId:  ctx.userId,
      action:       AuditAction.CREDIT_NOTE_ISSUED,
      subjectType:  'credit_note',
      subjectId:    creditNote!.id,
      after:        { originalInvoiceId, reason: dto.reason },
    });

    return creditNote!;
  }
}
