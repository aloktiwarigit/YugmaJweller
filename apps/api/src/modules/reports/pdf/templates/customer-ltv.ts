import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { CustomerLtvItem } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: string): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export async function renderCustomerLtv(
  doc: PDFKit.PDFDocument,
  items: CustomerLtvItem[],
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'शीर्ष ग्राहक / Top Customers (Lifetime Value)', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const cols = [
    { label: 'Rank',          w: 0.08 },
    { label: 'Customer',      w: 0.45 },
    { label: 'Phone',         w: 0.22 },
    { label: 'LTV (Rs)',      w: 0.25 },
  ];

  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of cols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
  items.forEach((it, idx) => {
    let rowY = doc.y;
    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      rowY = doc.y;
    }
    x = left;
    const cells = [
      `${idx + 1}`,
      it.name,
      it.phone,
      formatINR(it.ltv_paise),
    ];
    for (let i = 0; i < cols.length; i++) {
      doc.text(cells[i]!, x, rowY, {
        width: tableWidth * cols[i]!.w,
        ellipsis: true,
        lineBreak: false,
      });
      x += tableWidth * cols[i]!.w;
    }
    doc.moveDown(0.5);
  });

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
