import { describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from './renderer';
import type { ShopBranding } from './branding';
import type { DailySummaryResult, OutstandingResult } from '../reports.service';

const mockStorage = {
  downloadBuffer: vi.fn().mockRejectedValue(new Error('no logo')),
  uploadBuffer: vi.fn(),
  getPublicUrl: vi.fn(),
  getPresignedReadUrl: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  deleteBlob: vi.fn(),
};

const branding: ShopBranding = {
  displayName: 'टेस्ट ज्वैलर्स',
  logoUrl: null,
  addressText: 'Ayodhya, UP, 224001',
  gstin: '09ABCDE1234F1Z5',
  contactPhone: '9876543210',
};

describe('PdfRenderer.render(daily-summary)', () => {
  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data: DailySummaryResult = {
      date: '2026-04-29',
      total_paise: '500000', cash_paise: '300000',
      upi_paise: '200000', other_paise: '0',
      invoice_count: 3, gold_weight_mg: '15000',
    };
    const buf = await renderer.render('daily-summary', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

describe('PdfRenderer.render(outstanding)', () => {
  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data: OutstandingResult = {
      total: 1, page: 1, limit: 100,
      items: [{
        id: 'i1', invoice_number: 'GS-2026-0001',
        customer_name: 'राज कुमार', customer_phone: '9876543210',
        total_paise: '100000', balance_due_paise: '50000',
        issued_at: '2026-04-01T10:00:00.000Z',
      }],
    };
    const buf = await renderer.render('outstanding', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders multi-page outstanding without overflow', async () => {
    const renderer = new PdfRenderer(mockStorage);
    // Generate enough rows to force at least one page break.
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`, invoice_number: `GS-2026-${String(i).padStart(4, '0')}`,
      customer_name: `Customer ${i}`, customer_phone: `90000${String(i).padStart(5, '0')}`,
      total_paise: '500000', balance_due_paise: '250000',
      issued_at: '2026-04-01T10:00:00.000Z',
    }));
    const data = { total: 40, page: 1, limit: 100, items };
    const buf = await renderer.render('outstanding', data, branding);
    expect(buf.length).toBeGreaterThan(2000); // multi-page PDF will be larger
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

describe('PdfRenderer.render(customer-ltv)', () => {
  it('produces a non-empty PDF buffer', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = [
      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
    ];
    const buf = await renderer.render('customer-ltv', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
