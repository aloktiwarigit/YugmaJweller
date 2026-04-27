import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { BillingRepository } from './billing.repository';
import { InvoicePdfService } from './invoice-pdf.service';

function formatINR(paise: bigint | string | number): string {
  return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise) / 100)}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function toWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

export interface ShareWhatsAppResult {
  whatsappUrl: string;
  pdfUrl: string;
}

@Injectable()
export class ShareService {
  constructor(
    @Inject(InvoicePdfService) private readonly pdfSvc: InvoicePdfService,
    @Inject(BillingRepository) private readonly repo: BillingRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async shareInvoiceWhatsApp(invoiceId: string): Promise<ShareWhatsAppResult> {
    const ctx = tenantContext.requireCurrent();

    const data = await this.repo.getInvoice(invoiceId);
    if (!data) throw new NotFoundException({ code: 'invoice.not_found' });

    const { publicUrl } = await this.pdfSvc.generateInvoicePdf(invoiceId);

    const { invoice_number, customer_name, customer_phone, total_paise, issued_at } = data.invoice;
    const total = formatINR(total_paise);
    const date = formatDate(issued_at);
    const message = `नमस्ते ${customer_name}! आपका invoice तैयार है। Invoice #${invoice_number} — ${total} — ${date}। देखें: ${publicUrl}`;

    const waPhone = toWaPhone(customer_phone);
    const waBase = waPhone ? `https://wa.me/${waPhone}` : 'https://wa.me/';
    const whatsappUrl = `${waBase}?text=${encodeURIComponent(message)}`;

    // AiSensy BSP stub — full integration in Epic 13

    await auditLog(this.pool, {
      action: AuditAction.INVOICE_SHARED,
      subjectType: 'invoice',
      subjectId: invoiceId,
      metadata: { method: 'whatsapp' },
      actorUserId: ctx.authenticated ? ctx.userId : undefined,
    });

    return { whatsappUrl, pdfUrl: publicUrl };
  }
}
