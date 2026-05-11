import type { ShopBranding } from './branding';

/**
 * Draws shop address + GSTIN + page N of M at the bottom of the current page.
 * Called once per page; uses absolute Y near the page bottom rather than doc.y.
 */
export function drawFooter(
  doc: PDFKit.PDFDocument,
  branding: ShopBranding,
  pageNum: number,
  totalPages: number,
): void {
  // Footer reserves ~24pt above the bottom margin boundary for two 8pt lines (address+GSTIN)
  // plus the right-aligned page count. Subtracting 24 from the printable-area bottom keeps
  // every line above the gutter; the right-aligned "Page N of M" sits on the same Y as the
  // address line, two-line text on the left and one-line on the right.
  const footerY = doc.page.height - doc.page.margins.bottom - 24;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.font('Devanagari').fontSize(8).fillColor('#78716c');

  // Address line (left)
  if (branding.addressText) {
    doc.text(branding.addressText, left, footerY, {
      width: right - left - 100,
      lineBreak: false,
      ellipsis: true,
    });
  }

  // GSTIN line under address
  if (branding.gstin) {
    doc.text(`GSTIN: ${branding.gstin}`, left, footerY + 10, {
      width: right - left - 100,
    });
  }

  // Page N of M (right)
  doc.text(`Page ${pageNum} of ${totalPages}`, left, footerY, {
    align: 'right',
    width: right - left,
  });

  doc.fillColor('#1c1917');
}
