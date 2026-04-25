import { describe, expect, it } from 'vitest';
import { assertValidInvoiceTransition, INVOICE_TRANSITIONS } from './invoice.state-machine';

describe('invoice state machine', () => {
  it('allows DRAFT → ISSUED', () => {
    expect(() => assertValidInvoiceTransition('DRAFT', 'ISSUED')).not.toThrow();
  });

  it('allows ISSUED → VOIDED (Story 5.11 will gate this elsewhere)', () => {
    expect(() => assertValidInvoiceTransition('ISSUED', 'VOIDED')).not.toThrow();
  });

  it('forbids DRAFT → VOIDED', () => {
    expect(() => assertValidInvoiceTransition('DRAFT', 'VOIDED')).toThrow(/transition/);
  });

  it('forbids VOIDED → anything', () => {
    expect(() => assertValidInvoiceTransition('VOIDED', 'ISSUED')).toThrow(/transition/);
    expect(() => assertValidInvoiceTransition('VOIDED', 'DRAFT')).toThrow(/transition/);
  });

  it('forbids identity transitions', () => {
    expect(() => assertValidInvoiceTransition('DRAFT', 'DRAFT')).toThrow(/transition/);
  });

  it('exports the transition table for documentation', () => {
    expect(INVOICE_TRANSITIONS).toEqual({
      DRAFT:  ['ISSUED'],
      ISSUED: ['VOIDED'],
      VOIDED: [],
    });
  });
});
