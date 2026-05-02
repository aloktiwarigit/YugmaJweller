import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

type Tx = Pick<PoolClient, 'query'>;

export type ImageRow = {
  id: string;
  shop_id: string;
  product_id: string;
  storage_key: string;
  alt_text: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  exif_stripped_at: string;
  uploaded_by_user_id: string;
  scan_status: 'pending' | 'clean' | 'rejected';
  sort_order: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  /** F6-server (Codex P2): server-built thumbnail URL via ImageKit builder.
   *  Mobile consumes this directly — no client-side URL construction. */
  thumbnail_url: string;
};

export type InsertImageInput = {
  productId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sortOrder: number;
  altText: string | null;
  uploadedByUserId: string;
  idempotencyKey: string | null;
};

const SELECT_COLS = `
  id, shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
  width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
  sort_order, idempotency_key, created_at, updated_at
`.trim();

@Injectable()
export class ProductImagesRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Tenant-scoped product existence check + pessimistic row lock.
   * Returns null on miss (cross-tenant attempt OR not found).
   *
   * The FOR UPDATE lock serializes concurrent uploads for the same product,
   * making the 10-image cap inviolable. The composite FK from migration 0058
   * is the schema-layer defense; this method is the explicit serialization
   * point inside the upload transaction.
   *
   * Per ADR-0005 the shop scope comes from `tenantContext`, not a parameter.
   */
  async lockProductForTenant(tx: Tx, productId: string): Promise<{ id: string } | null> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [productId, shopId],
    );
    return r.rows[0] ?? null;
  }

  async countImagesInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }

  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return r.rows[0]?.next ?? 0;
  }

  /**
   * F7 service-layer idempotency lookup. Caller (ProductImagesService.upload)
   * runs this BEFORE attempting INSERT; if it finds a row, returns it as the
   * replay. Partial UNIQUE index `product_images_idempotency_uniq` (migration
   * 0058) is the race-loser backstop.
   */
  async findByIdempotencyKeyInTx(tx: Tx, productId: string, idempotencyKey: string): Promise<ImageRow | null> {
    const r = await tx.query<ImageRow>(
      `SELECT ${SELECT_COLS}
         FROM product_images
        WHERE product_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [productId, idempotencyKey],
    );
    return r.rows[0] ?? null;
  }

  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<ImageRow>(
      `INSERT INTO product_images
         (shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
          width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
          sort_order, idempotency_key)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, 'clean', $10, $11)
       RETURNING ${SELECT_COLS}`,
      [
        shopId, input.productId, input.storageKey, input.altText,
        input.mimeType, input.byteSize, input.width, input.height,
        input.uploadedByUserId, input.sortOrder, input.idempotencyKey,
      ],
    );
    return r.rows[0]!;
  }

  /** Public read path. RLS scopes by shop_id via withTenantTx. */
  async listForProduct(productId: string): Promise<ImageRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ImageRow>(
        `SELECT ${SELECT_COLS}
           FROM product_images
          WHERE product_id = $1
          ORDER BY sort_order ASC, created_at ASC`,
        [productId],
      );
      return r.rows;
    });
  }

  async deleteImage(productId: string, imageId: string): Promise<{ storageKey: string } | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ storage_key: string }>(
        `DELETE FROM product_images
          WHERE id = $1 AND product_id = $2
          RETURNING storage_key`,
        [imageId, productId],
      );
      const row = r.rows[0];
      return row ? { storageKey: row.storage_key } : null;
    });
  }

  async setSortOrders(productId: string, orderedIds: string[]): Promise<ImageRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      // Lock the product's images. The set must match exactly: every image of
      // the product is in orderedIds and no extras. Mismatch → return [] →
      // service throws ORDER_LIST_MISMATCH (400).
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM product_images WHERE product_id = $1 FOR UPDATE`,
        [productId],
      );
      const existingSet = new Set(existing.rows.map((r) => r.id));
      const orderedSet = new Set(orderedIds);
      if (existingSet.size !== orderedSet.size) return [];
      for (const id of existingSet) if (!orderedSet.has(id)) return [];

      // Atomic update: each row gets its new sort_order based on array index.
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.query(
          `UPDATE product_images
              SET sort_order = $1, updated_at = NOW()
            WHERE id = $2 AND product_id = $3`,
          [i, orderedIds[i], productId],
        );
      }
      const r = await tx.query<ImageRow>(
        `SELECT ${SELECT_COLS}
           FROM product_images
          WHERE product_id = $1
          ORDER BY sort_order ASC`,
        [productId],
      );
      return r.rows;
    });
  }

  async setAltText(productId: string, imageId: string, altText: string | null): Promise<ImageRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ImageRow>(
        `UPDATE product_images
            SET alt_text = $1, updated_at = NOW()
          WHERE id = $2 AND product_id = $3
          RETURNING ${SELECT_COLS}`,
        [altText, imageId, productId],
      );
      return r.rows[0] ?? null;
    });
  }
}
