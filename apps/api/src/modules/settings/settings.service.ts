import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PatchShopProfileSchema, LoyaltyConfig, LoyaltyConfigSchema, PatchLoyaltyDto, PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS, PatchWastageSchema, WASTAGE_DEFAULTS } from '@goldsmith/shared';
import type { PatchShopProfileDto, ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto, WastageConfig, PatchWastageDto } from '@goldsmith/shared';
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

  async getLoyalty(): Promise<LoyaltyConfig> {
    const hit = await this.cache.getLoyalty();
    if (hit) return hit;
    const config = await this.repo.getLoyalty();
    await this.cache.setLoyalty(config);
    return config;
  }

  async updateLoyalty(dto: PatchLoyaltyDto): Promise<UpdateLoyaltyResult> {
    const current = await this.getLoyalty();
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
    } else {
      // type === 'rate'
      newConfig.earnRatePercentage = dto.earnRatePercentage;
      newConfig.redemptionRatePercentage = dto.redemptionRatePercentage;
    }

    // Enforce strict ascending tier order on both branches
    if (!SettingsService.isAscendingOrder(newConfig.tiers)) {
      return { ok: false, error: 'TIER_ORDER_INVALID' };
    }

    const parsed = LoyaltyConfigSchema.safeParse(newConfig);
    if (!parsed.success) {
      return { ok: false, error: 'SCHEMA_INVALID' };
    }

    await this.repo.upsertLoyalty(parsed.data);
    await this.cache.invalidateLoyalty();

    const { shopId } = tenantContext.requireCurrent();
    void auditLog(this.pool, {
      action: AuditAction.SETTINGS_LOYALTY_UPDATED,
      subjectType: 'shop',
      subjectId: shopId,
      metadata: { type: dto.type, before: current, after: parsed.data },
    }).catch(() => undefined);

    return { ok: true, config: parsed.data };
  }

  private static rupeesToPaise(rupees: string): number {
    const paise = Math.round(parseFloat(rupees) * 100);
    if (!Number.isInteger(paise) || paise < 0 || paise > 1_000_000_000) {
      throw new UnprocessableEntityException({ code: 'settings.threshold_out_of_range' });
    }
    return paise;
  }

  private static isAscendingOrder(tiers: LoyaltyConfig['tiers']): boolean {
    return tiers[0].thresholdPaise < tiers[1].thresholdPaise &&
           tiers[1].thresholdPaise < tiers[2].thresholdPaise;
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

  async getMakingCharges(): Promise<MakingChargeConfig[]> {
    const hit = await this.cache.getMakingCharges();
    if (hit) return hit;
    const stored = await this.repo.getMakingCharges();
    let configs: MakingChargeConfig[];
    if (!stored) {
      configs = MAKING_CHARGE_DEFAULTS;
    } else {
      const storedMap = new Map(stored.map((c) => [c.category, c]));
      configs = MAKING_CHARGE_DEFAULTS.map((d) => storedMap.get(d.category) ?? d);
    }
    await this.cache.setMakingCharges(configs);
    return configs;
  }

  async updateMakingCharges(dto: PatchMakingChargesDto): Promise<MakingChargeConfig[]> {
    const parsed = PatchMakingChargesSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.upsertMakingCharges(parsed.data, MAKING_CHARGE_DEFAULTS);

    await this.cache.invalidateMakingCharges();

    void this.auditMakingChargesUpdate(before, after).catch(() => undefined);

    return after;
  }

  private async auditMakingChargesUpdate(
    before: MakingChargeConfig[] | null,
    after: MakingChargeConfig[],
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_MAKING_CHARGES_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getWastage(): Promise<WastageConfig[]> {
    const hit = await this.cache.getWastage();
    if (hit) return hit;
    const storedMap = await this.repo.getWastage();
    const configs: WastageConfig[] = storedMap === null
      ? WASTAGE_DEFAULTS
      : WASTAGE_DEFAULTS.map((d) => ({ category: d.category, percent: storedMap[d.category] ?? d.percent }));
    await this.cache.setWastage(configs);
    return configs;
  }

  async updateWastage(dto: PatchWastageDto): Promise<WastageConfig[]> {
    const parsed = PatchWastageSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    if (parseFloat(parsed.data.percent) > 30) {
      throw new UnprocessableEntityException({
        code: 'settings.wastage_high',
        message: 'घटत 30% से ज़्यादा नहीं होनी चाहिए',
      });
    }

    const { before, after } = await this.repo.upsertWastage(
      parsed.data.category,
      parsed.data.percent,
    );

    await this.cache.invalidateWastage();

    void this.auditWastageUpdate(before, after).catch(() => undefined);

    return after;
  }

  private async auditWastageUpdate(
    before: WastageConfig[] | null,
    after: WastageConfig[],
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_WASTAGE_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }
}
