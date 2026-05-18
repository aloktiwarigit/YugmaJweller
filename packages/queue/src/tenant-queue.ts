import { Queue, type JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import type { TenantContext } from '@goldsmith/tenant-context';
import { logger } from '@goldsmith/observability';

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
    // Absorb Redis errors (e.g. Upstash rate-limit, transient connection issues) so
    // a queue being temporarily unavailable does not crash the Node process.
    // The API continues serving non-queue endpoints; jobs will resume when Redis recovers.
    this.queue.on('error', (err) => {
      logger.warn({ err, queueName: name }, 'queue.redis_error — queue degraded, API still running');
    });
  }
  async add(ctx: TenantContext, jobName: string, data: T, opts?: JobsOptions): Promise<void> {
    await this.queue.add(jobName, buildJobPayload(ctx, data), opts);
  }
  async close(): Promise<void> { await this.queue.close(); }
}
