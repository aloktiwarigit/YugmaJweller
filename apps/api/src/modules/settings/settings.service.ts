import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PatchShopProfileSchema, LoyaltyConfig, LoyaltyConfigSchema, PatchLoyaltyDto } from '@goldsmith/shared';
import type { PatchShopProfileDto, ShopProfileRow } from '@goldsmith/shared';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import { SettingsCache } from '@goldsmith/tenant-config';
import { SettingsRepository } from './settings.repository';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { UpdateLoyaltyResult } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SettingsRepository)  private readonly repo: SettingsRepository,
    @Inject(SettingsCache)       private readonly cache: SettingsCache,
    @Inject(DrizzleTenantLookup) private readonly tenantLookup: DrizzleTenantLookup,
    @Inject('PG_POOL')           private readonly pool: Pool,
  ) {}

  async getProfile(): Promise<ShopProfileRow> {
    const hit = await this.cache.getProfile();
    if (hit) return hit;
    const profile = await this.repo.getShopProfile();
    await this.cache.setProfile(profile);
    return profile;
  }

  async updateProfile(dto: PatchShopProfileDto): Promise<ShopProfileRow> {
    const parsed = PatchShopProfileSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.updateShopProfile(parsed.data);

    await this.cache.invalidate();

    const shopId = tenantContext.requireCurrent().shopId;
    if (before.name !== after.name) {
      this.tenantLookup.invalidate(shopId);
    }

    void this.auditProfileUpdate(before, after).catch(() => undefined);

    return after;
  }

  async getLoyalty(shopId: string): Promise<LoyaltyConfig> {
    const hit = await this.cache.getLoyalty();
    if (hit) return hit;
    const config = await this.repo.getLoyalty(shopId);
    await this.cache.setLoyalty(config);
    return config;
  }

  async updateLoyalty(shopId: string, dto: PatchLoyaltyDto): Promise<UpdateLoyaltyResult> {
    const current = await this.getLoyalty(shopId);
    const newConfig: LoyaltyConfig = {
      ...current,
      tiers: [...current.tiers] as LoyaltyConfig['tiers'],
    };

    if (dto.type === 'tier') {
      const thresholdPaise = SettingsService.rupeesToPaise(dto.thresholdRupees);
      newConfig.tiers = [
        { ...newConfig.tiers[0] },
        { ...newConfig.tiers[1] },
        { ...newConfig.tiers[2] },
      ] as LoyaltyConfig['tiers'];
      newConfig.tiers[dto.index] = {
        name: dto.name,
        thresholdPaise,
        badgeColor: dto.badgeColor,
      };
      // Enforce strict ascending tier order
      if (
        newConfig.tiers[0].thresholdPaise >= newConfig.tiers[1].thresholdPaise ||
        newConfig.tiers[1].thresholdPaise >= newConfig.tiers[2].thresholdPaise
      ) {
        return { ok: false, error: 'TIER_ORDER_INVALID' };
      }
    } else {
      // type === 'rate'
      newConfig.earnRatePercentage = dto.earnRatePercentage;
      newConfig.redemptionRatePercentage = dto.redemptionRatePercentage;
    }

    const parsed = LoyaltyConfigSchema.safeParse(newConfig);
    if (!parsed.success) {
      return { ok: false, error: 'SCHEMA_INVALID' };
    }

    await this.repo.upsertLoyalty(shopId, parsed.data);
    await this.cache.invalidateLoyalty();

    void auditLog(this.pool, {
      action: AuditAction.SETTINGS_LOYALTY_UPDATED,
      subjectType: 'shop',
      subjectId: shopId,
      metadata: { type: dto.type },
    }).catch(() => undefined);

    return { ok: true, config: parsed.data };
  }

  private static rupeesToPaise(rupees: string): number {
    return Math.round(parseFloat(rupees) * 100);
  }

  private async auditProfileUpdate(
    before: ShopProfileRow,
    after: ShopProfileRow,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_PROFILE_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }
}
