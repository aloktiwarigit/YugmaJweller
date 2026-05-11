import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

export interface ShopBranding {
  displayName: string;
  logoUrl: string | null;
  addressText: string;
  gstin: string | null;
  contactPhone: string | null;
}

@Injectable()
export class BrandingLoader {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async load(): Promise<ShopBranding> {
    const ctx = tenantContext.requireCurrent();
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{
        display_name:    string;
        logo_url:        string | null;
        address_json:    Record<string, unknown> | null;
        gstin:           string | null;
        contact_phone:   string | null;
      }>(
        `SELECT display_name, logo_url, address_json, gstin, contact_phone
         FROM shops
         WHERE id = $1`,
        [ctx.shopId],
      );
      if (!r.rows[0]) throw new NotFoundException({ code: 'shop.not_found' });
      const row = r.rows[0];
      return {
        displayName:  row.display_name,
        logoUrl:      row.logo_url,
        addressText:  row.address_json ? this.formatAddress(row.address_json) : '',
        gstin:        row.gstin,
        contactPhone: row.contact_phone,
      };
    });
  }

  private formatAddress(addr: Record<string, unknown>): string {
    return [addr['line1'], addr['line2'], addr['city'], addr['state'], addr['pincode']]
      .filter(Boolean)
      .join(', ');
  }
}
