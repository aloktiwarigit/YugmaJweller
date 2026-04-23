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
import type { TenantContext } from '@goldsmith/tenant-context';
import { CreateProductSchema, UpdateProductSchema } from '@goldsmith/shared';
import type { CreateProductDto, UpdateProductDto, ProductResponse } from '@goldsmith/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@Controller('/api/v1/inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

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
  @Roles('shop_admin', 'shop_manager')
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
  @Roles('shop_admin', 'shop_manager')
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
}
