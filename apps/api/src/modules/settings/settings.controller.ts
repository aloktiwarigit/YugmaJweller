import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { PatchLoyaltySchema } from '@goldsmith/shared';
import type { PatchShopProfileDto } from '@goldsmith/shared';
import { SettingsService } from './settings.service';
import { BlobStorageService } from './blob-storage.service';
import type { ShopProfileResponseDto, LogoUploadUrlResponseDto, LoyaltyResponseDto } from './settings.dto';

@Controller('/api/v1/settings')
export class SettingsController {
  constructor(
    private readonly svc: SettingsService,
    private readonly blob: BlobStorageService,
  ) {}

  @Get('/profile')
  async getProfile(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShopProfileResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const profile = await this.svc.getProfile();
    const etag = `"${createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...profile, etag };
  }

  @Patch('/profile')
  async updateProfile(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: PatchShopProfileDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShopProfileResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const profile = await this.svc.updateProfile(body);
    const etag = `"${createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...profile, etag };
  }

  @Post('/profile/logo-upload-url')
  @HttpCode(200)
  async getLogoUploadUrl(
    @TenantContextDec() ctx: TenantContext,
  ): Promise<LogoUploadUrlResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    return this.blob.generateLogoSasUrl();
  }

  @Get('/loyalty')
  async getLoyalty(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoyaltyResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const config = await this.svc.getLoyalty();
    const etag = `"${createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 16)}"`;
    res.setHeader('X-ETag', etag);
    return { ...config, etag };
  }

  @Patch('/loyalty')
  async updateLoyalty(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoyaltyResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });

    const parsed = PatchLoyaltySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const result = await this.svc.updateLoyalty(parsed.data);
    if (!result.ok) {
      throw new UnprocessableEntityException({ code: result.error });
    }

    const etag = `"${createHash('sha256').update(JSON.stringify(result.config)).digest('hex').slice(0, 16)}"`;
    res.setHeader('X-ETag', etag);
    return { ...result.config, etag };
  }
}
