import { ConflictException } from '@nestjs/common';

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
