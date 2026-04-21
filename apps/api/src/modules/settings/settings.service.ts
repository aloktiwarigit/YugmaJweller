import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PatchShopProfileSchema, PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS, PatchWastageSchema, WASTAGE_DEFAULTS, PatchRateLockSchema, RATE_LOCK_DEFAULT_DAYS } from '@goldsmith/shared';
import type { PatchShopProfileDto, ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto, WastageConfig, PatchWastageDto, PatchRateLockDto } from '@goldsmith/shared';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import { SettingsCache } from '@goldsmith/tenant-config';
import { SettingsRepository } from './settings.repository';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';

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
}
