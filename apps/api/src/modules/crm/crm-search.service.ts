import { Injectable, Inject, Logger } from '@nestjs/common';
import { SEARCH_PORT } from '@goldsmith/integrations-search';
import type {
  SearchPort,
  CustomerSearchDoc,
  CustomerSearchQuery,
  CustomerSearchResult,
  CustomerSearchHit,
} from '@goldsmith/integrations-search';
import { MeilisearchUnavailableError } from '@goldsmith/integrations-search';
import type { Pool } from 'pg';
import type { TenantContext } from '@goldsmith/tenant-context';

@Injectable()
export class CrmSearchService {
  private readonly logger = new Logger(CrmSearchService.name);

  constructor(
    @Inject(SEARCH_PORT) private readonly searchPort: SearchPort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async searchCustomers(ctx: TenantContext, query: CustomerSearchQuery): Promise<CustomerSearchResult> {
    if (!ctx.authenticated) {
      return this.postgresSearch(ctx.shopId, query);
    }
    try {
      const result = await this.searchPort.searchCustomers(ctx.shopId, query);
      this.logger.debug(
        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
      );
      // Fall back to Postgres when Meilisearch returns 0 hits: the index may
      // not have been backfilled yet (e.g. pre-existing customers created before
      // this feature shipped). Postgres always has authoritative data.
      if (result.hits.length === 0 && (query.q ?? '').trim().length > 0) {
        this.logger.debug(`search: meilisearch returned 0 hits, falling back to postgres for backfill safety`);
        return this.postgresSearch(ctx.shopId, query);
      }
      return result;
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(`Meilisearch unavailable, falling back to Postgres: ${(err as Error).message}`);
        return this.postgresSearch(ctx.shopId, query);
      }
      throw err;
    }
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal search helper; shopId comes from authenticated ctx
  private async postgresSearch(shopId: string, query: CustomerSearchQuery): Promise<CustomerSearchResult> {
    const { q, city, limit, offset } = query;
    const conditions: string[] = ['c.shop_id = $1'];
    const params: unknown[] = [shopId];
    let idx = 2;

    if (q.length > 0) {
      const qLike = `%${q}%`;
      // Name and city text search share the same parameter
      const searchParts = [`c.name ILIKE $${idx}`, `c.city ILIKE $${idx}`];
      params.push(qLike);
      idx++;
      // 4-digit numeric query: also match phone last-4 exactly
      if (/^\d{4}$/.test(q)) {
        searchParts.push(`RIGHT(c.phone, 4) = $${idx}`);
        params.push(q);
        idx++;
      }
      conditions.push(`(${searchParts.join(' OR ')})`);
    }

    if (city) {
      conditions.push(`c.city = $${idx}`);
      params.push(city);
      idx++;
    }

    const where = conditions.join(' AND ');
    const sql = `
      SELECT c.id, c.name, RIGHT(c.phone, 4) AS phone_last4, c.city,
             EXTRACT(EPOCH FROM c.updated_at)::bigint * 1000 AS "updatedAt",
             COUNT(*) OVER () AS total_count
      FROM customers c
      WHERE ${where}
      ORDER BY c.updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    params.push(limit, offset);

    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction -- RLS context already set by interceptor; read-only customer search
    try {
      const rows = await client.query(sql, params);
      const total = rows.rows.length > 0 ? Number(rows.rows[0]?.['total_count'] ?? 0) : 0;
      return {
        hits: rows.rows.map((r: Record<string, unknown>) => ({
          id:         r['id'] as string,
          name:       r['name'] as string,
          phoneLast4: r['phone_last4'] as string,
          city:       (r['city'] as string | null) ?? null,
          updatedAt:  Number(r['updatedAt']),
        } satisfies CustomerSearchHit)),
        total,
        source: 'postgres',
      };
    } finally {
      client.release();
    }
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal indexing; shopId from auth context
  async indexCustomer(shopId: string, customer: CustomerSearchDoc): Promise<void> {
    try {
      await this.searchPort.indexCustomer(shopId, customer);
      this.logger.debug(`indexCustomer: indexed ${customer.id} for shop ${shopId}`);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(
          `indexCustomer: Meilisearch unavailable for customer ${customer.id}: ${(err as Error).message}`,
        );
        return; // Best-effort; falls back to Postgres at query time
      }
      throw err;
    }
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal search helper; shopId from auth context
  async removeFromIndex(shopId: string, customerId: string): Promise<void> {
    try {
      await this.searchPort.removeCustomer(shopId, customerId);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(
          `removeFromIndex: Meilisearch unavailable for customer ${customerId} shop ${shopId}`,
        );
        return;
      }
      throw err;
    }
  }

  // TODO(Epic 7): When @nestjs/event-emitter is wired, migrate indexing to
  // @OnEvent('crm.customer_created') + BullMQ customer-search-indexer processor.
  // Until then, CrmService calls indexCustomer directly (best-effort, fire-and-forget).
}
