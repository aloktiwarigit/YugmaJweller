import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { StockAgingResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatGrams(mg: string): string {
  return `${(Number(mg) / 1000).toFixed(3)} g`;
}

function formatINR(paise: string): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export async function renderStockAging(
  doc: PDFKit.PDFDocument,
  data: StockAgingResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'पुराना स्टॉक / Stock Aging', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;

  // Bucket summary
  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
  doc.text('आयु सारांश / Age Summary', left, doc.y);
  doc.moveDown(0.3);

  const bucketCols = [
    { label: 'Bucket',    w: 0.20 },
    { label: 'Items',     w: 0.20 },
    { label: 'Weight',    w: 0.30 },
    { label: 'Cost (Rs)', w: 0.30 },
  ];
  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of bucketCols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
  for (const b of data.buckets) {
    const y = doc.y;
    x = left;
    const cells = [b.label, `${b.count}`, formatGrams(b.totalWeightMg), formatINR(b.totalCostPaise)];
    for (let i = 0; i < bucketCols.length; i++) {
      doc.text(cells[i]!, x, y, { width: tableWidth * bucketCols[i]!.w });
      x += tableWidth * bucketCols[i]!.w;
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);

  // Item list
  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
  doc.text('प्रत्येक उत्पाद / Per-Product Detail', left, doc.y);
  doc.moveDown(0.3);

  const itemCols = [
    { label: 'SKU',     w: 0.15 },
    { label: 'Metal',   w: 0.10 },
    { label: 'Purity',  w: 0.10 },
    { label: 'Weight',  w: 0.13 },
    { label: 'Days',    w: 0.10 },
    { label: 'Bucket',  w: 0.13 },
    { label: 'Cost',    w: 0.15 },
    { label: 'Listed',  w: 0.14 },
  ];
  doc.font('Devanagari-Bold').fontSize(9).fillColor('#57534e');
  x = left;
  for (const c of itemCols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(8).fillColor('#1c1917');
  for (const it of data.items) {
    let rowY = doc.y;
    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      await drawHeader(doc, branding, 'पुराना स्टॉक / Stock Aging (cont.)', storage);
      rowY = doc.y;
    }
    x = left;
    const cells = [
      it.sku,
      it.metal,
      it.purity,
      it.weightG,
      `${it.daysInStock}`,
      it.bucket,
      it.costPaise === null ? '—' : formatINR(it.costPaise),
      it.firstListedAt.slice(0, 10),
    ];
    for (let i = 0; i < itemCols.length; i++) {
      doc.text(cells[i]!, x, rowY, {
        width: tableWidth * itemCols[i]!.w,
        ellipsis: true,
        lineBreak: false,
      });
      x += tableWidth * itemCols[i]!.w;
    }
    doc.moveDown(0.4);
  }

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
