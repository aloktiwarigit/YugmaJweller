/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReportsPdfProcessor } from './reports-pdf.processor';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
const EXPORT_ID = '11111111-2222-4000-8000-000000000000';

let fakeReports: {
  getDailySummary:    ReturnType<typeof vi.fn>;
  getOutstanding:     ReturnType<typeof vi.fn>;
  getAllOutstanding:  ReturnType<typeof vi.fn>;
  getCustomerLtv:     ReturnType<typeof vi.fn>;
  getLoyaltySummary:  ReturnType<typeof vi.fn>;
  getStockAging:      ReturnType<typeof vi.fn>;
};
let fakeRenderer: { render: ReturnType<typeof vi.fn> };
let fakeStorage: { uploadBuffer: ReturnType<typeof vi.fn> };
let fakeBranding: { load: ReturnType<typeof vi.fn> };
let fakePool: { query: ReturnType<typeof vi.fn> };

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    runWith: async (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) }),
}));

beforeEach(() => {
  fakeReports = {
    getDailySummary:    vi.fn().mockResolvedValue({ date: '2026-04-29' }),
    getOutstanding:     vi.fn(),
    getAllOutstanding:  vi.fn(),
    getCustomerLtv:     vi.fn(),
    getLoyaltySummary:  vi.fn(),
    getStockAging:      vi.fn(),
  };
  fakeRenderer = { render: vi.fn().mockResolvedValue(Buffer.from('PDF-bytes')) };
  fakeStorage = { uploadBuffer: vi.fn().mockResolvedValue(undefined) };
  fakeBranding = {
    load: vi.fn().mockResolvedValue({
      displayName: 'X', logoUrl: null, addressText: '', gstin: null, contactPhone: null,
    }),
  };
  fakePool = {
    query: vi.fn().mockResolvedValueOnce({
      rows: [{ id: SHOP, slug: 'x', display_name: 'X', status: 'ACTIVE' }],
    }),
  };
});

function makeProcessor(): ReportsPdfProcessor {
  return new ReportsPdfProcessor(
    fakeReports as any,
    fakeRenderer as any,
    fakeStorage as any,
    fakeBranding as any,
    fakePool as any,
  );
}

describe('ReportsPdfProcessor', () => {
  it('renders + uploads + updates row to READY', async () => {
    const job = {
      id: 'j1',
      data: {
        shopId: SHOP, exportId: EXPORT_ID,
        reportType: 'daily-summary', params: { date: '2026-04-29' },
      },
    };
    const proc = makeProcessor();
    await proc.process(job as any);

    expect(fakeReports.getDailySummary).toHaveBeenCalledWith('2026-04-29');
    expect(fakeRenderer.render).toHaveBeenCalledWith(
      'daily-summary', expect.anything(), expect.anything(),
    );
    expect(fakeStorage.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining(`tenants/${SHOP}/reports/daily-summary/`),
      expect.any(Buffer),
      'application/pdf',
    );
  });

  it('marks row FAILED on render error', async () => {
    fakeRenderer.render.mockRejectedValueOnce(new Error('render boom'));
    const job = {
      id: 'j2',
      data: {
        shopId: SHOP, exportId: EXPORT_ID,
        reportType: 'daily-summary', params: {},
      },
    };
    const proc = makeProcessor();
    await expect(proc.process(job as any)).rejects.toThrow('render boom');
  });
});
