import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { LoyaltySummaryResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

export async function renderLoyaltySummary(
  doc: PDFKit.PDFDocument,
  data: LoyaltySummaryResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'लॉयल्टी कार्यक्रम / Loyalty Programme', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // Totals card
  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
  doc.text('अंक सारांश / Points Summary', left, doc.y);
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
  const totalRows: [string, string][] = [
    ['जारी / Issued',      `${data.points_issued}`],
    ['भुनाए / Redeemed',   `${data.points_redeemed}`],
    ['शुद्ध / Net',         `${data.points_issued - data.points_redeemed}`],
  ];
  for (const [label, value] of totalRows) {
    const y = doc.y;
    doc.text(label, left, y);
    const afterLabel = doc.y;
    doc.text(value, left, y, { width: right - left, align: 'right' });
    doc.y = Math.max(afterLabel, doc.y);
    doc.moveDown(0.4);
  }

  doc.moveDown(0.5);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.5);

  // Tier breakdown
  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
  doc.text('स्तर के अनुसार / By Tier', left, doc.y);
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
  for (const t of data.members_by_tier) {
    const y = doc.y;
    doc.text(t.tier ?? 'UNTIERED', left, y);
    const afterLabel = doc.y;
    doc.text(`${t.count}`, left, y, { width: right - left, align: 'right' });
    doc.y = Math.max(afterLabel, doc.y);
    doc.moveDown(0.4);
  }

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
