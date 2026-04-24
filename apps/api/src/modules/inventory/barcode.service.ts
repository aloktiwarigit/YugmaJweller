import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { tenantContext } from '@goldsmith/tenant-context';
import type { BarcodeData } from '@goldsmith/shared';
import { InventoryRepository } from './inventory.repository';
import type { ProductRow } from './inventory.repository';

function buildBarcodeValue(rawShopUuid: string, productId: string): string {
  const shopPrefix = rawShopUuid.replace(/-/g, '').slice(0, 6);
  const productPrefix = productId.replace(/-/g, '').slice(0, 12);
  return `GS-${shopPrefix}-${productPrefix}`;
}

function toWeightDisplay(grossWeightG: string): string {
  return `${grossWeightG} g`;
}

function mapRowToBarcodeData(row: ProductRow): BarcodeData {
  return {
    barcodeValue: buildBarcodeValue(row.shop_id, row.id),
    sku: row.sku,
    productName: row.sku,
    weightDisplay: toWeightDisplay(row.gross_weight_g),
    huid: row.huid,
    metal: row.metal,
    purity: row.purity,
  };
}

@Injectable()
export class BarcodeService {
  constructor(@Inject(InventoryRepository) private readonly repo: InventoryRepository) {}

  async generateBarcode(productId: string): Promise<BarcodeData> {
    const ctx = tenantContext.requireCurrent();
    const row = await this.repo.getProduct(productId);
    if (!row || row.shop_id !== ctx.shopId) {
      throw new NotFoundException({ code: 'inventory.product_not_found' });
    }
    return mapRowToBarcodeData(row);
  }

  async generateBarcodes(productIds: string[]): Promise<BarcodeData[]> {
    if (productIds.length > 50) {
      throw new BadRequestException({ code: 'inventory.barcode_batch_limit_exceeded' });
    }

    const ctx = tenantContext.requireCurrent();
    const rows = await this.repo.getProductsByIds(productIds);

    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const results: BarcodeData[] = [];

    for (const id of productIds) {
      const row = rowMap.get(id);
      if (!row || row.shop_id !== ctx.shopId) {
        throw new NotFoundException({ code: 'inventory.product_not_found', productId: id });
      }
      results.push(mapRowToBarcodeData(row));
    }

    return results;
  }
}
