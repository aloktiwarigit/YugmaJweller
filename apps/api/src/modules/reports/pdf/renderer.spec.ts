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

describe('PdfRenderer.render(loyalty-summary)', () => {
  it('produces a non-empty PDF buffer', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = {
      points_issued: 5000, points_redeemed: 1200,
      members_by_tier: [
        { tier: 'GOLD',   count: 12 },
        { tier: 'SILVER', count: 8 },
        { tier: null,     count: 3 },
      ],
    };
    const buf = await renderer.render('loyalty-summary', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

describe('PdfRenderer.render(stock-aging)', () => {
  it('produces a non-empty PDF buffer with bucket summary + items', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = {
      buckets: [
        { label: '<30d',   count: 2, totalWeightMg: '8000', totalCostPaise: '8000000' },
        { label: '30-60d', count: 1, totalWeightMg: '50000', totalCostPaise: '500000' },
        { label: '60-90d', count: 1, totalWeightMg: '4000',  totalCostPaise: '0' },
        { label: '90d+',   count: 1, totalWeightMg: '8000',  totalCostPaise: '8000000' },
      ],
      items: [
        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
          weightG: '5.000', daysInStock: 10, bucket: '<30d',
          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
      ],
    };
    const buf = await renderer.render('stock-aging', data as never, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders multi-page stock-aging without overflow', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: `p${i}`, sku: `R-${String(i).padStart(3, '0')}`,
      metal: 'GOLD', purity: '22K', weightG: '5.000',
      daysInStock: i + 1, bucket: '<30d' as const,
      costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z',
    }));
    const data = {
      buckets: [
        { label: '<30d',   count: 60, totalWeightMg: '300000', totalCostPaise: '300000000' },
        { label: '30-60d', count: 0,  totalWeightMg: '0',       totalCostPaise: '0' },
        { label: '60-90d', count: 0,  totalWeightMg: '0',       totalCostPaise: '0' },
        { label: '90d+',   count: 0,  totalWeightMg: '0',       totalCostPaise: '0' },
      ],
      items,
    };
    const buf = await renderer.render('stock-aging', data as never, branding);
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
