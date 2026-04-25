import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { CreateProductSchema, UpdateProductSchema, UpdateStatusDtoSchema, GenerateBarcodesRequestSchema } from '@goldsmith/shared';
import type { CreateProductDto, UpdateProductDto, UpdateStatusDto, ProductResponse, BulkImportJobStatus, BarcodeData } from '@goldsmith/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InventoryService } from './inventory.service';
import { InventoryBulkImportService } from './inventory.bulk-import.service';
import { BarcodeService } from './barcode.service';
import { InventorySearchService } from './inventory.search.service';
import type { SearchResult } from '@goldsmith/integrations-search';
import { InventoryDeadStockService } from './inventory.dead-stock.service';
import type { DeadStockProduct } from './inventory.dead-stock.service';
import { StockMovementService } from './stock-movement.service';
import { RecordMovementBodySchema } from '@goldsmith/shared';
import type { RecordMovementBodyDto, StockMovementResponse } from '@goldsmith/shared';

@Controller('/api/v1/inventory')
export class InventoryController {
  constructor(
    private readonly svc: InventoryService,
    private readonly bulkImportSvc: InventoryBulkImportService,
    private readonly barcodeSvc: BarcodeService,
    private readonly searchSvc: InventorySearchService,
    private readonly deadStockSvc: InventoryDeadStockService,
    private readonly stockMovementSvc: StockMovementService,
  ) {}

  @Get('/search')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async searchProducts(
    @TenantContextDec() ctx: TenantContext,
    @Query('q') q: string = '',
    @Query('metal') metal?: string,
    @Query('purity') purity?: string,
    @Query('status') status?: string,
    @Query('published') publishedStr?: string,
    @Query('limit') limitStr: string = '20',
    @Query('offset') offsetStr: string = '0',
  ): Promise<SearchResult> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const published = publishedStr === undefined ? undefined : publishedStr === 'true';
    const limit = Math.min(parseInt(limitStr, 10) || 20, 100); // cap at 100
    const offset = parseInt(offsetStr, 10) || 0;
    return this.searchSvc.search(ctx, {
      q,
      filters: { metal, purity, status, published },
      limit,
      offset,
    });
  }

  @Get('/dead-stock')
  @Roles('shop_admin', 'shop_manager')
  async getDeadStock(
    @TenantContextDec() ctx: TenantContext,
  ): Promise<DeadStockProduct[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.deadStockSvc.getDeadStock(ctx);
  }


  @Post('/products')
  @Roles('shop_admin', 'shop_manager')
  async createProduct(
    @TenantContextDec() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.createProduct(dto);
  }

  @Get('/products')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listProducts(
    @TenantContextDec() ctx: TenantContext,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('status') status?: string,
    @Query('metal') metal?: string,
    @Query('purity') purity?: string,
  ): Promise<ProductResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.listProducts({ page, pageSize, status, metal, purity });
  }

  @Get('/products/:id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getProduct(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getProduct(id);
  }

  @Patch('/products/:id')
  @Roles('shop_admin', 'shop_manager')
  async updateProduct(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.updateProduct(id, dto);
  }

  @Patch('/products/:id/status')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async updateProductStatus(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateStatusDtoSchema)) dto: UpdateStatusDto,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.updateStatus(id, dto);
  }

  @Post('/products/:id/images/upload-url')
  @HttpCode(200)
  @Roles('shop_admin', 'shop_manager')
  async getImageUploadUrl(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('contentType') contentType: string,
  ): Promise<{ uploadUrl: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!contentType) throw new NotFoundException({ code: 'inventory.content_type_required' });
    const uploadUrl = await this.svc.getImageUploadUrl(id, contentType);
    return { uploadUrl };
  }

  @Post('/products/:id/publish')
  @HttpCode(200)
  @Roles('shop_admin', 'shop_manager')
  async publishProduct(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.publish(id);
  }

  @Post('/products/:id/unpublish')
  @HttpCode(200)
  @Roles('shop_admin', 'shop_manager')
  async unpublishProduct(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.unpublish(id);
  }

  @Post('/products/barcodes')
  @HttpCode(200)
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async generateBarcodes(
    @TenantContextDec() ctx: TenantContext,
    @Body(new ZodValidationPipe(GenerateBarcodesRequestSchema)) body: { productIds: string[] },
  ): Promise<BarcodeData[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.barcodeSvc.generateBarcodes(body.productIds);
  }

  @Post('/bulk-import')
  @HttpCode(200)
  @Roles('shop_admin', 'shop_manager')
  async createBulkImportUrl(
    @TenantContextDec() ctx: TenantContext,
    @Body('idempotencyKey') idempotencyKey: string,
  ): Promise<{ uploadUrl: string; jobId: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!idempotencyKey) throw new NotFoundException({ code: 'inventory.idempotency_key_required' });
    return this.bulkImportSvc.createUploadUrl(idempotencyKey);
  }

  @Post('/bulk-import/:jobId/trigger')
  @HttpCode(202)
  @Roles('shop_admin', 'shop_manager')
  async triggerBulkImport(
    @TenantContextDec() ctx: TenantContext,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<{ jobId: string; message: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const authCtx = ctx as AuthenticatedTenantContext;
    return this.bulkImportSvc.triggerJob(jobId, authCtx.userId);
  }

  @Get('/bulk-import/:jobId')
  @Roles('shop_admin', 'shop_manager')
  async getBulkImportStatus(
    @TenantContextDec() ctx: TenantContext,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<BulkImportJobStatus> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.bulkImportSvc.getJobStatus(jobId);
  }

  @Post('/products/:id/movements')
  @HttpCode(201)
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async recordStockMovement(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body(new ZodValidationPipe(RecordMovementBodySchema)) body: RecordMovementBodyDto,
  ): Promise<StockMovementResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.stockMovementSvc.recordMovement({ ...body, productId });
  }

  @Get('/products/:id/movements')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listStockMovements(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('limit') limitStr: string = '50',
    @Query('offset') offsetStr: string = '0',
  ): Promise<StockMovementResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const limit = parseInt(limitStr, 10) || 50;
    const offset = parseInt(offsetStr, 10) || 0;
    return this.stockMovementSvc.listMovements(productId, limit, offset);
  }
}
