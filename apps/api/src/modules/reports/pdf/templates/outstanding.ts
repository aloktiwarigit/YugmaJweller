import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { OutstandingResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: string | number): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export async function renderOutstanding(
  doc: PDFKit.PDFDocument,
  data: OutstandingResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const cols = [
    { key: 'invoice', label: 'Invoice',    w: 0.18 },
    { key: 'name',    label: 'Customer',   w: 0.32 },
    { key: 'phone',   label: 'Phone',      w: 0.12 },
    { key: 'total',   label: 'Total (Rs)', w: 0.14 },
    { key: 'due',     label: 'Due (Rs)',   w: 0.15 },
    { key: 'date',    label: 'Issued',     w: 0.09 },
  ];

  // Header row
  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of cols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w, continued: false });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  // Body rows
  doc.font('Devanagari').fontSize(9).fillColor('#1c1917');
  for (const it of data.items) {
    let rowY = doc.y;
    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments (cont.)', storage);
      rowY = doc.y;
    }
    x = left;
    const cells = [
      it.invoice_number,
      it.customer_name,
      it.customer_phone ?? '',
      formatINR(it.total_paise),
      formatINR(it.balance_due_paise),
      formatDate(it.issued_at),
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
    doc.moveTo(left, doc.y).lineTo(right, doc.y)
       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  }

  // Footer per page
  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
