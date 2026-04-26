import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { decryptColumn, deserializeEnvelope } from '@goldsmith/crypto-envelope';
import type { KmsAdapter } from '@goldsmith/crypto-envelope';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { buildCtrDocument, renderCtrText } from '@goldsmith/compliance';
import type { CtrDocument } from '@goldsmith/compliance';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface CtrReportResult {
  text:     string;
  document: CtrDocument;
}

@Injectable()
export class ComplianceReportsService {
  constructor(
    @Inject('PG_POOL')    private readonly pool: Pool,
    @Inject('KMS_ADAPTER') private readonly kms: KmsAdapter,
  ) {}

  async getCtrReport(
    customerId: string | null,
    customerPhone: string | null,
    month: string,
  ): Promise<CtrReportResult> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    if (ctx.role !== 'shop_admin') {
      throw new ForbiddenException({ code: 'ctr.owner_only' });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new NotFoundException({ code: 'ctr.invalid_month' });
    }

    let doc: CtrDocument;
    let customerName = '';
    let customerPhoneResult = customerPhone ?? '';

    await withTenantTx(this.pool, async (tx) => {
      // Fetch shop profile (GSTIN + name)
      const shopRes = await tx.query<{ display_name: string; gstin: string | null }>( // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT display_name, gstin
         FROM shops
         WHERE id = current_setting('app.current_shop_id', true)::uuid`,
        [],
      );
      if (!shopRes.rows[0]) throw new NotFoundException({ code: 'shop.not_found' });
      const shop = shopRes.rows[0];

      // Fetch PMLA aggregates for this customer + month
      const aggRes = await tx.query<{ cash_total_paise: string; aggregate_date: string }>( // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT cash_total_paise::text, aggregate_date::text
         FROM pmla_aggregates
         WHERE aggregate_month = $1
           AND (customer_id IS NOT DISTINCT FROM $2::uuid)
           AND (customer_phone IS NOT DISTINCT FROM $3)
         ORDER BY aggregate_date`,
        [month, customerId, customerPhone],
      );

      if (aggRes.rows.length === 0) {
        throw new NotFoundException({ code: 'ctr.no_aggregates' });
      }

      // Fetch invoices for transaction list (cash payments only)
      const invoiceRes = await tx.query<{ // nosemgrep: goldsmith.require-tenant-transaction
        invoice_number:    string;
        issued_at:         Date | null;
        customer_name:     string;
        customer_phone:    string | null;
        pan_ciphertext:    Buffer | null;
        pan_key_id:        string | null;
      }>(
        `SELECT i.invoice_number, i.issued_at, i.customer_name, i.customer_phone,
                i.pan_ciphertext, i.pan_key_id
         FROM invoices i
         WHERE i.customer_id IS NOT DISTINCT FROM $1::uuid
           AND i.customer_phone IS NOT DISTINCT FROM $2
           AND DATE_TRUNC('month', i.issued_at AT TIME ZONE 'Asia/Kolkata') =
               DATE_TRUNC('month', ($3 || '-01')::date)
           AND i.status = 'ISSUED'
           AND EXISTS (
             SELECT 1 FROM payments p
             WHERE p.invoice_id = i.id AND p.method = 'CASH' AND p.status = 'CONFIRMED'
           )
         ORDER BY i.issued_at`,
        [customerId, customerPhone, month],
      );

      // Decrypt PAN for OWNER (OWNER access enforced above via role check)
      let panDecrypted: string | null = null;
      const firstInvoice = invoiceRes.rows[0];
      if (firstInvoice?.pan_ciphertext && firstInvoice?.pan_key_id) {
        try {
          const envelope = deserializeEnvelope(firstInvoice.pan_ciphertext, firstInvoice.pan_key_id);
          panDecrypted = await decryptColumn(this.kms, envelope);
        } catch {
          // PAN decrypt failed — leave as null rather than failing the report
        }
      }

      if (firstInvoice) {
        customerName = firstInvoice.customer_name;
        customerPhoneResult = firstInvoice.customer_phone ?? customerPhone ?? '';
      }

      // Build transaction list from aggregates (one entry per day)
      // Match invoices by date for invoice numbers
      const invoicesByDate = new Map<string, string>();
      for (const inv of invoiceRes.rows) {
        if (inv.issued_at) {
          const dateStr = inv.issued_at.toISOString().slice(0, 10);
          invoicesByDate.set(dateStr, inv.invoice_number);
        }
      }

      const transactions = aggRes.rows.map(agg => ({
        date:          agg.aggregate_date,
        amountPaise:   BigInt(agg.cash_total_paise),
        invoiceNumber: invoicesByDate.get(agg.aggregate_date) ?? '-',
      }));

      doc = buildCtrDocument({
        shop:     { gstin: shop.gstin ?? 'N/A', name: shop.display_name },
        customer: { name: customerName, phone: customerPhoneResult, panDecrypted },
        monthStr: month,
        transactions,
      });
    });

    // Audit CTR access — no PAN in audit log
    await auditLog(this.pool, {
      action:      AuditAction.CTR_ACCESSED,
      subjectType: 'pmla_aggregate',
      actorUserId: ctx.userId,
      metadata: {
        customerId:    customerId ?? null,
        customerPhone: customerPhone ?? null,
        month,
      },
    });

    const text = renderCtrText(doc!);
    return { text, document: doc! };
  }
}
