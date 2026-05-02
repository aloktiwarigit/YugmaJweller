import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProductImagesService } from './product-images.service';
import type { ImageRow } from './product-images.repository';

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

// F3-controller (Codex P2): upload body — alt_text capped at 200 chars,
// consistent with the service-layer guard in ProductImagesService.upload().
const uploadBodySchema = z.object({
  alt_text: z.string().max(200).nullable().optional(),
});

// F4-controller (Codex P2): reorder — orderedIds must be non-empty, UUID
// elements, AND unique (guards the single-image duplicate-ID edge case that
// the service-layer Set check also catches).
const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'orderedIds must be unique' },
  ),
});

const setAltTextSchema = z.object({
  alt_text: z.string().max(200).nullable(),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('/api/v1/products/:productId/images')
export class ProductImagesController {
  constructor(private readonly svc: ProductImagesService) {}

  // -------------------------------------------------------------------------
  // GET /api/v1/products/:productId/images
  // -------------------------------------------------------------------------

  @Get()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listImages(
    @TenantContextDec() ctx: TenantContext,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ImageRow[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.listForProduct(productId);
  }

  // -------------------------------------------------------------------------
  // POST /api/v1/products/:productId/images
  // The 5 MB Multer limit is the first enforcement layer; the service enforces
  // it again at MAX_BYTES (5,242,880) — both must agree.
  // F7-controller (Codex P2): Idempotency-Key header passed through to service.
  // -------------------------------------------------------------------------

  @Post()
  @HttpCode(201)
  @Roles('shop_admin', 'shop_manager')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(
    @TenantContextDec() ctx: TenantContext,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Body() rawBody: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ImageRow> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED' });

    const bodyParse = uploadBodySchema.safeParse(rawBody);
    if (!bodyParse.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', detail: bodyParse.error.flatten() });
    }

    return this.svc.upload({
      productId,
      file: {
        buffer:   file.buffer,
        mimeType: file.mimetype,
        size:     file.size,
      },
      altText:        bodyParse.data.alt_text ?? null,
      idempotencyKey: idempotencyKey ?? null,
    });
  }

  // -------------------------------------------------------------------------
  // DELETE /api/v1/products/:productId/images/:imageId
  // -------------------------------------------------------------------------

  @Delete(':imageId')
  @HttpCode(204)
  @Roles('shop_admin', 'shop_manager')
  async deleteImage(
    @TenantContextDec() ctx: TenantContext,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.delete(productId, imageId);
  }

  // -------------------------------------------------------------------------
  // PATCH /api/v1/products/:productId/images/order
  // -------------------------------------------------------------------------

  @Patch('order')
  @Roles('shop_admin', 'shop_manager')
  async reorderImages(
    @TenantContextDec() ctx: TenantContext,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() body: unknown,
  ): Promise<{ images: ImageRow[] }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', detail: parsed.error.flatten() });
    }
    const images = await this.svc.reorder(productId, parsed.data.orderedIds);
    return { images };
  }

  // -------------------------------------------------------------------------
  // PATCH /api/v1/products/:productId/images/:imageId
  // -------------------------------------------------------------------------

  @Patch(':imageId')
  @Roles('shop_admin', 'shop_manager')
  async setAltText(
    @TenantContextDec() ctx: TenantContext,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body() body: unknown,
  ): Promise<{ image: ImageRow }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const parsed = setAltTextSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', detail: parsed.error.flatten() });
    }
    const image = await this.svc.setAltText(productId, imageId, parsed.data.alt_text);
    return { image };
  }
}
