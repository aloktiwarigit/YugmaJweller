import { Injectable, Inject } from '@nestjs/common';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import type { ShopBranding } from './branding';
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem,
  LoyaltySummaryResult, StockAgingResult,
} from '../reports.service';
import { renderDailySummary } from './templates/daily-summary';

const FONT_DIR = path.resolve(__dirname, '../../../../assets/fonts');

export type ReportType =
  | 'daily-summary' | 'outstanding' | 'customer-ltv'
  | 'loyalty-summary' | 'stock-aging';

export type ReportData =
  | DailySummaryResult | OutstandingResult | CustomerLtvItem[]
  | LoyaltySummaryResult | StockAgingResult;

@Injectable()
export class PdfRenderer {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  async render(
    reportType: ReportType,
    data: ReportData,
    branding: ShopBranding,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 60, left: 36, right: 36 },
      bufferPages: true,
    });

    // Register Devanagari fonts; fallback to Helvetica if asset missing.
    try {
      doc.registerFont('Devanagari',      path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf'));
      doc.registerFont('Devanagari-Bold', path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf'));
    } catch {
      doc.registerFont('Devanagari',      'Helvetica');
      doc.registerFont('Devanagari-Bold', 'Helvetica-Bold');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    switch (reportType) {
      case 'daily-summary':
        await renderDailySummary(doc, data as DailySummaryResult, branding, this.storage);
        break;
      // outstanding / customer-ltv / loyalty-summary / stock-aging added in
      // Tasks C7–C10. Until then, throw to fail fast.
      default:
        throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
    }

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
