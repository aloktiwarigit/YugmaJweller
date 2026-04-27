import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { BillingRepository } from './billing.repository';
import type { InvoiceRow, InvoiceItemRow } from './billing.repository';

interface ShopRow {
  display_name: string;
  gstin: string | null;
  address_json: unknown;
  logo_url: string | null;
}

function formatINR(paise: bigint | string | number): string {
  const n = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function buildInvoiceHtml(
  invoice: InvoiceRow,
  items: InvoiceItemRow[],
  shopName: string,
  shopGstin: string | null,
  shopAddress: string,
  shopLogoUrl: string | null,
): string {
  const lineRows = items.map((it) => {
    const huidLabel = it.huid ? ` <span style="font-size:10px;color:#666">HUID: ${it.huid}</span>` : '';
    const weight = it.net_weight_g ? `${it.net_weight_g}g` : '—';
    const rate = it.rate_per_gram_paise ? `₹${formatINR(it.rate_per_gram_paise)}/g` : '—';
    return `
      <tr>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4">
          ${it.description}${huidLabel}
          <br><small style="color:#78716c">${it.metal_type ?? ''} ${it.purity ?? ''}</small>
        </td>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right">${weight}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right">${rate}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right">${it.making_charge_pct ?? '—'}%</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right">₹${formatINR(BigInt(it.gst_metal_paise) + BigInt(it.gst_making_paise))}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right;font-weight:600">₹${formatINR(it.line_total_paise)}</td>
      </tr>`;
  }).join('');

  const logoHtml = shopLogoUrl
    ? `<img src="${shopLogoUrl}" alt="${shopName}" style="height:48px;margin-bottom:8px">`
    : '';

  const isIGST = invoice.gst_treatment === 'IGST';
  const gstSplit = isIGST
    ? `<tr><td style="padding:4px 0;color:#57534e">IGST — धातु (3%) / IGST Metal (3%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.igst_metal_paise)}</td></tr>
       <tr><td style="padding:4px 0;color:#57534e">IGST — मेकिंग (5%) / IGST Making (5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.igst_making_paise)}</td></tr>`
    : `<tr><td style="padding:4px 0;color:#57534e">CGST — धातु (1.5%) / CGST Metal (1.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.cgst_metal_paise)}</td></tr>
       <tr><td style="padding:4px 0;color:#57534e">SGST — धातु (1.5%) / SGST Metal (1.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.sgst_metal_paise)}</td></tr>
       <tr><td style="padding:4px 0;color:#57534e">CGST — मेकिंग (2.5%) / CGST Making (2.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.cgst_making_paise)}</td></tr>
       <tr><td style="padding:4px 0;color:#57534e">SGST — मेकिंग (2.5%) / SGST Making (2.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.sgst_making_paise)}</td></tr>`;

  const buyerBlock = invoice.invoice_type === 'B2B_WHOLESALE' && invoice.buyer_gstin
    ? `<p style="margin:0;color:#57534e;font-size:12px">
         व्यापारी GSTIN / Buyer GSTIN: <strong>${invoice.buyer_gstin}</strong><br>
         ${invoice.buyer_business_name ?? ''}
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${invoice.invoice_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans Devanagari', 'Mukta', Arial, sans-serif; font-size: 14px; color: #1c1917; background: #fff; }
  .container { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 8px 4px; border-bottom: 2px solid #d4a84b; text-align: left; font-size: 12px; color: #57534e; }
  th:not(:first-child) { text-align: right; }
</style>
</head>
<body>
<div class="container">
  <table style="margin-bottom:24px">
    <tr>
      <td style="vertical-align:top">
        ${logoHtml}
        <h1 style="font-size:20px;font-weight:700;color:#1c1917">${shopName}</h1>
        <p style="color:#57534e;font-size:12px;margin-top:4px">${shopAddress}</p>
        ${shopGstin ? `<p style="color:#57534e;font-size:12px;margin-top:2px">GSTIN: ${shopGstin}</p>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <h2 style="font-size:18px;font-weight:700;color:#d4a84b">Invoice / बिल</h2>
        <p style="font-size:13px;color:#57534e;margin-top:4px">#${invoice.invoice_number}</p>
        <p style="font-size:13px;color:#57534e">${formatDate(invoice.issued_at)}</p>
      </td>
    </tr>
  </table>

  <table style="margin-bottom:16px">
    <tr>
      <td>
        <p style="font-size:12px;color:#78716c;margin-bottom:2px">ग्राहक / Customer</p>
        <p style="font-weight:600;font-size:16px">${invoice.customer_name}</p>
        ${invoice.customer_phone ? `<p style="color:#57534e;font-size:13px">${invoice.customer_phone}</p>` : ''}
        ${buyerBlock}
      </td>
    </tr>
  </table>

  <table style="margin-bottom:20px">
    <thead>
      <tr>
        <th style="width:35%">विवरण / Description</th>
        <th>वज़न / Wt</th>
        <th>दर / Rate</th>
        <th>मेकिंग %</th>
        <th>GST</th>
        <th>कुल / Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <table style="max-width:320px;margin-left:auto;margin-bottom:24px">
    <tr><td style="padding:4px 0;color:#57534e">Subtotal / कुल मूल्य</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.subtotal_paise)}</td></tr>
    ${gstSplit}
    <tr style="border-top:2px solid #d4a84b;font-weight:700;font-size:16px">
      <td style="padding:8px 0">कुल योग / Grand Total</td>
      <td style="padding:8px 0;text-align:right">₹${formatINR(invoice.total_paise)}</td>
    </tr>
  </table>

  <p style="font-size:11px;color:#78716c;border-top:1px solid #e7e5e4;padding-top:12px;text-align:center">
    HUID verified under BIS Hallmarking Scheme — भारतीय मानक ब्यूरो हॉलमार्किंग योजना के अंतर्गत HUID सत्यापित
  </p>
</div>
</body>
</html>`;
}

@Injectable()
export class InvoicePdfService {
  constructor(
    @Inject(BillingRepository) private readonly repo: BillingRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async generateInvoicePdf(
    invoiceId: string,
  ): Promise<{ storageKey: string; publicUrl: string }> {
    const ctx = tenantContext.requireCurrent();
    const data = await this.repo.getInvoice(invoiceId);
    if (!data) throw new NotFoundException({ code: 'invoice.not_found' });

    const shopRow = await this.fetchShopRow();
    const address = shopRow.address_json
      ? this.formatAddress(shopRow.address_json as Record<string, unknown>)
      : '';

    const html = buildInvoiceHtml(
      data.invoice,
      data.items,
      shopRow.display_name,
      shopRow.gstin,
      address,
      shopRow.logo_url,
    );

    const key = `tenants/${ctx.shopId}/invoices/${invoiceId}.html`;
    await this.storage.uploadBuffer(key, Buffer.from(html, 'utf8'), 'text/html; charset=utf-8');
    const publicUrl = await this.storage.getPublicUrl(key);
    return { storageKey: key, publicUrl };
  }

  private async fetchShopRow(): Promise<ShopRow> {
    const ctx = tenantContext.requireCurrent();
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ShopRow>(
        `SELECT display_name, gstin, address_json, logo_url FROM shops WHERE id = $1`,
        [ctx.shopId],
      );
      if (!r.rows[0]) throw new NotFoundException({ code: 'shop.not_found' });
      return r.rows[0];
    });
  }

  private formatAddress(addr: Record<string, unknown>): string {
    return [addr['line1'], addr['line2'], addr['city'], addr['state'], addr['pincode']]
      .filter(Boolean)
      .join(', ');
  }
}
