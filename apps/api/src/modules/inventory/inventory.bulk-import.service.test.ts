import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';
import { InventoryBulkImportService } from './inventory.bulk-import.service';

const SHOP_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID = 'user-1';
const JOB_ID  = 'job-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const IKEY    = 'idempotency-key-xyz';

const tenant: Tenant = { id: SHOP_ID, slug: 'b', display_name: 'Test B', status: 'ACTIVE' };
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_ID, tenant, authenticated: true,
  userId: USER_ID, role: 'shop_admin',
};

const storageMock = {
  getPresignedUploadUrl: vi.fn().mockResolvedValue('https://stub/upload?sas=STUB'),
};

function makeRedis(
  getResult: string | null = null,
  hgetallResult: Record<string, string> | null = null,
) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
    set: vi.fn().mockResolvedValue('OK'),
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue(hgetallResult),
  } as unknown as import('ioredis').default;
}

const queueMock = { add: vi.fn().mockResolvedValue(undefined) };

function makeService(redis = makeRedis()) {
  return new InventoryBulkImportService(storageMock as never, redis, queueMock as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue(ctx as never);
});

describe('InventoryBulkImportService', () => {
  describe('createUploadUrl', () => {
    it('returns uploadUrl and a jobId', async () => {
      const svc = makeService();
      const result = await svc.createUploadUrl(IKEY);
      expect(result.uploadUrl).toContain('stub');
      expect(typeof result.jobId).toBe('string');
      expect(result.jobId.length).toBeGreaterThan(0);
    });

    it('stores meta in Redis with 1h TTL', async () => {
      const redis = makeRedis();
      const svc = makeService(redis);
      await svc.createUploadUrl(IKEY);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('bulk-import-meta:'),
        expect.any(String),
        'EX',
        3600,
      );
    });

    it('scopes storage key to tenant prefix', async () => {
      const svc = makeService();
      await svc.createUploadUrl(IKEY);
      const [key] = (storageMock.getPresignedUploadUrl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(key.startsWith(`tenants/${SHOP_ID}/bulk-import/`)).toBe(true);
    });
  });

  describe('triggerJob', () => {
    it('throws NotFoundException if jobId meta not found in Redis', async () => {
      const redis = makeRedis(null);
      const svc = makeService(redis);
      await expect(svc.triggerJob(JOB_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if jobId belongs to a different tenant', async () => {
      const meta = JSON.stringify({
        shopId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', // different tenant
        storageKey: `tenants/other/bulk-import/${JOB_ID}/input.csv`,
        idempotencyKey: IKEY,
      });
      const redis = makeRedis(meta);
      const svc = makeService(redis);
      await expect(svc.triggerJob(JOB_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('enqueues job when meta found and shopId matches', async () => {
      const meta = JSON.stringify({
        shopId: SHOP_ID,
        storageKey: `tenants/${SHOP_ID}/bulk-import/${JOB_ID}/input.csv`,
        idempotencyKey: IKEY,
      });
      const redis = makeRedis(meta);
      const svc = makeService(redis);
      const result = await svc.triggerJob(JOB_ID, USER_ID);
      expect(queueMock.add).toHaveBeenCalled();
      expect(result.jobId).toBe(JOB_ID);
    });
  });

  describe('getJobStatus', () => {
    it('throws NotFoundException when meta not found in Redis', async () => {
      const svc = makeService(makeRedis(null, null));
      await expect(svc.getJobStatus(JOB_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when jobId belongs to a different tenant', async () => {
      const meta = JSON.stringify({
        shopId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        storageKey: 'tenants/other/bulk-import/job/input.csv',
        idempotencyKey: IKEY,
      });
      const svc = makeService(makeRedis(meta, {}));
      await expect(svc.getJobStatus(JOB_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns numeric fields correctly from Redis hash strings', async () => {
      const meta = JSON.stringify({ shopId: SHOP_ID, storageKey: 'key', idempotencyKey: IKEY });
      const hash = {
        jobId: JOB_ID, status: 'completed',
        total: '10', processed: '10', succeeded: '9', failed: '1',
      };
      const svc = makeService(makeRedis(meta, hash));
      const result = await svc.getJobStatus(JOB_ID);
      expect(result.status).toBe('completed');
      expect(result.total).toBe(10);
      expect(result.succeeded).toBe(9);
      expect(result.failed).toBe(1);
    });
  });
});
