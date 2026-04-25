import { describe, expect, it } from 'vitest';
import {
  CreateInvoiceSchema,
  InvoiceLineSchema,
  InvoiceResponseSchema,
} from './invoice.schema';

describe('InvoiceLineSchema', () => {
  it('accepts a minimal valid line', () => {
    const out = InvoiceLineSchema.parse({
      description: 'Gold Chain 22K',
      makingChargePct: '12.00',
    });
    expect(out.makingChargePct).toBe('12.00');
    expect(out.stoneChargesPaise).toBe('0');
    expect(out.hallmarkFeePaise).toBe('0');
  });

  it('rejects HUID with lowercase letters', () => {
    expect(() =>
      InvoiceLineSchema.parse({ description: 'x', huid: 'ab12cd' }),
    ).toThrow(/HUID/);
  });

  it('rejects negative weight', () => {
    expect(() =>
      InvoiceLineSchema.parse({ description: 'x', netWeightG: '-1.0000' }),
    ).toThrow();
  });

  it('rejects non-numeric paise strings', () => {
    expect(() =>
      InvoiceLineSchema.parse({ description: 'x', stoneChargesPaise: '12.5' }),
    ).toThrow();
  });

  it('accepts up to 4 decimal places of weight', () => {
    expect(() =>
      InvoiceLineSchema.parse({ description: 'x', netWeightG: '10.0001' }),
    ).not.toThrow();
  });

  it('rejects more than 4 decimal places of weight', () => {
    expect(() =>
      InvoiceLineSchema.parse({ description: 'x', netWeightG: '10.00001' }),
    ).toThrow();
  });
});

describe('CreateInvoiceSchema', () => {
  it('requires customerName + at least one line', () => {
    expect(() => CreateInvoiceSchema.parse({ lines: [] })).toThrow();
    expect(() => CreateInvoiceSchema.parse({ customerName: '' })).toThrow();
  });

  it('rejects more than 50 lines', () => {
    const lines = Array.from({ length: 51 }, () => ({ description: 'x' }));
    expect(() => CreateInvoiceSchema.parse({ customerName: 'A', lines })).toThrow();
  });

  it('rejects an Indian phone that does not start with 6-9', () => {
    expect(() =>
      CreateInvoiceSchema.parse({
        customerName: 'A',
        customerPhone: '5234567890',
        lines: [{ description: 'x' }],
      }),
    ).toThrow();
  });

  it('accepts a valid Indian phone (starts 6-9, 10 digits)', () => {
    expect(() =>
      CreateInvoiceSchema.parse({
        customerName: 'A',
        customerPhone: '9876543210',
        lines: [{ description: 'x' }],
      }),
    ).not.toThrow();
  });
});

describe('InvoiceResponseSchema', () => {
  it('accepts paise fields as decimal strings', () => {
    const sample = {
      id: '00000000-0000-4000-8000-000000000001',
      shopId: '00000000-0000-4000-8000-000000000002',
      invoiceNumber: 'GS-ABC123-20260425-XYZ789',
      invoiceType: 'B2C' as const,
      customerId: null,
      customerName: 'Test',
      customerPhone: null,
      status: 'ISSUED' as const,
      subtotalPaise: '6842000',
      gstMetalPaise: '20526',
      gstMakingPaise: '4105',
      totalPaise: '6866631',
      idempotencyKey: 'k1',
      issuedAt: '2026-04-25T00:00:00.000Z',
      createdByUserId: '00000000-0000-4000-8000-000000000003',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
      lines: [],
    };
    expect(() => InvoiceResponseSchema.parse(sample)).not.toThrow();
  });
});
