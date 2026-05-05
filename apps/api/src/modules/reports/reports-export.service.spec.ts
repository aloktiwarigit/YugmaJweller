import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReportsExportService } from './reports-export.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
const USER = 'uuuuuuuu-bbbb-4000-8000-000000000001';
const EXPORT_ID = '11111111-2222-4000-8000-000000000000';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {
    REPORT_EXPORT_REQUESTED: 'REPORT_EXPORT_REQUESTED',
    REPORT_EXPORT_REGENERATED: 'REPORT_EXPORT_REGENERATED',
  },
}));

let fakeTx: { query: ReturnType<typeof vi.fn> };
let fakeQueue: { add: ReturnType<typeof vi.fn> };
let fakeStorage: { getPresignedReadUrl: ReturnType<typeof vi.fn>; downloadBuffer: ReturnType<typeof vi.fn> };

function makeSvc(): ReportsExportService {
  return new ReportsExportService({} as never, fakeQueue as never, fakeStorage as never);
}

beforeEach(() => {
  fakeTx = { query: vi.fn() };
  fakeQueue = { add: vi.fn().mockResolvedValue(undefined) };
  fakeStorage = {
    getPresignedReadUrl: vi.fn().mockResolvedValue('https://signed.example/readme'),
    downloadBuffer: vi.fn(),
  };
});

describe('ReportsExportService.enqueue', () => {
  it('rejects unknown reportType', async () => {
    const svc = makeSvc();
    await expect(svc.enqueue('unknown' as never, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('inserts row and enqueues BullMQ job', async () => {
    fakeTx.query.mockResolvedValueOnce({ rows: [{ id: EXPORT_ID }] });
    const svc = makeSvc();
    const result = await svc.enqueue('daily-summary', { date: '2026-04-29' });
    expect(result).toEqual({ id: EXPORT_ID, status: 'QUEUED' });
    expect(fakeQueue.add).toHaveBeenCalledWith(
      'render',
      expect.objectContaining({
        shopId: SHOP,
        exportId: EXPORT_ID,
        reportType: 'daily-summary',
        params: { date: '2026-04-29' },
      }),
      expect.any(Object),
    );
  });
});

describe('ReportsExportService.getStatus', () => {
  it('throws NotFound when row missing (RLS-filtered or wrong tenant)', async () => {
    fakeTx.query.mockResolvedValueOnce({ rows: [] });
    const svc = makeSvc();
    await expect(svc.getStatus(EXPORT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns READY with freshly signed downloadUrl when blob within retention', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
        error_message: null,
        created_at: new Date(),
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('READY');
    expect(result.downloadUrl).toBe('https://signed.example/readme');
    expect(result.blobExpiresAt).toBeDefined();
  });

  it('returns READY without downloadUrl when blob older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
        error_message: null,
        created_at: eightDaysAgo,
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('READY');
    expect(result.downloadUrl).toBeUndefined();
  });

  it('returns FAILED with errorMessage', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'FAILED',
        storage_key: null,
        error_message: 'render failed: out of memory',
        created_at: new Date(),
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('render failed: out of memory');
  });
});

describe('ReportsExportService.regenerate', () => {
  it('rejects when export is QUEUED or RUNNING', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'RUNNING',
               storage_key: null, error_message: null, created_at: new Date(), params: {} }],
    });
    const svc = makeSvc();
    await expect(svc.regenerate(EXPORT_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('re-signs without re-rendering when blob fresh', async () => {
    const freshDate = new Date(Date.now() - 86400_000); // 1 day ago
    fakeTx.query.mockResolvedValueOnce({
      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
               storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
               error_message: null, created_at: freshDate, params: {} }],
    });
    fakeStorage.downloadBuffer.mockResolvedValueOnce(Buffer.from([1, 2, 3]));
    const svc = makeSvc();
    const result = await svc.regenerate(EXPORT_ID);
    expect(result.downloadUrl).toBe('https://signed.example/readme');
    expect(fakeQueue.add).not.toHaveBeenCalled();
    expect(fakeStorage.getPresignedReadUrl).toHaveBeenCalledWith('tenants/x/reports/daily-summary/foo.pdf');
  });

  it('re-enqueues when blob is missing', async () => {
    fakeTx.query
      .mockResolvedValueOnce({
        rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
                 storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
                 error_message: null, created_at: new Date(), params: {} }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fakeStorage.downloadBuffer.mockRejectedValueOnce(new Error('blob missing'));
    const svc = makeSvc();
    const result = await svc.regenerate(EXPORT_ID);
    expect(result.status).toBe('QUEUED');
    expect(fakeQueue.add).toHaveBeenCalled();
  });
});
