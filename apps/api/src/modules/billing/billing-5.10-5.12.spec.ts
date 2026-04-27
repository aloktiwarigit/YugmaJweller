import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GstrExportService } from './gstr-export.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { ShareService } from './share.service';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ shopId: 'shop-1', authenticated: true, userId: 'user-1' }),
  },
}));
vi.mock('@goldsmith/audit', () => ({
  AuditAction: { INVOICE_SHARED: 'INVOICE_SHARED' },
  auditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@goldsmith/db', () => ({ withTenantTx: vi.fn() }));

const B2C_INVOICE = {
  id: 'inv-1', invoice_number: 'INV-001', invoice_type: 'B2C',
  customer_name: 'Ramesh Sharma', buyer_gstin: null, buyer_business_name: null,
  seller_state_code: '09', gst_treatment: 'CGST_SGST',
  subtotal_paise: 100000n, gst_metal_paise: 3000n, gst_making_paise: 600n, total_paise: 103600n,
  cgst_metal_paise: 1500n, sgst_metal_paise: 1500n, cgst_making_paise: 300n, sgst_making_paise: 300n,
  igst_metal_paise: 0n, igst_making_paise: 0n,
  issued_at: new Date('2026-04-15T09:00:00Z'),
};

const IGST_INVOICE = {
  ...B2C_INVOICE,
  invoice_number: 'INV-002',
  invoice_type: 'B2B_WHOLESALE',
  buyer_gstin: '29AABCT1332L1ZL',
  gst_treatment: 'IGST',
  cgst_metal_paise: 0n, sgst_metal_paise: 0n, cgst_making_paise: 0n, sgst_making_paise: 0n,
  igst_metal_paise: 3000n, igst_making_paise: 600n,
};

const ITEM_ROW = {
  description: 'Gold Ring', huid: 'ABC123', net_weight_g: '5.0000',
  rate_per_gram_paise: 600000n, making_charge_pct: '12.00', metal_type: 'GOLD', purity: '22K',
  gst_metal_paise: 3000n, gst_making_paise: 600n, line_total_paise: 103600n,
};
const SHOP_ROW = { display_name: 'Test Shop', gstin: '09AABCT1332L1ZL', address_json: null, logo_url: null };

function makeTx(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as never;
}

// ─── GstrExportService ───────────────────────────────────────────────────────

describe('GstrExportService', () => {
  let svc: GstrExportService;

  beforeEach(async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([B2C_INVOICE])));
    svc = new GstrExportService({} as never);
  });

  it('GSTR-1 CSV includes invoice number', async () => { expect(await svc.generateGstr1Csv('2026-04')).toContain('INV-001'); });
  it('GSTR-1 emits metal row at rate 3%', async () => {
    const csv = await svc.generateGstr1Csv('2026-04');
    expect(csv.split('\r\n').slice(1).filter(Boolean).find(l => l.split(',')[9] === '3')).toBeTruthy();
  });
  it('GSTR-1 emits making row at rate 5%', async () => {
    const csv = await svc.generateGstr1Csv('2026-04');
    expect(csv.split('\r\n').slice(1).filter(Boolean).find(l => l.split(',')[9] === '5')).toBeTruthy();
  });
  it('GSTR-1 HSN is 7113', async () => { expect(await svc.generateGstr1Csv('2026-04')).toContain('7113'); });
  it('GSTR-1 CGST present for intrastate invoice', async () => { expect(await svc.generateGstr1Csv('2026-04')).toContain('15.00'); });

  it('GSTR-1 IGST: IGST columns non-zero, CGST/SGST zero', async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
    const csv = await svc.generateGstr1Csv('2026-04');
    const dataLine = csv.split('\r\n').slice(1).find(l => l.length > 0);
    expect(dataLine).toBeTruthy();
    const cells = dataLine!.split(',');
    expect(cells[11]).toBe('30.00');  // IGST metal = 3000 paise = Rs 30.00
    expect(cells[12]).toBe('0.00');   // CGST = 0
    expect(cells[13]).toBe('0.00');   // SGST = 0
  });

  it('GSTR-1 IGST: Place of Supply is buyer state (29 = Karnataka)', async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
    const csv = await svc.generateGstr1Csv('2026-04');
    // Place of Supply (col 6) should be '29' (buyer GSTIN prefix), not '09' (seller UP)
    const dataLine = csv.split('\r\n').slice(1).find(l => l.length > 0);
    expect(dataLine!.split(',')[6]).toBe('29');
  });

  it('GSTR-1 B2B invoice type is B2B not B2CS', async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
    const csv = await svc.generateGstr1Csv('2026-04');
    const dataLine = csv.split('\r\n').slice(1).find(l => l.length > 0);
    expect(dataLine!.split(',')[0]).toBe('B2B');
  });

  it('GSTR-1 empty month returns header only', async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([])));
    const csv = await svc.generateGstr1Csv('2026-03');
    expect(csv.split('\r\n').filter(Boolean).length).toBe(1); // header only
  });

  it('GSTR-3B subtotal correct', async () => { expect(await svc.generateGstr3bSummary('2026-04')).toContain('1000.00'); });
  it('GSTR-3B CGST total correct (1500+300=1800 paise = Rs 18)', async () => { expect(await svc.generateGstr3bSummary('2026-04')).toContain('18.00'); });
  it('GSTR-3B aggregates multiple invoices', async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([B2C_INVOICE, B2C_INVOICE])));
    const csv = await svc.generateGstr3bSummary('2026-04');
    expect(csv).toContain('2000.00'); // 2 × 100000 paise = Rs 2000.00 subtotal
  });

  it('rejects invalid month', async () => { await expect(svc.generateGstr1Csv('invalid')).rejects.toThrow(); });
  it('rejects month 00', async () => { await expect(svc.generateGstr1Csv('2026-00')).rejects.toThrow(); });
  it('returns header + data rows for non-empty month', async () => {
    expect((await svc.generateGstr1Csv('2026-04')).split('\r\n').filter(Boolean).length).toBeGreaterThan(1);
  });
});

// ─── InvoicePdfService ───────────────────────────────────────────────────────

describe('InvoicePdfService', () => {
  let storage: { uploadBuffer: ReturnType<typeof vi.fn>; getPublicUrl: ReturnType<typeof vi.fn> };
  let repo: { getInvoice: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const db = await import('@goldsmith/db');
    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [SHOP_ROW] }) } as never)
    );
    repo = { getInvoice: vi.fn().mockResolvedValue({ invoice: { ...B2C_INVOICE, customer_phone: '9876543210' }, items: [ITEM_ROW] }) };
    storage = { uploadBuffer: vi.fn().mockResolvedValue(undefined), getPublicUrl: vi.fn().mockResolvedValue('https://stub/invoice.html') };
  });

  it('uploads to tenants/<shopId>/invoices/<id>.html', async () => {
    const svc = new InvoicePdfService(repo as never, {} as never, storage as never);
    expect((await svc.generateInvoicePdf('inv-1')).storageKey).toBe('tenants/shop-1/invoices/inv-1.html');
  });
  it('HTML includes invoice number', async () => {
    const svc = new InvoicePdfService(repo as never, {} as never, storage as never);
    await svc.generateInvoicePdf('inv-1');
    expect((storage.uploadBuffer.mock.calls[0] as [string, Buffer])[1].toString('utf-8')).toContain('INV-001');
  });
  it('HTML includes HUID per line item', async () => {
    const svc = new InvoicePdfService(repo as never, {} as never, storage as never);
    await svc.generateInvoicePdf('inv-1');
    expect((storage.uploadBuffer.mock.calls[0] as [string, Buffer])[1].toString('utf-8')).toContain('ABC123');
  });
  it('HTML includes BIS Hallmarking footer', async () => {
    const svc = new InvoicePdfService(repo as never, {} as never, storage as never);
    await svc.generateInvoicePdf('inv-1');
    expect((storage.uploadBuffer.mock.calls[0] as [string, Buffer])[1].toString('utf-8')).toContain('BIS Hallmarking');
  });
  it('HTML shows CGST for intrastate, not IGST', async () => {
    const svc = new InvoicePdfService(repo as never, {} as never, storage as never);
    await svc.generateInvoicePdf('inv-1');
    const html = (storage.uploadBuffer.mock.calls[0] as [string, Buffer])[1].toString('utf-8');
    expect(html).toContain('CGST');
    expect(html).not.toContain('IGST');
  });
  it('throws NotFoundException for missing invoice', async () => {
    const svc = new InvoicePdfService({ getInvoice: vi.fn().mockResolvedValue(null) } as never, {} as never, storage as never);
    await expect(svc.generateInvoicePdf('x')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'invoice.not_found' }) });
  });
});

// ─── ShareService ────────────────────────────────────────────────────────────

describe('ShareService', () => {
  const makeRepo = (phone: string | null = '9876543210') => ({
    getInvoice: vi.fn().mockResolvedValue({
      invoice: { ...B2C_INVOICE, customer_phone: phone, invoice_number: 'INV-42', total_paise: 500000n },
      items: [],
    }),
  });
  const makePdfSvc = () => ({ generateInvoicePdf: vi.fn().mockResolvedValue({ storageKey: 'k', publicUrl: 'https://stub/inv.html' }) });

  it('builds wa.me URL with 91-prefixed 10-digit phone', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo() as never, {} as never).shareInvoiceWhatsApp('inv-1')).whatsappUrl).toContain('wa.me/919876543210');
  });
  it('normalises 0-prefixed STD-code phone (11 digits) to 91-prefix', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo('09876543210') as never, {} as never).shareInvoiceWhatsApp('inv-1')).whatsappUrl).toContain('wa.me/919876543210');
  });
  it('URL contains encoded message with invoice number', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo() as never, {} as never).shareInvoiceWhatsApp('inv-1')).whatsappUrl).toContain('INV-42');
  });
  it('uses wa.me/ without phone when null', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo(null) as never, {} as never).shareInvoiceWhatsApp('inv-1')).whatsappUrl).toMatch(/https:\/\/wa\.me\/\?text=/);
  });
  it('returns null phone for unrecognised format → wa.me/ without recipient', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo('123') as never, {} as never).shareInvoiceWhatsApp('inv-1')).whatsappUrl).toMatch(/https:\/\/wa\.me\/\?text=/);
  });
  it('returns pdfUrl from generateInvoicePdf', async () => {
    expect((await new ShareService(makePdfSvc() as never, makeRepo() as never, {} as never).shareInvoiceWhatsApp('inv-1')).pdfUrl).toBe('https://stub/inv.html');
  });
  it('calls auditLog with INVOICE_SHARED action', async () => {
    const { auditLog } = await import('@goldsmith/audit');
    await new ShareService(makePdfSvc() as never, makeRepo() as never, {} as never).shareInvoiceWhatsApp('inv-1');
    expect(vi.mocked(auditLog)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'INVOICE_SHARED', metadata: expect.objectContaining({ method: 'whatsapp' }) }));
  });
  it('throws NotFoundException for missing invoice', async () => {
    await expect(new ShareService(makePdfSvc() as never, { getInvoice: vi.fn().mockResolvedValue(null) } as never, {} as never).shareInvoiceWhatsApp('x')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'invoice.not_found' }) });
  });
});
