import { Worker, type Job, type WorkerOptions } from 'bullmq';
import type Redis from 'ioredis';
import { tenantContext, type TenantContext, type Tenant } from '@goldsmith/tenant-context';
import { logger } from '@goldsmith/observability';
import { extractTenantId, type JobPayload } from './tenant-queue';

export interface TenantResolver {
  byId(id: string): Promise<Tenant | undefined>;
}

export function createTenantWorker<T>(
  name: string,
  handler: (ctx: TenantContext, data: T) => Promise<void>,
  tenants: TenantResolver,
  connection: Redis,
  opts: Omit<WorkerOptions, 'connection'> = {},
): Worker<JobPayload<T>> {
  return new Worker<JobPayload<T>>(
    name,
    async (job: Job<JobPayload<T>>) => {
      const shopId = extractTenantId(job.data);
      const tenant = await tenants.byId(shopId);
      if (!tenant) throw new Error('tenant.not_found');
      if (tenant.status !== 'ACTIVE') throw new Error('tenant.inactive');
      const ctx: TenantContext = { shopId: tenant.id, tenant };
      return tenantContext.runWith(ctx, async () => {
        logger.info({ jobId: job.id, shopId, name: job.name }, 'processing');
        await handler(ctx, job.data.data);
      });
    },
    { connection, ...opts },
  );
}
