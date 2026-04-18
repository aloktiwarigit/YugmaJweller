import { Queue, type JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import type { TenantContext } from '@goldsmith/tenant-context';

export interface JobPayload<T> {
  meta: { tenantId: string };
  data: T;
}

export function buildJobPayload<T>(ctx: TenantContext, data: T): JobPayload<T> {
  return { meta: { tenantId: ctx.shopId }, data };
}

export function extractTenantId(payload: Partial<JobPayload<unknown>>): string {
  const id = payload?.meta?.tenantId;
  if (!id) throw new Error('queue.missing_tenant_meta');
  return id;
}

export class TenantQueue<T> {
  private readonly queue: Queue<JobPayload<T>>;
  constructor(name: string, connection: Redis) {
    this.queue = new Queue<JobPayload<T>>(name, { connection });
  }
  async add(ctx: TenantContext, jobName: string, data: T, opts?: JobsOptions): Promise<void> {
    await this.queue.add(jobName, buildJobPayload(ctx, data), opts);
  }
  async close(): Promise<void> { await this.queue.close(); }
}
