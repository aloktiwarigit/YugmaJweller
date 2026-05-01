import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { WishlistRepository } from './wishlist.repository';
import type { WishlistProductRow } from './wishlist.repository';

export interface WishlistItemResponse {
  productId:    string;
  sku:          string;
  purity:       string;
  metal:        string;
  grossWeightG: string;
  netWeightG:   string;
  huid:         string | null;
  addedAt:      string;
}

@Injectable()
export class WishlistService {
  constructor(
    @Inject(WishlistRepository) private readonly repo: WishlistRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async addToWishlist(params: { customerId: string; productId: string }): Promise<{ added: boolean }> {
    const { shopId } = tenantContext.requireCurrent();

    // Verify product belongs to this shop
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
      [params.productId, shopId],
    );
    if (rows.length === 0) throw new NotFoundException({ code: 'product.not_found' });

    await this.repo.add({ shopId, customerId: params.customerId, productId: params.productId });
    return { added: true };
  }

  async removeFromWishlist(params: { customerId: string; productId: string }): Promise<void> {
    const { shopId } = tenantContext.requireCurrent();
    await this.repo.remove({ shopId, customerId: params.customerId, productId: params.productId });
  }

  async listWishlist(customerId: string): Promise<WishlistItemResponse[]> {
    const { shopId } = tenantContext.requireCurrent();
    const rows = await this.repo.listForCustomer({ shopId, customerId });
    return rows.map(this.toResponse);
  }

  private toResponse(row: WishlistProductRow): WishlistItemResponse {
    return {
      productId:    row.product_id,
      sku:          row.sku,
      purity:       row.purity,
      metal:        row.metal,
      grossWeightG: row.gross_weight_g,
      netWeightG:   row.net_weight_g,
      huid:         row.huid,
      addedAt:      row.added_at.toISOString(),
    };
  }
}
