import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { ShopProfileRow, PatchShopProfileDto, AddressDto, OperatingHoursDto, MakingChargeConfig } from '@goldsmith/shared';
import type { UpdateProfileResult, UpdateMakingChargesResult } from './settings.types';

interface ShopsRow {
  display_name: string;
  address_json: AddressDto | null;
  gstin: string | null;
  bis_registration: string | null;
  contact_phone: string | null;
  operating_hours_json: OperatingHoursDto | null;
  about_text: string | null;
  logo_url: string | null;
  years_in_business: number | null;
  updated_at: Date;
}

@Injectable()
export class SettingsRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getShopProfile(): Promise<ShopProfileRow> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<ShopsRow>(
        `SELECT display_name, address_json, gstin, bis_registration, contact_phone,
                operating_hours_json, about_text, logo_url, years_in_business, updated_at
           FROM shops WHERE id = $1`,
        [shopId],
      );
      if (r.rows.length === 0) throw new NotFoundException({ code: 'shop.not_found' });
      return this.mapRow(r.rows[0]);
    });
  }

  async updateShopProfile(patch: PatchShopProfileDto): Promise<UpdateProfileResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const before = await this.readProfileTx(tx);

      const { sets, params } = this.buildSetClause(patch);
      let after: ShopProfileRow;

      if (sets.length > 0) {
        params.push(shopId);
        const r = await tx.query<ShopsRow>(
          `UPDATE shops
              SET ${sets.join(', ')}, updated_at = now()
            WHERE id = $${params.length}
            RETURNING display_name, address_json, gstin, bis_registration, contact_phone,
                      operating_hours_json, about_text, logo_url, years_in_business, updated_at`,
          params,
        );
        after = this.mapRow(r.rows[0]);
      } else {
        after = before;
      }

      await tx.query(
        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
        [shopId],
      );

      return { before, after };
    });
  }

  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;
      const r = await tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      if (r.rows.length === 0) return null;
      return r.rows[0].making_charges_json;
    });
  }

  async upsertMakingCharges(configs: MakingChargeConfig[]): Promise<UpdateMakingChargesResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shopId = tenantContext.requireCurrent().shopId;

      const beforeRow = await tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      );
      const before = beforeRow.rows.length > 0 ? beforeRow.rows[0].making_charges_json : null;

      const r = await tx.query<{ making_charges_json: MakingChargeConfig[] }>(
        `INSERT INTO shop_settings (shop_id, making_charges_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (shop_id)
         DO UPDATE SET making_charges_json = $2::jsonb, updated_at = now()
         RETURNING making_charges_json`,
        [shopId, JSON.stringify(configs)],
      );
      const after = r.rows[0].making_charges_json;

      return { before, after };
    });
  }

  private async readProfileTx(tx: PoolClient): Promise<ShopProfileRow> {
    const shopId = tenantContext.requireCurrent().shopId;
    const r = await tx.query<ShopsRow>(
      `SELECT display_name, address_json, gstin, bis_registration, contact_phone,
              operating_hours_json, about_text, logo_url, years_in_business, updated_at
         FROM shops WHERE id = $1`,
      [shopId],
    );
    if (r.rows.length === 0) throw new NotFoundException({ code: 'shop.not_found' });
    return this.mapRow(r.rows[0]);
  }

  private buildSetClause(patch: PatchShopProfileDto): { sets: string[]; params: unknown[] } {
    const sets: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown): void => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.name !== undefined)             push('display_name', patch.name);
    if ('address' in patch)                   push('address_json', patch.address ? JSON.stringify(patch.address) : null);
    if ('gstin' in patch)                     push('gstin', patch.gstin);
    if ('bis_registration' in patch)          push('bis_registration', patch.bis_registration);
    if ('contact_phone' in patch)             push('contact_phone', patch.contact_phone);
    if ('operating_hours' in patch)           push('operating_hours_json', patch.operating_hours ? JSON.stringify(patch.operating_hours) : null);
    if ('about_text' in patch)                push('about_text', patch.about_text);
    if ('logo_url' in patch)                  push('logo_url', patch.logo_url);
    if ('years_in_business' in patch)         push('years_in_business', patch.years_in_business);

    return { sets, params };
  }

  private mapRow(row: ShopsRow): ShopProfileRow {
    return {
      name:              row.display_name,
      address:           row.address_json,
      gstin:             row.gstin,
      bis_registration:  row.bis_registration,
      contact_phone:     row.contact_phone,
      operating_hours:   row.operating_hours_json,
      about_text:        row.about_text,
      logo_url:          row.logo_url,
      years_in_business: row.years_in_business,
      updated_at:        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}
