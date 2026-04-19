import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { BlobStorageService } from './blob-storage.service';
import type { ShopProfileResponseDto, LogoUploadUrlResponseDto } from './settings.dto';
import type { PatchShopProfileDto } from '@goldsmith/shared';

@Controller('/api/v1/settings')
@UseGuards(new RolesGuard(new Reflector()))
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly svc: SettingsService,
    @Inject(BlobStorageService) private readonly blob: BlobStorageService,
  ) {}

  @Get('/profile')
  @Roles('shop_admin', 'shop_manager')
  async getProfile(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShopProfileResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const profile = await this.svc.getProfile(ctx.shopId);
    const etag = `"${createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...profile, etag };
  }

  @Patch('/profile')
  @Roles('shop_admin')
  async updateProfile(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: PatchShopProfileDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShopProfileResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const profile = await this.svc.updateProfile(ctx.shopId, body);
    const etag = `"${createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...profile, etag };
  }

  @Post('/profile/logo-upload-url')
  @HttpCode(200)
  @Roles('shop_admin')
  async getLogoUploadUrl(
    @TenantContextDec() ctx: TenantContext,
  ): Promise<LogoUploadUrlResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.blob.generateLogoSasUrl(ctx.shopId);
  }
}
