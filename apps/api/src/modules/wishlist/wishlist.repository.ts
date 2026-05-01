import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';

export interface WishlistRow {
  id:         string;
  shop_id:    string;
  customer_id: string;
  product_id: string;
  created_at: Date;
}

export interface WishlistProductRow {
  product_id:   string;
  sku:          string;
  purity:       string;
  metal:        string;
  gross_weight_g: string;
  net_weight_g:   string;
  huid:         string | null;
  added_at:     Date;
}

@Injectable()
export class WishlistRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async add(params: { shopId: string; customerId: string; productId: string }): Promise<WishlistRow> {
    const { rows } = await this.pool.query<WishlistRow>(
      `INSERT INTO wishlists (shop_id, customer_id, product_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (shop_id, customer_id, product_id) DO NOTHING
       RETURNING *`,
      [params.shopId, params.customerId, params.productId],
    );
    // If already exists, return the existing row
    if (rows.length > 0) return rows[0]!;
    const { rows: existing } = await this.pool.query<WishlistRow>(
      `SELECT * FROM wishlists WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3`,
      [params.shopId, params.customerId, params.productId],
    );
    return existing[0]!;
  }

  async remove(params: { shopId: string; customerId: string; productId: string }): Promise<void> {
    await this.pool.query(
      `DELETE FROM wishlists WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3`,
      [params.shopId, params.customerId, params.productId],
    );
  }

  async listForCustomer(params: {
    shopId:     string;
    customerId: string;
  }): Promise<WishlistProductRow[]> {
    const { rows } = await this.pool.query<WishlistProductRow>(
      `SELECT p.id AS product_id, p.sku, p.purity, p.metal,
              p.gross_weight_g::text, p.net_weight_g::text, p.huid,
              w.created_at AS added_at
         FROM wishlists w
         JOIN products p ON p.id = w.product_id
        WHERE w.shop_id = $1 AND w.customer_id = $2
        ORDER BY w.created_at DESC`,
      [params.shopId, params.customerId],
    );
    return rows;
  }

  async isWishlisted(params: {
    shopId:     string;
    customerId: string;
    productId:  string;
  }): Promise<boolean> {
    const { rows } = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM wishlists
          WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3
       ) AS exists`,
      [params.shopId, params.customerId, params.productId],
    );
    return rows[0]?.exists ?? false;
  }
}
