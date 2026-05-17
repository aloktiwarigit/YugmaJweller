import { Controller, Get, HttpCode, HttpStatus, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { SkipTenant } from './common/decorators/skip-tenant.decorator';
import { SkipAuth } from './common/decorators/skip-auth.decorator';

@Controller()
export class HealthController {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * /healthz — legacy shallow probe (kept for compatibility with existing monitoring).
   * Returns 200 immediately without touching the DB.
   */
  @Get('/healthz')
  @SkipTenant()
  @SkipAuth()
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * /health — deep probe used by Cloud Run startup/liveness probe and Dockerfile HEALTHCHECK.
   * Runs a lightweight SELECT 1 against the DB pool; returns 503 if DB is unreachable.
   * Cloud Run gates new revision traffic on this endpoint passing.
   */
  @Get('/health')
  @SkipTenant()
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: 'ok'; db: 'ok' }> {
    const client = await this.pool.connect().catch(() => {
      throw new ServiceUnavailableException({ status: 'error', db: 'unreachable' });
    });
    try {
      await client.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'unreachable' });
    } finally {
      client.release();
    }
    return { status: 'ok', db: 'ok' };
  }
}
