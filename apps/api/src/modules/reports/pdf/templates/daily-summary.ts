import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { DailySummaryResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: bigint | string | number): string {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function formatGrams(mg: string | number): string {
  return `${(Number(mg) / 1000).toFixed(3)} g`;
}

export async function renderDailySummary(
  doc: PDFKit.PDFDocument,
  data: DailySummaryResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, `दैनिक बिक्री / Daily Summary — ${data.date}`, storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const labelX = left;

  doc.font('Devanagari').fontSize(12).fillColor('#1c1917');

  const rows: [label: string, value: string][] = [
    ['कुल बिक्री / Total Sales',   formatINR(data.total_paise)],
    ['नकद / Cash',                  formatINR(data.cash_paise)],
    ['UPI',                          formatINR(data.upi_paise)],
    ['अन्य / Other',                 formatINR(data.other_paise)],
    ['चालान संख्या / Invoice Count', `${data.invoice_count}`],
    ['सोना बिका / Gold Sold',        formatGrams(data.gold_weight_mg)],
  ];

  for (const [label, value] of rows) {
    const y = doc.y;
    doc.text(label, labelX, y, { width: right - left - 120 });
    doc.text(value, labelX, y, {
      width: right - left,
      align: 'right',
    });
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y)
       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }

  // Footer on this single page
  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
