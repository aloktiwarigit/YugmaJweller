import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

export type GstrType = 'gstr1' | 'gstr3b';

interface InvoiceGstrRow {
  id: string;
  invoice_number: string;
  invoice_type: string;
  customer_name: string;
  buyer_gstin: string | null;
  buyer_business_name: string | null;
  seller_state_code: string;
  gst_treatment: string;
  subtotal_paise: bigint | string;
  gst_metal_paise: bigint | string;
  gst_making_paise: bigint | string;
  total_paise: bigint | string;
  cgst_metal_paise: bigint | string;
  sgst_metal_paise: bigint | string;
  cgst_making_paise: bigint | string;
  sgst_making_paise: bigint | string;
  igst_metal_paise: bigint | string;
  igst_making_paise: bigint | string;
  issued_at: Date;
}

const UP_STATE_CODE = '09';

function paiseToRupees(paise: bigint | string | number): string {
  return (Number(paise) / 100).toFixed(2);
}

function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCsv).join(',');
}

const GSTR1_HEADER = csvRow([
  'Invoice Type',
  'GSTIN/UIN of Recipient',
  'Receiver Name',
  'Invoice Number',
  'Invoice Date',
  'Invoice Value (Rs)',
  'Place of Supply',
  'Reverse Charge',
  'HSN Code',
  'Rate (%)',
  'Taxable Value (Rs)',
  'IGST Amount (Rs)',
  'CGST Amount (Rs)',
  'SGST/UTGST Amount (Rs)',
]);

function gstr1Rows(invoice: InvoiceGstrRow): string[] {
  const rows: string[] = [];
  const isB2B = invoice.invoice_type === 'B2B_WHOLESALE' && !!invoice.buyer_gstin;
  const invoiceType = isB2B ? 'B2B' : 'B2CS';
  const gstin = invoice.buyer_gstin ?? '';
  const receiver = invoice.buyer_business_name ?? invoice.customer_name;
  const invoiceDate = formatDateDDMMYYYY(invoice.issued_at);
  const placeOfSupply = invoice.seller_state_code || UP_STATE_CODE;
  const totalRs = paiseToRupees(BigInt(invoice.total_paise));

  const gstMetal = BigInt(invoice.gst_metal_paise);
  const gstMaking = BigInt(invoice.gst_making_paise);
  const isIGST = invoice.gst_treatment === 'IGST';

  if (gstMetal > 0n) {
    const metalTaxable = paiseToRupees((gstMetal * 10000n) / 300n);
    rows.push(csvRow([
      invoiceType,
      gstin,
      receiver,
      invoice.invoice_number,
      invoiceDate,
      totalRs,
      placeOfSupply,
      'N',
      '7113',
      '3',
      metalTaxable,
      isIGST ? paiseToRupees(BigInt(invoice.igst_metal_paise)) : '0.00',
      !isIGST ? paiseToRupees(BigInt(invoice.cgst_metal_paise)) : '0.00',
      !isIGST ? paiseToRupees(BigInt(invoice.sgst_metal_paise)) : '0.00',
    ]));
  }

  if (gstMaking > 0n) {
    const makingTaxable = paiseToRupees((gstMaking * 10000n) / 500n);
    rows.push(csvRow([
      invoiceType,
      gstin,
      receiver,
      invoice.invoice_number,
      invoiceDate,
      totalRs,
      placeOfSupply,
      'N',
      '7113',
      '5',
      makingTaxable,
      isIGST ? paiseToRupees(BigInt(invoice.igst_making_paise)) : '0.00',
      !isIGST ? paiseToRupees(BigInt(invoice.cgst_making_paise)) : '0.00',
      !isIGST ? paiseToRupees(BigInt(invoice.sgst_making_paise)) : '0.00',
    ]));
  }

  return rows;
}

const GSTR3B_HEADER = csvRow([
  'Description',
  'Total Taxable Value (Rs)',
  'Integrated Tax (Rs)',
  'Central Tax (Rs)',
  'State/UT Tax (Rs)',
  'Cess (Rs)',
]);

@Injectable()
export class GstrExportService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async generateGstr1Csv(month: string): Promise<string> {
    this.validateMonth(month);
    const invoices = await this.fetchMonthInvoices(month);
    const lines: string[] = [GSTR1_HEADER];
    for (const inv of invoices) {
      lines.push(...gstr1Rows(inv));
    }
    return lines.join('\r\n');
  }

  async generateGstr3bSummary(month: string): Promise<string> {
    this.validateMonth(month);
    const invoices = await this.fetchMonthInvoices(month);

    let totalTaxable = 0n;
    let totalIgst = 0n;
    let totalCgst = 0n;
    let totalSgst = 0n;

    for (const inv of invoices) {
      totalTaxable += BigInt(inv.subtotal_paise);
      totalIgst += BigInt(inv.igst_metal_paise) + BigInt(inv.igst_making_paise);
      totalCgst += BigInt(inv.cgst_metal_paise) + BigInt(inv.cgst_making_paise);
      totalSgst += BigInt(inv.sgst_metal_paise) + BigInt(inv.sgst_making_paise);
    }

    const lines: string[] = [
      GSTR3B_HEADER,
      csvRow([
        'Outward taxable supplies (other than zero rated, nil rated, exempted)',
        paiseToRupees(totalTaxable),
        paiseToRupees(totalIgst),
        paiseToRupees(totalCgst),
        paiseToRupees(totalSgst),
        '0.00',
      ]),
    ];
    return lines.join('\r\n');
  }

  private validateMonth(month: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException({ code: 'gstr.invalid_month', message: 'month must be YYYY-MM' });
    }
  }

  private async fetchMonthInvoices(month: string): Promise<InvoiceGstrRow[]> {
    const { shopId } = tenantContext.requireCurrent();
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<InvoiceGstrRow>(
        `SELECT
           id, invoice_number, invoice_type,
           customer_name, buyer_gstin, buyer_business_name,
           seller_state_code, gst_treatment,
           subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
           cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
           igst_metal_paise, igst_making_paise,
           issued_at
         FROM invoices
         WHERE shop_id = $1
           AND status = 'ISSUED'
           AND DATE_TRUNC('month', issued_at AT TIME ZONE 'Asia/Kolkata')
               = DATE_TRUNC('month', ($2::text || '-01')::date AT TIME ZONE 'Asia/Kolkata')
         ORDER BY issued_at ASC`,
        [shopId, month],
      );
      return r.rows;
    });
  }
}
