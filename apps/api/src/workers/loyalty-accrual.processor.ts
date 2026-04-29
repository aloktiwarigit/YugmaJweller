import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Pool } from 'pg';
import type { Job } from '@goldsmith/queue';
import type { Redis } from '@goldsmith/cache';
import { tenantContext } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { LoyaltyService } from '../modules/loyalty/loyalty.service';
import { LOYALTY_ACCRUAL_QUEUE, type LoyaltyAccrualJobData } from '../modules/loyalty/loyalty.event-listener';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

@Processor(LOYALTY_ACCRUAL_QUEUE)
export class LoyaltyAccrualProcessor extends WorkerHost {
  private readonly logger = new Logger(LoyaltyAccrualProcessor.name);

  constructor(
    @Inject(LoyaltyService)    private readonly loyaltySvc: LoyaltyService,
    @Inject('LOYALTY_REDIS')   private readonly redis: Redis,
    @Inject('PG_POOL')         private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job<LoyaltyAccrualJobData>): Promise<{ skipped: boolean; pointsDelta?: number }> {
    const { invoiceId, shopId, customerId, goldValuePaise } = job.data;

    // Idempotency gate: SET NX with TTL. If the key already exists, this invoice
    // has already been accrued (either by an earlier successful run, or by a
    // concurrent worker that beat us here). The DB unique constraint on the
    // ledger row would also catch this, but Redis short-circuits the whole tx.
    const idemKey = `loyalty:accrual:${invoiceId}`;
    const setResult = await this.redis.set(idemKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
    if (setResult === null) {
      this.logger.log(
        `loyalty accrual skipped (already processed): invoiceId=${invoiceId} shopId=${shopId}`,
      );
      return { skipped: true };
    }

    try {
      const ctx = await this.buildTenantCtx(shopId);
      const result = await tenantContext.runWith(ctx, () =>
        this.loyaltySvc.accruePoints({
          customerId,
          invoiceId,
          goldValuePaise: BigInt(goldValuePaise),
        }),
      );
      this.logger.log(
        `loyalty accrual ok: invoiceId=${invoiceId} customerId=${customerId} pointsDelta=${result.pointsDelta} newBalance=${result.newBalance}`,
      );
      return { skipped: false, pointsDelta: result.pointsDelta };
    } catch (err: unknown) {
      // On failure, release the idempotency key so a retry can proceed.
      // If we kept the key, a transient DB blip would permanently lose this accrual.
      try { await this.redis.del(idemKey); } catch { /* best-effort */ }
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 0;
    const isFinalAttempt = attempt >= maxAttempts;
    const sev = isFinalAttempt ? 'FATAL' : 'ERROR';
    this.logger.error(
      `[${sev}] loyalty-accrual failed: jobId=${job?.id ?? 'unknown'} attempt=${attempt}/${maxAttempts} ` +
        `invoiceId=${job?.data?.invoiceId ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
    if (isFinalAttempt) {
      // Stub for ops alerting (Sentry / pagerduty wiring deferred to Epic 13).
      this.logger.error(`pagerduty_stub: loyalty accrual permanently failed for invoice=${job?.data?.invoiceId}`);
    }
  }

  // Workers run outside the HTTP request cycle and have no tenant context set
  // by the NestJS interceptor. Build a minimal unauthenticated context here so
  // LoyaltyService.tenantContext.requireCurrent() works.
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- BullMQ worker; shopId from job payload, verified at enqueueing time
  private async buildTenantCtx(shopId: string): Promise<TenantContext> {
    const r = await this.pool.query<{ id: string; slug: string; display_name: string; status: string }>(
      `SELECT id, slug, display_name, status FROM shops WHERE id = $1`,
      [shopId],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`loyalty-accrual: shop ${shopId} not found`);
    return {
      authenticated: false,
      shopId,
      tenant: { id: row.id, slug: row.slug, display_name: row.display_name, status: row.status as never },
    };
  }
}
