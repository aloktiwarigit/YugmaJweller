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
import { renderOutstanding } from './templates/outstanding';
import { renderCustomerLtv } from './templates/customer-ltv';
import { renderLoyaltySummary } from './templates/loyalty-summary';
import { renderStockAging } from './templates/stock-aging';

const FONT_DIR = path.resolve(__dirname, '../../../../assets/fonts');

export const REPORT_TYPES = [
  'daily-summary', 'outstanding', 'customer-ltv',
  'loyalty-summary', 'stock-aging',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

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
    } catch (err) {
      if (process.env['NODE_ENV'] === 'production') {
        // Hindi-first content is non-negotiable per CLAUDE.md. Helvetica cannot render
        // Devanagari script — silently substituting it would ship blank-rectangle PDFs.
        throw new Error(
          `PdfRenderer: Devanagari font not found at ${FONT_DIR}. ` +
          `Deploy assets before rendering. Cause: ${(err as Error).message}`,
        );
      }
      // Dev/CI fallback: PDFs render with Latin glyphs only; sufficient for smoke tests.
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
      case 'outstanding':
        await renderOutstanding(doc, data as OutstandingResult, branding, this.storage);
        break;
      case 'customer-ltv':
        await renderCustomerLtv(doc, data as CustomerLtvItem[], branding, this.storage);
        break;
      case 'loyalty-summary':
        await renderLoyaltySummary(doc, data as LoyaltySummaryResult, branding, this.storage);
        break;
      case 'stock-aging':
        await renderStockAging(doc, data as StockAgingResult, branding, this.storage);
        break;
      // All 5 templates implemented. The default branch is a defensive fail-safe;
      // it is unreachable from any valid `ReportType` value.
      default:
        throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
    }

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
