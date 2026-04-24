import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { InventoryBulkImportProcessor } from './inventory.bulk-import.processor';

const SHOP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'user-owner-1';
const JOB_ID  = 'job-1111-1111-1111-1111-111111111111';
const IKEY    = 'ikey-abc';

const tenant: Tenant = { id: SHOP_ID, slug: 'a', display_name: 'Test', status: 'ACTIVE' };
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_ID, tenant, authenticated: true,
  userId: USER_ID, role: 'shop_admin',
};

const VALID_CSV = Buffer.from(
  'sku,category,metal,purity,gross_weight,net_weight\n' +
  'RING-001,Rings,GOLD,22K,10.5000,9.0000\n',
);
const INVALID_CSV = Buffer.from(
  'sku,category,metal,purity,gross_weight,net_weight\n' +
  ',Rings,BRONZE,22K,10.5000,9.0000\n',
);

const repoMock = {
  createMany: vi.fn().mockResolvedValue({ succeeded: 1, failedRows: [] }),
  findCategoryByName: vi.fn().mockResolvedValue(null),
};

const storageMock = {
  downloadBuffer: vi.fn().mockResolvedValue(VALID_CSV),
  uploadBuffer: vi.fn().mockResolvedValue(undefined),
  getPresignedReadUrl: vi.fn().mockResolvedValue('https://stub/errors.csv'),
};

const poolMock = {} as Pool;

function makeRedis(get: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(get),
    set: vi.fn().mockResolvedValue('OK'),
    hset: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as import('ioredis').default;
}

function makeProcessor(redis = makeRedis()) {
  return new InventoryBulkImportProcessor(
    repoMock as never,
    storageMock as never,
    poolMock,
    redis,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue(ctx as never);
});

describe('InventoryBulkImportProcessor', () => {
  describe('handle — idempotency', () => {
    it('returns early and skips download if idempotency key already in Redis', async () => {
      const cached = JSON.stringify({ jobId: JOB_ID, status: 'completed', total: 1, processed: 1, succeeded: 1, failed: 0 });
      const redis = makeRedis(cached);
      const proc = makeProcessor(redis);

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'tenants/a/bulk-import/job/input.csv', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(storageMock.downloadBuffer).not.toHaveBeenCalled();
    });

    it('sets idempotency key in Redis before processing', async () => {
      const redis = makeRedis(null);
      const proc = makeProcessor(redis);

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'tenants/a/bulk-import/job/input.csv', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(redis.set).toHaveBeenCalledWith(
        `idempotency:bulk-import:${IKEY}`,
        expect.any(String),
        'EX',
        86400,
      );
    });
  });

  describe('handle — CSV validation', () => {
    it('inserts valid rows via repo.createMany', async () => {
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(repoMock.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sku: 'RING-001', metal: 'GOLD', shopId: SHOP_ID }),
        ]),
      );
    });

    it('does not call createMany when all rows are invalid', async () => {
      storageMock.downloadBuffer.mockResolvedValueOnce(INVALID_CSV);
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(repoMock.createMany).not.toHaveBeenCalled();
    });

    it('uploads error CSV when there are invalid rows', async () => {
      storageMock.downloadBuffer.mockResolvedValueOnce(INVALID_CSV);
      repoMock.createMany.mockResolvedValueOnce({ succeeded: 0, failedRows: [] });
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(storageMock.uploadBuffer).toHaveBeenCalledWith(
        expect.stringContaining(`tenants/${SHOP_ID}/bulk-import/${JOB_ID}/errors.csv`),
        expect.any(Buffer),
        'text/csv',
      );
    });
  });

  describe('handle — Redis progress', () => {
    it('writes completed status to Redis hash', async () => {
      const redis = makeRedis();
      const proc = makeProcessor(redis);

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(redis.hset).toHaveBeenCalledWith(
        `bulk-import:${JOB_ID}`,
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  describe('handle — failure state', () => {
    it('writes failed status and clears idempotency key when processing throws', async () => {
      storageMock.downloadBuffer.mockRejectedValueOnce(new Error('storage unavailable'));
      const redis = makeRedis();
      const proc = makeProcessor(redis);

      await expect(
        tenantContext.runWith(ctx, () =>
          proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
        ),
      ).rejects.toThrow('storage unavailable');

      expect(redis.hset).toHaveBeenCalledWith(
        `bulk-import:${JOB_ID}`,
        expect.objectContaining({ status: 'failed' }),
      );
      expect(redis.del).toHaveBeenCalledWith(`idempotency:bulk-import:${IKEY}`);
    });
  });

  describe('handle — category mapping', () => {
    it('maps category name to categoryId via findCategoryByName', async () => {
      repoMock.findCategoryByName.mockResolvedValueOnce('cat-uuid-1234');
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      expect(repoMock.findCategoryByName).toHaveBeenCalledWith('Rings');
      const [rows] = (repoMock.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as [Array<{ categoryId: string }>];
      expect(rows[0]?.categoryId).toBe('cat-uuid-1234');
    });

    it('sets categoryId to undefined when category name not found', async () => {
      repoMock.findCategoryByName.mockResolvedValueOnce(null);
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      const [rows] = (repoMock.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as [Array<{ categoryId?: string }>];
      expect(rows[0]?.categoryId).toBeUndefined();
    });
  });

  describe('tenant isolation', () => {
    it('tags every createMany row with context shopId', async () => {
      const proc = makeProcessor();

      await tenantContext.runWith(ctx, () =>
        proc.handle({ jobId: JOB_ID, storageKey: 'key', idempotencyKey: IKEY, userId: USER_ID }),
      );

      const [rows] = (repoMock.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as [Array<{ shopId: string }>];
      expect(rows.every((r) => r.shopId === SHOP_ID)).toBe(true);
    });
  });
});
