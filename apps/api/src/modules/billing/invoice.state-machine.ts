import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'VOIDED';

/**
 * Valid forward transitions. Story 5.11 will add the OWNER-only,
 * within-24h gate around ISSUED→VOIDED at the service layer; this
 * file only encodes the structural transitions.
 */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT:  ['ISSUED'],
  ISSUED: ['VOIDED'],
  VOIDED: [],
};

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canVoid(invoice: { status: InvoiceStatus; issuedAt: Date | null }): boolean {
  if (invoice.status !== 'ISSUED') return false;
  if (!invoice.issuedAt) return false;
  return Date.now() < invoice.issuedAt.getTime() + VOID_WINDOW_MS;
}

export function assertCanVoid(
  invoice: { status: InvoiceStatus; issuedAt: Date | null; id: string },
): void {
  if (invoice.status !== 'ISSUED') {
    throw new UnprocessableEntityException({
      code: 'billing.void.invalid_status',
      message: `Invoice ${invoice.id} is ${invoice.status}; only ISSUED invoices can be voided`,
    });
  }
  if (!invoice.issuedAt || Date.now() >= invoice.issuedAt.getTime() + VOID_WINDOW_MS) {
    const windowClosedAt = invoice.issuedAt
      ? new Date(invoice.issuedAt.getTime() + VOID_WINDOW_MS)
      : null;
    throw new UnprocessableEntityException({
      code: 'billing.void.window_expired',
      message: 'Invoice void window (24h) has expired; issue a credit note instead',
      meta: { issuedAt: invoice.issuedAt, windowClosedAt },
    });
  }
}

export function assertValidInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  const allowed = INVOICE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictException({
      code: 'invoice.invalid_transition',
      message: `Invalid invoice transition: ${from} → ${to}`,
    });
  }
}
