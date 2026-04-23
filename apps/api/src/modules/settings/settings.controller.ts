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
import { PatchLoyaltySchema, PatchTryAtHomeSchema } from '@goldsmith/shared';
import type {
  PatchShopProfileDto, PatchMakingChargesDto, PatchWastageDto, PatchRateLockDto,
} from '@goldsmith/shared';
import { SettingsService } from './settings.service';
import { BlobStorageService } from './blob-storage.service';
import type {
  ShopProfileResponseDto, LogoUploadUrlResponseDto, MakingChargesResponseDto,
  WastageResponseDto, RateLockResponseDto, LoyaltyResponseDto,
  TryAtHomeResponseDto, FeatureFlagsResponseDto,
} from './settings.dto';

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

  @Get('/making-charges')
  async getMakingCharges(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MakingChargesResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const configs = await this.svc.getMakingCharges();
    const etag = `"${createHash('sha256').update(JSON.stringify(configs)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { configs, etag };
  }

  @Patch('/making-charges')
  async updateMakingCharges(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: PatchMakingChargesDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MakingChargesResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const configs = await this.svc.updateMakingCharges(body);
    const etag = `"${createHash('sha256').update(JSON.stringify(configs)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { configs, etag };
  }

  @Get('/wastage')
  async getWastage(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WastageResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const configs = await this.svc.getWastage();
    const etag = `"${createHash('sha256').update(JSON.stringify(configs)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { configs, etag };
  }

  @Patch('/wastage')
  async updateWastage(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: PatchWastageDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WastageResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const configs = await this.svc.updateWastage(body);
    const etag = `"${createHash('sha256').update(JSON.stringify(configs)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { configs, etag };
  }

  @Get('/rate-lock')
  async getRateLock(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RateLockResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const days = await this.svc.getRateLock();
    const etag = `"${createHash('sha256').update(JSON.stringify(days)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { rateLockDays: days, etag };
  }

  @Patch('/rate-lock')
  async updateRateLock(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: PatchRateLockDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RateLockResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const days = await this.svc.updateRateLock(body);
    const etag = `"${createHash('sha256').update(JSON.stringify(days)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { rateLockDays: days, etag };
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
    res.setHeader('ETag', etag);
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
      const code = result.error === 'TIER_ORDER_INVALID'
        ? 'settings.tier_order_invalid'
        : result.error;
      throw new UnprocessableEntityException({ code });
    }

    const etag = `"${createHash('sha256').update(JSON.stringify(result.config)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...result.config, etag };
  }

  @Get('/try-at-home')
  async getTryAtHome(
    @TenantContextDec() ctx: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TryAtHomeResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    const data = await this.svc.getTryAtHome();
    const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...data, etag };
  }

  @Patch('/try-at-home')
  async updateTryAtHome(
    @TenantContextDec() ctx: TenantContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TryAtHomeResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });

    const parsed = PatchTryAtHomeSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const data = await this.svc.updateTryAtHome(parsed.data);
    const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    return { ...data, etag };
  }

  @Get('/feature-flags')
  async getFeatureFlags(
    @TenantContextDec() ctx: TenantContext,
  ): Promise<FeatureFlagsResponseDto> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getFeatureFlags();
  }
}
