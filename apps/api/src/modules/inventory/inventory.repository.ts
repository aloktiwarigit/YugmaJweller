import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import type { CreateProductDto, UpdateProductDto } from '@goldsmith/shared';

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
  published_at: Date | null;
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

const SELECT_COLS = `
  id, shop_id, category_id, sku, metal, purity,
  gross_weight_g, net_weight_g, stone_weight_g, stone_details,
  making_charge_override_pct, huid, status, published_at,
  created_by_user_id, created_at, updated_at
`;

@Injectable()
export class InventoryRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

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
      return r.rows[0] as ProductRow;
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
}
