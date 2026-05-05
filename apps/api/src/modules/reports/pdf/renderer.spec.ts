import { describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from './renderer';
import type { ShopBranding } from './branding';
import type { DailySummaryResult } from '../reports.service';

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
