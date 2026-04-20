import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PatchShopProfileSchema, PatchMakingChargesSchema, MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
import type { PatchShopProfileDto, ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto } from '@goldsmith/shared';
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
    const configs = stored ?? MAKING_CHARGE_DEFAULTS;
    await this.cache.setMakingCharges(configs);
    return configs;
  }

  async updateMakingCharges(dto: PatchMakingChargesDto): Promise<MakingChargeConfig[]> {
    const parsed = PatchMakingChargesSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const current = await this.getMakingCharges();
    const patchMap = new Map(parsed.data.map((c) => [c.category, c]));
    const merged = current.map((c) => patchMap.get(c.category) ?? c);

    const { before, after } = await this.repo.upsertMakingCharges(merged);

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
}
