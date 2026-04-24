import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  PatchShopProfileSchema, LoyaltyConfig, LoyaltyConfigSchema, PatchLoyaltyDto,
  PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS, PatchWastageSchema, WASTAGE_DEFAULTS,
  PatchRateLockSchema, RATE_LOCK_DEFAULT_DAYS,
  PatchTryAtHomeSchema, TRY_AT_HOME_DEFAULT_MAX_PIECES,
  PatchCustomOrderPolicySchema, PatchReturnPolicySchema,
  PatchNotificationPrefsSchema, NOTIFICATION_PREFS_DEFAULTS,
} from '@goldsmith/shared';
import type {
  PatchShopProfileDto, ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto,
  WastageConfig, PatchWastageDto, PatchRateLockDto, PatchTryAtHomeDto, TryAtHomeRow,
  PatchCustomOrderPolicyDto, PatchReturnPolicyDto, PatchNotificationPrefsDto, NotificationPrefsConfig,
} from '@goldsmith/shared';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import { SettingsCache, FeatureFlagsCache } from '@goldsmith/tenant-config';
import type { FeatureFlags } from '@goldsmith/tenant-config';
import { SettingsRepository } from './settings.repository';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { UpdateLoyaltyResult } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SettingsRepository)  private readonly repo: SettingsRepository,
    @Inject(SettingsCache)       private readonly cache: SettingsCache,
    @Inject(FeatureFlagsCache)   private readonly flagsCache: FeatureFlagsCache,
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

  async getCustomOrderPolicy(): Promise<string | null> {
    const hit = await this.cache.getCustomOrderPolicy();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getCustomOrderPolicy();
    await this.cache.setCustomOrderPolicy(stored);
    return stored;
  }

  async updateCustomOrderPolicy(dto: PatchCustomOrderPolicyDto): Promise<string | null> {
    const parsed = PatchCustomOrderPolicySchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    const { before, after } = await this.repo.updateCustomOrderPolicy(parsed.data.customOrderPolicyText);
    await this.cache.invalidateCustomOrderPolicy();
    void this.auditPolicyUpdate(AuditAction.SETTINGS_CUSTOM_ORDER_POLICY_UPDATED, before, after).catch(() => undefined);
    return after;
  }

  async getReturnPolicy(): Promise<string | null> {
    const hit = await this.cache.getReturnPolicy();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getReturnPolicy();
    await this.cache.setReturnPolicy(stored);
    return stored;
  }

  async updateReturnPolicy(dto: PatchReturnPolicyDto): Promise<string | null> {
    const parsed = PatchReturnPolicySchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    const { before, after } = await this.repo.updateReturnPolicy(parsed.data.returnPolicyText);
    await this.cache.invalidateReturnPolicy();
    void this.auditPolicyUpdate(AuditAction.SETTINGS_RETURN_POLICY_UPDATED, before, after).catch(() => undefined);
    return after;
  }

  async getNotificationPrefs(): Promise<NotificationPrefsConfig> {
    const hit = await this.cache.getNotificationPrefs();
    if (hit !== undefined) return hit;
    const stored = await this.repo.getNotificationPrefs();
    const prefs = stored ?? NOTIFICATION_PREFS_DEFAULTS;
    await this.cache.setNotificationPrefs(prefs);
    return prefs;
  }

  async updateNotificationPrefs(dto: PatchNotificationPrefsDto): Promise<NotificationPrefsConfig> {
    const parsed = PatchNotificationPrefsSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }
    // Merge happens inside the repo transaction against a FOR UPDATE-locked row,
    // so concurrent partial PATCHes on different keys never lose each other's changes.
    const { before, after } = await this.repo.updateNotificationPrefs(parsed.data);
    await this.cache.invalidateNotificationPrefs();
    void this.auditNotificationPrefsUpdate(before, after).catch(() => undefined);
    return after;
  }

  private async auditPolicyUpdate(
    action: AuditAction,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  private async auditNotificationPrefsUpdate(
    before: NotificationPrefsConfig | null,
    after: NotificationPrefsConfig,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_NOTIFICATION_PREFS_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  private static rupeesToPaise(rupees: string): number {
    const [whole = '0', frac = ''] = rupees.split('.');
    const wholePaise = parseInt(whole, 10) * 100;
    const fracPaise = parseInt(frac.slice(0, 2).padEnd(2, '0'), 10);
    const paise = wholePaise + fracPaise;
    if (!Number.isFinite(paise) || paise < 0 || paise > 1_000_000_000) {
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

  async getRateLock(): Promise<number> {
    const hit = await this.cache.getRateLock();
    if (hit !== null) return hit;
    const stored = await this.repo.getRateLockDays();
    const days = stored ?? RATE_LOCK_DEFAULT_DAYS;
    await this.cache.setRateLock(days);
    return days;
  }

  async updateRateLock(dto: PatchRateLockDto): Promise<number> {
    const parsed = PatchRateLockSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.updateRateLockDays(parsed.data.rateLockDays);
    await this.cache.invalidateRateLock();
    void this.auditRateLockUpdate(before, after).catch(() => undefined);
    return after;
  }

  private async auditRateLockUpdate(
    before: number | null,
    after: number,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_RATE_LOCK_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }

  async getTryAtHome(): Promise<TryAtHomeRow> {
    const { enabled, maxPieces } = await this.repo.getTryAtHome();
    return {
      tryAtHomeEnabled: enabled,
      tryAtHomeMaxPieces: maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES,
    };
  }

  async updateTryAtHome(dto: PatchTryAtHomeDto): Promise<TryAtHomeRow> {
    const parsed = PatchTryAtHomeSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new UnprocessableEntityException({ code: 'validation.failed', errors });
    }

    const current = await this.repo.getTryAtHome();
    const currentMaxPieces = current.maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES;
    const nextEnabled = parsed.data.tryAtHomeEnabled ?? current.enabled;
    // "If tryAtHomeEnabled=false in the request → ignore tryAtHomeMaxPieces"
    const nextMaxPieces = parsed.data.tryAtHomeEnabled === false
      ? currentMaxPieces
      : (parsed.data.tryAtHomeMaxPieces ?? currentMaxPieces);

    const { before, after } = await this.repo.updateTryAtHome(nextEnabled, nextMaxPieces);

    const { shopId } = tenantContext.requireCurrent();
    await this.flagsCache.invalidate(shopId);

    void this.auditTryAtHomeUpdate(before, after).catch(() => undefined);

    return after;
  }

  async getFeatureFlags(): Promise<FeatureFlags> {
    const { shopId } = tenantContext.requireCurrent();
    const hit = await this.flagsCache.getFlags(shopId);
    if (hit) return hit;
    const { enabled, maxPieces } = await this.repo.getTryAtHome();
    const flags: FeatureFlags = {
      try_at_home: enabled,
      max_pieces: maxPieces ?? TRY_AT_HOME_DEFAULT_MAX_PIECES,
    };
    await this.flagsCache.setFlags(shopId, flags);
    return flags;
  }

  private async auditTryAtHomeUpdate(
    before: TryAtHomeRow,
    after: TryAtHomeRow,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_TRY_AT_HOME_UPDATED,
      subjectType: 'shop',
      subjectId: tc.shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }
}
