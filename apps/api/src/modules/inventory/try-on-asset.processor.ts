import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { STORAGE_PORT, type StoragePort } from '@goldsmith/integrations-storage';
import { getBgRemovalAdapter } from '@goldsmith/integrations-bg-removal';

export interface TryOnCutoutJob {
  productId: string;
  imageId: string;
  storageKey: string;
}

@Injectable()
export class TryOnAssetProcessor {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  // tenantContext is already set by createTenantWorker before this runs, so
  // withTenantTx applies the correct app.current_shop_id under app_user.
  async handle(data: TryOnCutoutJob): Promise<void> {
    const { productId, imageId, storageKey } = data;
    const bg = getBgRemovalAdapter();

    try {
      const original = await this.storage.downloadBuffer(storageKey);
      const cutout = await bg.removeBackground({ image: original, quality: 'fine' });

      const cutoutKey = `${storageKey}.cutout.png`;
      await this.storage.uploadBuffer(cutoutKey, cutout.png, 'image/png');

      // Anchor auto-proposal: centre-x, top-y of the alpha bbox, normalized.
      const anchorX = cutout.width > 0 ? (cutout.bbox.x + cutout.bbox.width / 2) / cutout.width : 0.5;
      const anchorY = cutout.height > 0 ? cutout.bbox.y / cutout.height : 0.0;

      await withTenantTx(this.pool, (tx) =>
        tx.query(
          `UPDATE product_try_on_assets
              SET asset_storage_key = $1, source_image_id = $2,
                  anchor_x = $3, anchor_y = $4,
                  status = 'ready', enabled = true, updated_at = now()
            WHERE product_id = $5`,
          [cutoutKey, imageId, anchorX.toFixed(4), anchorY.toFixed(4), productId],
        ),
      );
    } catch (err) {
      await withTenantTx(this.pool, (tx) =>
        tx.query(
          `UPDATE product_try_on_assets SET status = 'failed', updated_at = now()
            WHERE product_id = $1`,
          [productId],
        ),
      );
      throw err; // let BullMQ record the failed job for retry/inspection
    }
  }
}
