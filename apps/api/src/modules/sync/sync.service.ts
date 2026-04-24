import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import type { TenantContext } from '@goldsmith/tenant-context';
import { pull, push } from '@goldsmith/sync';
import type { PullRequest, PullResponse, PushResponse } from '@goldsmith/sync';
import type { PushRequestDto } from './dto/push-request.dto';

@Injectable()
export class SyncService {
  constructor(
    @Inject('SYNC_POOL') private readonly pool: Pool,
    @Inject('SYNC_REDIS') private readonly redis: Redis,
  ) {}

  async pull(ctx: TenantContext, req: PullRequest): Promise<PullResponse> {
    return pull(this.pool, ctx, req);
  }

  async push(ctx: TenantContext, dto: PushRequestDto): Promise<PushResponse> {
    return push(this.pool, this.redis as never, ctx, {
      changes: dto.changes as PullRequest['tables'] extends never ? never : PushRequestDto['changes'],
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
