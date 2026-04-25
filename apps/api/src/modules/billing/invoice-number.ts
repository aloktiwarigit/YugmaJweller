import { customAlphabet } from 'nanoid';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateSuffix = customAlphabet(ALPHABET, 6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GS-<first6OfShopId>-<YYYYMMDD UTC>-<nanoid(6, A-Z0-9)>
 * Readable, sortable, unique-per-tenant. UNIQUE(shop_id, invoice_number)
 * is the safety net at the DB layer.
 */
export function generateInvoiceNumber(shopUuid: string, now: Date = new Date()): string {
  if (!UUID_RE.test(shopUuid)) {
    throw new Error(`generateInvoiceNumber: invalid shopId "${shopUuid}"`);
  }
  const prefix = shopUuid.replace(/-/g, '').slice(0, 6).toUpperCase();
  const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
  const mm   = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd   = now.getUTCDate().toString().padStart(2, '0');
  const suffix = generateSuffix();
  return `GS-${prefix}-${yyyy}${mm}${dd}-${suffix}`;
}
