import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PricingService } from '../pricing/pricing.service';
import type { CurrentRatesResult } from '../pricing/pricing.service';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceBreakdown } from '@goldsmith/money';
import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
import type { MakingChargeConfig } from '@goldsmith/shared';
import { SettingsRepository } from '../settings/settings.repository';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface TenantConfigResponse {
  shopId:          string;
  primaryColor:    string;
  logoUrl:         string | null;
  appName:         string;
  defaultLanguage: string;
}

export interface EstimatedPrice {
  totalFormatted: string;
  totalPaise:     string;
  breakdown: {
    goldValuePaise:    string;
    makingChargePaise: string;
    gstMetalPaise:     string;
    gstMakingPaise:    string;
  };
}

export interface CatalogProduct {
  id:                    string;
  sku:                   string;
  metal:                 string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  grossWeightG:          string;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface GetProductsParams {
  shopId:      string;
  categoryId?: string;
  search?:     string;
  metal?:      string;
  page:        number;
  limit:       number;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
}

// ---------------------------------------------------------------------------
// HUID QR parsing helpers
// ---------------------------------------------------------------------------

// Boundary: the 6-char HUID must be followed by a non-alphanumeric char or end-of-string.
// This prevents `AB1234ZZ` from matching as `AB1234`.
const HUID_BOUNDARY = '(?=[^A-Za-z0-9]|$)';

function parseHuidFromQr(payload: string): string | null {
  const trimmed = payload.trim();
  // BIS URL format: ?huid=AB1234 or &huid=AB1234
  const queryMatch = trimmed.match(new RegExp(`[?&]huid=([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (queryMatch) return queryMatch[1].toUpperCase();
  // Path format: /huid/AB1234
  const pathMatch = trimmed.match(new RegExp(`\\/huid\\/([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (pathMatch) return pathMatch[1].toUpperCase();
  // HUID: prefix
  const prefixMatch = trimmed.match(new RegExp(`^HUID:([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (prefixMatch) return prefixMatch[1].toUpperCase();
  // Raw 6-char alphanumeric
  if (/^[A-Za-z0-9]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function certifyingBodyFromQr(payload: string): string {
  if (/bis\.gov\.in/i.test(payload)) return 'BIS';
  if (/jewel\.bis/i.test(payload)) return 'BIS';
  return 'BIS';
}

// ---------------------------------------------------------------------------
// Internal DB row shapes (exported for testing)
// ---------------------------------------------------------------------------

interface ShopRow {
  id:           string;
  display_name: string;
  logo_url:     string | null;
  config:       Record<string, unknown> | null;
}

export interface ProductCatalogRow {
  id:                        string;
  sku:                       string;
  metal:                     string;
  purity:                    string;
  category_id:               string | null;
  category_name:             string | null;
  gross_weight_g:            string;
  net_weight_g:              string;
  making_charge_override_pct: string | null;
  huid:                      string | null;
  huid_exemption_category:   string;
  quantity:                  number;
  published_at:              Date;
  total_count:               string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CatalogService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(SettingsRepository) private readonly settingsRepo: SettingsRepository,
  ) {}

  async getTenantConfig(slug: string): Promise<TenantConfigResponse> {
    const r = await this.pool.query<ShopRow>(
      `SELECT id, display_name, logo_url, config
         FROM shops
        WHERE slug = $1 AND status = 'ACTIVE'`,
      [slug],
    );
    if (r.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.shop_not_found' });
    }
    const row = r.rows[0];
    return {
      shopId:          row.id,
      primaryColor:    (row.config?.['primaryColor'] as string | undefined) ?? '#B58A3C',
      logoUrl:         row.logo_url ?? null,
      appName:         row.display_name,
      defaultLanguage: (row.config?.['defaultLanguage'] as string | undefined) ?? 'hi',
    };
  }

  async getProducts(params: GetProductsParams): Promise<CatalogProductsResponse> {
    const { shopId, categoryId, search, metal, page, limit } = params;
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    const queryParams: unknown[] = [shopId];
    let whereExtra = '';

    if (categoryId) {
      queryParams.push(categoryId);
      whereExtra += ` AND p.category_id = $${queryParams.length}`;
    }
    if (metal && metal.trim().length > 0) {
      queryParams.push(metal.trim().toUpperCase());
      whereExtra += ` AND p.metal = $${queryParams.length}`;
    }
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      queryParams.push(term);
      const idx = queryParams.length;
      whereExtra += ` AND (p.sku ILIKE $${idx} OR p.metal ILIKE $${idx} OR p.purity ILIKE $${idx})`;
    }

    queryParams.push(safeLimit, offset);
    const limitIdx  = queryParams.length - 1;
    const offsetIdx = queryParams.length;

    const sql = `
      SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
             pc.name AS category_name,
             p.gross_weight_g, p.net_weight_g,
             p.making_charge_override_pct,
             p.huid, p.huid_exemption_category, p.quantity, p.published_at,
             COUNT(*) OVER() AS total_count
        FROM products p
        LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.shop_id = $1
         AND p.status = 'PUBLISHED'
         ${whereExtra}
       ORDER BY p.published_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const [ratesResult, mcResult, productsResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      this.pool.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      ),
      this.pool.query<ProductCatalogRow>(sql, queryParams),
    ]);

    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    const total = productsResult.rows.length > 0 ? Number(productsResult.rows[0].total_count) : 0;

    const items: CatalogProduct[] = productsResult.rows.map((row) =>
      this.computeCatalogProduct(row, ratesResult, mcMap),
    );

    return { items, total, page: safePage };
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from slug lookup, not TenantContext
  async getProduct(id: string, shopId: string): Promise<CatalogProduct> {
    const [ratesResult, mcResult, productResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      this.pool.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      ),
      this.pool.query<ProductCatalogRow>(
        `SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
                pc.name AS category_name,
                p.gross_weight_g, p.net_weight_g,
                p.making_charge_override_pct,
                p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                '1' AS total_count
           FROM products p
           LEFT JOIN product_categories pc ON pc.id = p.category_id
          WHERE p.id = $1 AND p.shop_id = $2 AND p.status = 'PUBLISHED'`,
        [id, shopId],
      ),
    ]);

    if (productResult.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }

    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    return this.computeCatalogProduct(productResult.rows[0], ratesResult, mcMap);
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from slug lookup, not TenantContext
  async verifyHuid(productId: string, shopId: string, qrPayload: string): Promise<HuidVerifyResult> {
    const extractedHuid = parseHuidFromQr(qrPayload);
    if (!extractedHuid) {
      throw new BadRequestException({ code: 'catalog.huid_qr_invalid' });
    }
    const certifyingBody = certifyingBodyFromQr(qrPayload);

    const r = await this.pool.query<{ huid: string | null }>(
      `SELECT huid FROM products WHERE id = $1 AND shop_id = $2 AND status = 'PUBLISHED'`,
      [productId, shopId],
    );
    if (r.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }

    const productHuid = r.rows[0].huid;
    const verified = productHuid !== null && productHuid.toUpperCase() === extractedHuid;
    return { verified, huid: extractedHuid, certifyingBody };
  }

  private computeCatalogProduct(
    row: ProductCatalogRow,
    rates: CurrentRatesResult,
    mcMap: Map<string, string>,
  ): CatalogProduct {
    const rateEntry = (rates as unknown as Record<string, { perGramPaise: bigint } | undefined>)[row.purity];

    let priceAvailable = false;
    let estimatedPrice: EstimatedPrice | undefined;

    if (rateEntry) {
      const makingChargePct =
        row.making_charge_override_pct ??
        mcMap.get(row.category_name ?? '') ??
        '12.00';

      try {
        const breakdown: PriceBreakdown = computeProductPrice({
          netWeightG:        row.net_weight_g,
          ratePerGramPaise:  rateEntry.perGramPaise,
          makingChargePct,
          stoneChargesPaise: 0n,
          hallmarkFeePaise:  0n,
        });

        priceAvailable = true;
        estimatedPrice = {
          totalFormatted: breakdown.totalFormatted,
          totalPaise:     breakdown.totalPaise.toString(),
          breakdown: {
            goldValuePaise:    breakdown.goldValuePaise.toString(),
            makingChargePaise: breakdown.makingChargePaise.toString(),
            gstMetalPaise:     breakdown.gstMetalPaise.toString(),
            gstMakingPaise:    breakdown.gstMakingPaise.toString(),
          },
        };
      } catch {
        // RangeError from computeProductPrice (e.g. zero weight) — show "contact for price"
      }
    }

    return {
      id:                    row.id,
      sku:                   row.sku,
      metal:                 row.metal,
      purity:                row.purity,
      categoryId:            row.category_id,
      categoryName:          row.category_name,
      grossWeightG:          row.gross_weight_g,
      netWeightG:            row.net_weight_g,
      huid:                  row.huid,
      huidExemptionCategory: row.huid_exemption_category,
      quantity:              row.quantity,
      priceAvailable,
      estimatedPrice,
      publishedAt:           row.published_at.toISOString(),
    };
  }

  async getReturnPolicy(): Promise<{ returnPolicyText: string | null }> {
    const text = await this.settingsRepo.getReturnPolicy();
    return { returnPolicyText: text };
  }
}
