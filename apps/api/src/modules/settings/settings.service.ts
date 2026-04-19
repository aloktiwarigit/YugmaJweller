import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PatchShopProfileSchema } from '@goldsmith/shared';
import type { PatchShopProfileDto, ShopProfileRow } from '@goldsmith/shared';
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

  async getProfile(shopId: string): Promise<ShopProfileRow> {
    const hit = await this.cache.getProfile(shopId);
    if (hit) return hit;
    const profile = await this.repo.getShopProfile(shopId);
    await this.cache.setProfile(shopId, profile);
    return profile;
  }

  async updateProfile(shopId: string, dto: PatchShopProfileDto): Promise<ShopProfileRow> {
    const parsed = PatchShopProfileSchema.safeParse(dto);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.message }));
      throw new BadRequestException({ code: 'validation.failed', errors });
    }

    const { before, after } = await this.repo.updateShopProfile(shopId, parsed.data);

    await this.cache.invalidate(shopId);

    if (before.name !== after.name) {
      this.tenantLookup.invalidate(shopId);
    }

    void this.auditProfileUpdate(shopId, before, after).catch(() => undefined);

    return after;
  }

  private async auditProfileUpdate(
    shopId: string,
    before: ShopProfileRow,
    after: ShopProfileRow,
  ): Promise<void> {
    const tc = tenantContext.current();
    if (!tc) return;
    await auditLog(this.pool, {
      action: AuditAction.SETTINGS_PROFILE_UPDATED,
      subjectType: 'shop',
      subjectId: shopId,
      actorUserId: tc.authenticated ? tc.userId : undefined,
      before,
      after,
    });
  }
}
