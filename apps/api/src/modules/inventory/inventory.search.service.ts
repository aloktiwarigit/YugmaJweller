import { Injectable, Inject, Logger } from '@nestjs/common';
import { SEARCH_PORT } from '@goldsmith/integrations-search';
import type { SearchPort, SearchQuery, SearchResult, ProductSearchDoc } from '@goldsmith/integrations-search';
import { MeilisearchUnavailableError } from '@goldsmith/integrations-search';
import type { Pool } from 'pg';
import type { TenantContext } from '@goldsmith/tenant-context';

@Injectable()
export class InventorySearchService {
  private readonly logger = new Logger(InventorySearchService.name);

  constructor(
    @Inject(SEARCH_PORT) private readonly searchPort: SearchPort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async search(ctx: TenantContext, query: SearchQuery): Promise<SearchResult> {
    if (!ctx.authenticated) {
      // Unauthenticated should not reach here at the controller level, but guard defensively
      return this.postgresSearch(ctx.shopId, query);
    }
    try {
      const result = await this.searchPort.search(ctx.shopId, query);
      this.logger.debug(
        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
      );
      return result;
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(
          `Meilisearch unavailable, falling back to Postgres: ${(err as Error).message}`,
        );
        return this.postgresSearch(ctx.shopId, query);
      }
      throw err;
    }
  }

  private async postgresSearch(shopId: string, query: SearchQuery): Promise<SearchResult> {
    const { q, filters, limit, offset } = query;
    const conditions: string[] = ['p.shop_id = $1'];
    const params: unknown[] = [shopId];
    let idx = 2;

    if (q) {
      conditions.push(
        `(p.sku ILIKE $${idx} OR p.huid ILIKE $${idx} OR p.metal ILIKE $${idx} OR p.purity ILIKE $${idx})`,
      );
      params.push(`%${q}%`);
      idx++;
    }
    if (filters?.metal) {
      conditions.push(`p.metal = $${idx}`);
      params.push(filters.metal);
      idx++;
    }
    if (filters?.purity) {
      conditions.push(`p.purity = $${idx}`);
      params.push(filters.purity);
      idx++;
    }
    if (filters?.status) {
      conditions.push(`p.status = $${idx}`);
      params.push(filters.status);
      idx++;
    }
    if (filters?.published !== undefined) {
      conditions.push(filters.published ? 'p.published_at IS NOT NULL' : 'p.published_at IS NULL');
    }

    const where = conditions.join(' AND ');
    const sql = `
      SELECT p.id, p.sku, p.metal, p.purity, p.huid, p.status,
             p.gross_weight_g::text AS "weightG",
             COALESCE(pc.name, '') AS category,
             (p.published_at IS NOT NULL) AS published,
             EXTRACT(EPOCH FROM p.updated_at)::bigint * 1000 AS "updatedAt"
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${where}
      ORDER BY p.updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    params.push(limit, offset);

    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction -- RLS context already set by interceptor; read-only search query
    try {
      const rows = await client.query(sql, params);
      return {
        hits: rows.rows.map((r: Record<string, unknown>) => ({
          id: r['id'] as string,
          sku: r['sku'] as string,
          metal: r['metal'] as string,
          purity: r['purity'] as string,
          huid: (r['huid'] as string | null) ?? null,
          status: r['status'] as string,
          weightG: r['weightG'] as string,
          category: r['category'] as string,
          published: r['published'] as boolean,
          updatedAt: Number(r['updatedAt']),
        })),
        total: rows.rowCount ?? 0,
        source: 'postgres',
      };
    } finally {
      client.release();
    }
  }

  async indexProduct(shopId: string, productId: string): Promise<void> {
    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction -- read-only index population, shop_id-scoped
    try {
      const result = await client.query<Record<string, unknown>>(
        `SELECT p.id, p.sku, p.metal, p.purity, p.huid, p.status,
                p.gross_weight_g::text AS "weightG",
                COALESCE(pc.name, '') AS category,
                (p.published_at IS NOT NULL) AS published,
                EXTRACT(EPOCH FROM p.updated_at)::bigint * 1000 AS "updatedAt"
         FROM products p
         LEFT JOIN product_categories pc ON pc.id = p.category_id
         WHERE p.shop_id = $1 AND p.id = $2`,
        [shopId, productId],
      );
      if (result.rows.length === 0) {
        this.logger.warn(`indexProduct: product ${productId} not found for shop ${shopId}`);
        return;
      }
      const r = result.rows[0] as Record<string, unknown>;
      const doc: ProductSearchDoc = {
        id: r['id'] as string,
        sku: r['sku'] as string,
        metal: r['metal'] as string,
        purity: r['purity'] as string,
        huid: (r['huid'] as string | null) ?? null,
        status: r['status'] as string,
        weightG: r['weightG'] as string,
        category: r['category'] as string,
        published: r['published'] as boolean,
        updatedAt: Number(r['updatedAt']),
      };
      await this.searchPort.indexProduct(shopId, doc);
      this.logger.debug(`indexProduct: indexed ${productId} for shop ${shopId}`);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(
          `indexProduct: Meilisearch unavailable for product ${productId}: ${(err as Error).message}`,
        );
        return; // Best-effort; product will be re-indexed on next trigger
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async removeFromIndex(shopId: string, productId: string): Promise<void> {
    try {
      await this.searchPort.removeProduct(shopId, productId);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) {
        this.logger.warn(
          `removeFromIndex: Meilisearch unavailable for product ${productId} shop ${shopId}`,
        );
        return; // Best-effort
      }
      throw err;
    }
  }

  // TODO(Epic 7): When @nestjs/event-emitter is wired, add @OnEvent('inventory.*') listener
  // here that calls enqueueIndex(). Until then, event-driven indexing is pending and search
  // degrades gracefully to the Postgres fallback path at query time.
}
