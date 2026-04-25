import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { CreateProductDto, UpdateProductDto } from '@goldsmith/shared';
import { SyncLogger } from '@goldsmith/sync';

export interface ProductRow {
  id: string;
  shop_id: string;
  category_id: string | null;
  sku: string;
  metal: string;
  purity: string;
  gross_weight_g: string;
  net_weight_g: string;
  stone_weight_g: string;
  stone_details: string | null;
  making_charge_override_pct: string | null;
  huid: string | null;
  status: string;
  quantity: number;
  published_at: Date | null;
  published_by_user_id: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductInput extends Omit<CreateProductDto, 'stoneWeightG'> {
  shopId: string;
  createdByUserId: string;
  stoneWeightG?: string;
}

export interface ListProductsFilter {
  limit: number;
  offset: number;
  status?: string;
  metal?: string;
  purity?: string;
}

export interface FailedRow {
  rowNumber: number;
  row: CreateProductInput;
  error: string;
}

export interface ValuationProductRow {
  id: string;
  metal: string;
  purity: string;
  net_weight_g: string;
  making_charge_override_pct: string | null;
  category_id: string | null;
  category_name: string;
}

const SELECT_COLS = `
  id, shop_id, category_id, sku, metal, purity,
  gross_weight_g, net_weight_g, stone_weight_g, stone_details,
  making_charge_override_pct, huid, status, quantity,
  published_at, published_by_user_id, created_by_user_id, created_at, updated_at
`;

@Injectable()
export class InventoryRepository {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly syncLogger: SyncLogger,
  ) {}

  async createProduct(input: CreateProductInput): Promise<ProductRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ProductRow>(
        `INSERT INTO products
           (shop_id, category_id, sku, metal, purity,
            gross_weight_g, net_weight_g, stone_weight_g, stone_details,
            making_charge_override_pct, huid, status, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING ${SELECT_COLS}`,
        [
          input.shopId,
          input.categoryId ?? null,
          input.sku,
          input.metal,
          input.purity,
          input.grossWeightG,
          input.netWeightG,
          input.stoneWeightG ?? '0.0000',
          input.stoneDetails ?? null,
          input.makingChargeOverridePct ?? null,
          input.huid ?? null,
          input.status ?? 'IN_STOCK',
          input.createdByUserId,
        ],
      );
      const row = r.rows[0] as ProductRow;
      await this.syncLogger.logInTx(tx, input.shopId, 'products', row.id, 'INSERT', row as unknown as Record<string, unknown>);
      return row;
    });
  }

  async getProduct(id: string): Promise<ProductRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ProductRow>(
        `SELECT ${SELECT_COLS} FROM products WHERE id = $1`,
        [id],
      );
      return r.rows[0] ?? null;
    });
  }

  async listProducts(filter: ListProductsFilter): Promise<ProductRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (filter.status) { conditions.push(`status = $${idx++}`); params.push(filter.status); }
      if (filter.metal)  { conditions.push(`metal = $${idx++}`);  params.push(filter.metal);  }
      if (filter.purity) { conditions.push(`purity = $${idx++}`); params.push(filter.purity); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(filter.limit, filter.offset);

      const r = await tx.query<ProductRow>(
        `SELECT ${SELECT_COLS} FROM products ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params,
      );
      return r.rows;
    });
  }

  async findCategoryByName(name: string): Promise<string | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `SELECT id FROM product_categories WHERE name = $1 LIMIT 1`,
        [name],
      );
      return r.rows[0]?.id ?? null;
    });
  }

  async createMany(
    rows: CreateProductInput[],
  ): Promise<{ succeeded: number; failedRows: FailedRow[] }> {
    let succeeded = 0;
    const failedRows: FailedRow[] = [];
    const BATCH = 50;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);

      await withTenantTx(this.pool, async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j] as CreateProductInput;
          const rowNumber = i + j + 1;
          await tx.query(`SAVEPOINT sp_row_${j}`);
          try {
            await tx.query<ProductRow>(
              `INSERT INTO products
                 (shop_id, category_id, sku, metal, purity,
                  gross_weight_g, net_weight_g, stone_weight_g, stone_details,
                  making_charge_override_pct, huid, status, created_by_user_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                row.shopId,
                row.categoryId ?? null,
                row.sku,
                row.metal,
                row.purity,
                row.grossWeightG,
                row.netWeightG,
                row.stoneWeightG ?? '0.0000',
                row.stoneDetails ?? null,
                row.makingChargeOverridePct ?? null,
                row.huid ?? null,
                row.status ?? 'IN_STOCK',
                row.createdByUserId,
              ],
            );
            succeeded++;
          } catch (err) {
            await tx.query(`ROLLBACK TO SAVEPOINT sp_row_${j}`);
            failedRows.push({
              rowNumber,
              row,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    }

    return { succeeded, failedRows };
  }

  async getProductsByIds(ids: string[]): Promise<ProductRow[]> {
    if (ids.length === 0) return [];
    return withTenantTx(this.pool, async (tx) => {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const r = await tx.query<ProductRow>(
        `SELECT ${SELECT_COLS} FROM products WHERE id IN (${placeholders})`,
        ids,
      );
      return r.rows;
    });
  }

  async updateStatusAtomic(
    id: string,
    expectedStatus: string,
    newStatus: string,
  ): Promise<ProductRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      // Conditional UPDATE: only succeeds if the current status still matches.
      // Closes the TOCTOU race between the transition check and the write.
      const r = await tx.query<ProductRow>(
        `UPDATE products SET status = $1, updated_at = now()
         WHERE id = $2 AND status = $3
         RETURNING ${SELECT_COLS}`,
        [newStatus, id, expectedStatus],
      );
      const row = r.rows[0] ?? null;
      if (row) {
        const ctx = tenantContext.requireCurrent();
        await this.syncLogger.logInTx(tx, ctx.shopId, 'products', row.id, 'UPDATE', row as unknown as Record<string, unknown>);
      }
      return row;
    });
  }

  async updateProduct(id: string, patch: UpdateProductDto): Promise<ProductRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      const fieldMap: Record<string, string> = {
        sku: 'sku', metal: 'metal', purity: 'purity',
        grossWeightG: 'gross_weight_g', netWeightG: 'net_weight_g',
        stoneWeightG: 'stone_weight_g', stoneDetails: 'stone_details',
        makingChargeOverridePct: 'making_charge_override_pct',
        huid: 'huid', status: 'status', categoryId: 'category_id',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in patch && patch[key as keyof UpdateProductDto] !== undefined) {
          sets.push(`${col} = $${idx++}`);
          params.push(patch[key as keyof UpdateProductDto]);
        }
      }

      if (sets.length === 0) return this.getProduct(id);

      sets.push(`updated_at = now()`);
      params.push(id);

      const r = await tx.query<ProductRow>(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${SELECT_COLS}`,
        params,
      );
      return r.rows[0] ?? null;
    });
  }

  async countImages(productId: string): Promise<number> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
        [productId],
      );
      return parseInt(r.rows[0]?.count ?? '0', 10);
    });
  }

  async publishProduct(productId: string, userId: string): Promise<ProductRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ProductRow>(
        `UPDATE products
         SET published_at = now(), published_by_user_id = $1, updated_at = now()
         WHERE id = $2
         RETURNING ${SELECT_COLS}`,
        [userId, productId],
      );
      return r.rows[0] ?? null;
    });
  }

  async unpublishProduct(productId: string): Promise<ProductRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ProductRow>(
        `UPDATE products
         SET published_at = null, published_by_user_id = null, updated_at = now()
         WHERE id = $1
         RETURNING ${SELECT_COLS}`,
        [productId],
      );
      return r.rows[0] ?? null;
    });
  }

  async listProductsForValuation(): Promise<ValuationProductRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ValuationProductRow>(
        `SELECT p.id, p.metal, p.purity, p.net_weight_g, p.making_charge_override_pct,
                p.category_id, COALESCE(c.name, 'अन्य') AS category_name
         FROM   products p
         LEFT   JOIN product_categories c ON c.id = p.category_id
         WHERE  p.status IN ('IN_STOCK', 'RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR')`,
      );
      return r.rows;
    });
  }

  async insertImageRecord(shopId: string, productId: string, storageKey: string): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `INSERT INTO product_images (shop_id, product_id, storage_key)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [shopId, productId, storageKey],
      );
    });
  }
}
