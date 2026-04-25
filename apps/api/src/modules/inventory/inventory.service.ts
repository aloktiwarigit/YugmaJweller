import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertValidTransition } from './state-machine';
import type { ProductStatus } from './state-machine';
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
    quantity: row.quantity,
    publishedAt: row.published_at?.toISOString() ?? null,
    publishedByUserId: row.published_by_user_id ?? null,
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

  async updateStatus(
    productId: string,
    dto: { status: ProductStatus; note?: string },
  ): Promise<ProductResponse> {
    const existing = await this.repo.getProduct(productId);
    if (!existing) throw new NotFoundException({ code: 'inventory.product_not_found' });

    assertValidTransition(existing.status as ProductStatus, dto.status);

    const row = await this.repo.updateStatusAtomic(productId, existing.status, dto.status);
    if (!row) {
      throw new ConflictException({
        code: 'inventory.status_conflict',
        message: 'Product status was changed concurrently; please refresh and try again',
      });
    }

    const ctx = tenantContext.current();
    const actorUserId = ctx?.authenticated ? (ctx as AuthenticatedTenantContext).userId : undefined;

    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_STATUS_CHANGED,
      subjectType: 'product',
      subjectId: row.id,
      actorUserId,
      before: { status: existing.status },
      after: { status: dto.status, note: dto.note },
    }).catch(() => undefined);

    return mapRow(row);
  }

  async publish(productId: string): Promise<ProductResponse> {
    const existing = await this.repo.getProduct(productId);
    if (!existing) throw new NotFoundException({ code: 'inventory.product_not_found' });

    // Hallmarked products must have a valid non-empty HUID before publish
    if (existing.huid !== null && existing.huid.trim() === '') {
      throw new UnprocessableEntityException({ code: 'catalog.product_missing_huid' });
    }

    const imageCount = await this.repo.countImages(productId);
    if (imageCount === 0) {
      throw new UnprocessableEntityException({ code: 'catalog.product_missing_images' });
    }

    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const row = await this.repo.publishProduct(productId, ctx.userId);
    if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });

    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_PRODUCT_PUBLISHED,
      subjectType: 'product',
      subjectId: productId,
      actorUserId: ctx.userId,
      before: { published_at: null },
      after: { published_at: row.published_at },
    }).catch(() => undefined);

    // TODO Epic 7: emit domain event inventory.product_published
    return mapRow(row);
  }

  async unpublish(productId: string): Promise<ProductResponse> {
    const existing = await this.repo.getProduct(productId);
    if (!existing) throw new NotFoundException({ code: 'inventory.product_not_found' });

    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const row = await this.repo.unpublishProduct(productId);
    if (!row) throw new NotFoundException({ code: 'inventory.product_not_found' });

    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_PRODUCT_UNPUBLISHED,
      subjectType: 'product',
      subjectId: productId,
      actorUserId: ctx.userId,
      before: { published_at: existing.published_at },
      after: { published_at: null },
    }).catch(() => undefined);

    // TODO Epic 7: emit domain event inventory.product_unpublished
    return mapRow(row);
  }

  async getImageUploadUrl(productId: string, contentType: string): Promise<string> {
    const product = await this.repo.getProduct(productId);
    if (!product) throw new NotFoundException({ code: 'inventory.product_not_found' });

    const ctx = tenantContext.requireCurrent();
    const ext = contentType.split('/')[1] ?? 'bin';
    const key = `tenants/${ctx.shopId}/products/${productId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.getPresignedUploadUrl(key, contentType);

    // Register the image record now so countImages() returns > 0 after first upload URL is issued.
    // Optimistic pre-insert: the image row exists regardless of whether the client completes the upload.
    void this.repo.insertImageRecord(ctx.shopId, productId, key).catch(() => undefined);

    return uploadUrl;
  }
}
