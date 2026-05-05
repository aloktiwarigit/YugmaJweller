import type { ShopBranding } from './branding';
import type { StoragePort } from '@goldsmith/integrations-storage';

const GOLD = '#B58A3C';

/**
 * Draws shop branding header on the current page.
 * Returns the Y coordinate just below the header (where body content should start).
 *
 * Logo is fetched once per render via storage.downloadBuffer if logoUrl points to
 * a tenant blob key; if logoUrl is empty/null/external-http, no logo is drawn.
 */
export async function drawHeader(
  doc: PDFKit.PDFDocument,
  branding: ShopBranding,
  reportTitle: string,
  storage: StoragePort,
): Promise<number> {
  const startY = doc.y;

  // Logo (left)
  let logoBottom = startY;
  if (branding.logoUrl && branding.logoUrl.startsWith('tenants/')) {
    try {
      const buf = await storage.downloadBuffer(branding.logoUrl);
      doc.image(buf, doc.page.margins.left, startY, { fit: [80, 40] });
      logoBottom = startY + 40;
    } catch {
      // Best-effort; missing logo blob doesn't fail the render
    }
  }

  // Shop name + report title (centre)
  doc.font('Devanagari-Bold').fontSize(18).fillColor('#1c1917');
  doc.text(branding.displayName, doc.page.margins.left + 90, startY, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 90,
  });
  doc.font('Devanagari').fontSize(14).fillColor(GOLD);
  doc.text(reportTitle, doc.page.margins.left + 90, doc.y + 2);

  // Generated-at (right)
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.font('Devanagari').fontSize(9).fillColor('#78716c');
  doc.text(`Generated: ${generatedAt}`, doc.page.margins.left, startY, {
    align: 'right',
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
  });

  // Divider line
  const dividerY = Math.max(logoBottom, doc.y) + 8;
  doc.moveTo(doc.page.margins.left, dividerY)
     .lineTo(doc.page.width - doc.page.margins.right, dividerY)
     .strokeColor(GOLD).lineWidth(1).stroke();

  doc.fillColor('#1c1917').strokeColor('#000');
  doc.y = dividerY + 12;
  return doc.y;
}
