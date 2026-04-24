import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { validateHuidFormat } from '@goldsmith/compliance';
import type { CreateProductDto, UpdateProductDto, ProductResponse } from '@goldsmith/shared';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import { InventoryRepository } from './inventory.repository';
import type { ProductRow, ListProductsFilter } from './inventory.repository';

function mapRow(row: ProductRow): ProductResponse {
  return {
    id: row.id,
    shopId: row.shop_id,
    categoryId: row.category_id,
    sku: row.sku,
    metal: row.metal as ProductResponse['metal'],
    purity: row.purity,
    grossWeightG: row.gross_weight_g,
    netWeightG: row.net_weight_g,
    stoneWeightG: row.stone_weight_g,
    stoneDetails: row.stone_details,
    makingChargeOverridePct: row.making_charge_override_pct,
    huid: row.huid,
    status: row.status as ProductResponse['status'],
    publishedAt: row.published_at?.toISOString() ?? null,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(InventoryRepository) private readonly repo: InventoryRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<ProductResponse> {
    if (dto.huid) {
      const v = validateHuidFormat(dto.huid);
      if (!v.valid) {
        throw new BadRequestException({ code: 'inventory.huid_invalid', message: v.error });
      }
    }

    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const row = await this.repo.createProduct({
      ...dto,
      shopId: ctx.shopId,
      createdByUserId: ctx.userId,
    });

    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_PRODUCT_CREATED,
      subjectType: 'product',
      subjectId: row.id,
      actorUserId: ctx.userId,
      after: row,
    }).catch(() => undefined);

    return mapRow(row);
  }

  async listProducts(
    filter: Omit<ListProductsFilter, 'limit' | 'offset'> & { page?: number; pageSize?: number },
  ): Promise<ProductResponse[]> {
    const pageSize = filter.pageSize ?? 20;
    const page = filter.page ?? 1;
    const rows = await this.repo.listProducts({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: filter.status,
      metal: filter.metal,
      purity: filter.purity,
    });
    return rows.map(mapRow);
  }

  async getProduct(id: string): Promise<ProductResponse> {
    const row = await this.repo.getProduct(id);
    if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });
    return mapRow(row);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    if (dto.huid) {
      const v = validateHuidFormat(dto.huid);
      if (!v.valid) {
        throw new BadRequestException({ code: 'inventory.huid_invalid', message: v.error });
      }
    }

    const existing = await this.repo.getProduct(id);
    if (!existing) throw new NotFoundException({ code: 'inventory.product_not_found' });

    const row = await this.repo.updateProduct(id, dto);
    if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });

    const ctx = tenantContext.current();
    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_PRODUCT_UPDATED,
      subjectType: 'product',
      subjectId: row.id,
      actorUserId: ctx?.authenticated ? (ctx as AuthenticatedTenantContext).userId : undefined,
      before: existing,
      after: row,
    }).catch(() => undefined);

    return mapRow(row);
  }

  async getImageUploadUrl(productId: string, contentType: string): Promise<string> {
    const product = await this.repo.getProduct(productId);
    if (!product) throw new NotFoundException({ code: 'inventory.product_not_found' });

    const ctx = tenantContext.requireCurrent();
    const ext = contentType.split('/')[1] ?? 'bin';
    const key = `tenants/${ctx.shopId}/products/${productId}/${randomUUID()}.${ext}`;
    return this.storage.getPresignedUploadUrl(key, contentType);
  }
}
