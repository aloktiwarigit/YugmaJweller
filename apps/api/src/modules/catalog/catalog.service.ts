import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { PricingService } from '../pricing/pricing.service';
import type { CurrentRatesResult } from '../pricing/pricing.service';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceBreakdown } from '@goldsmith/money';
import { MAKING_CHARGE_DEFAULTS, StorefrontConfigSchema, STOREFRONT_CONFIG_DEFAULTS } from '@goldsmith/shared';
import type { MakingChargeConfig, StorefrontConfig } from '@goldsmith/shared';
import { SettingsRepository } from '../settings/settings.repository';
import {
  IMAGEKIT_URL_BUILDER,
  ImageKitTransformUrlBuilder,
} from '@goldsmith/integrations-storage';
import type { CatalogImage, Collection, CategoryNode, PublicReviewItem, PublicReviewsResponse } from '@goldsmith/customer-shared';
import { withSpan } from '@goldsmith/observability';
import * as Sentry from '@sentry/node';

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
  primaryImage:          CatalogImage | null;   // B3
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface GetProductsParams {
  shopId:       string;
  categoryId?:  string;
  search?:      string;
  metal?:       string;
  // B1 new params
  purity?:      string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  style?:       string;
  occasion?:    string;
  giftPersona?: string;
  collection?:  string; // UUID or slug — resolved inside withShopTx
  sort?:        'newest' | 'priceAsc' | 'priceDesc' | 'trending' | 'bestseller';
  page:         number;
  limit:        number;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
}

// ---------------------------------------------------------------------------
// Story 17.1 — Task 7: Public image DTO (F6-server)
// MUST NOT contain storage_key — leaking internal blob paths is a security issue.
// All URLs are built server-side via ImageKitTransformUrlBuilder so mobile/web
// never construct ImageKit URLs client-side (NFR-IMG-1 enforcement).
// ---------------------------------------------------------------------------

export interface PublicImageRow {
  id:              string;
  alt_text:        string | null;
  width:           number;
  height:          number;
  /** 4-candidate srcset: 320w, 640w, 1024w, 1920w */
  srcset:          string;
  /** w=1024 default for <img src> fallback */
  default_url:     string;
  /** w=200, blur=30 for LQIP/progressive reveal */
  placeholder_url: string;
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
  // B3: image columns from LEFT JOIN product_images pi
  pi_storage_key:            string | null;
  pi_alt_text:               string | null;
  pi_width:                  number | null;
  pi_height:                 number | null;
}

// ---------------------------------------------------------------------------
// Sort clause builder — maps known enum values to hardcoded SQL strings only.
// No user input ever appears in the SQL template (injection-safe).
// ---------------------------------------------------------------------------

function buildSortClause(sort?: string): string {
  switch (sort) {
    case 'priceAsc':   return 'p.price_snapshot_paise ASC NULLS LAST, p.published_at DESC';
    case 'priceDesc':  return 'p.price_snapshot_paise DESC NULLS LAST, p.published_at DESC';
    case 'trending':   return 'p.view_count_30d DESC, p.published_at DESC';
    case 'bestseller': return '(p.sales_count_30d * 2 + p.view_count_30d) DESC, p.published_at DESC';
    default:           return 'p.published_at DESC';
  }
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
    @Inject(IMAGEKIT_URL_BUILDER) private readonly urlBuilder: ImageKitTransformUrlBuilder,
  ) {}

  async getTenantConfig(slug: string): Promise<TenantConfigResponse> {
    return withSpan('catalog.getTenantConfig', { 'catalog.slug': slug }, async () => {
      Sentry.addBreadcrumb({ category: 'catalog', message: 'getTenantConfig', data: { slug }, level: 'info' });
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
    });
  }

  async getProducts(params: GetProductsParams): Promise<CatalogProductsResponse> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getProducts', data: { tenant_id: params.shopId, sort: params.sort }, level: 'info' });
    return withSpan('catalog.getProducts', { 'tenant.id': params.shopId, 'catalog.sort': params.sort ?? 'newest' }, async () => {
    const {
      shopId, categoryId, search, metal, purity, priceMin, priceMax,
      inStockOnly, style, occasion, giftPersona, collection, sort, page, limit,
    } = params;
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;
    const orderBy   = buildSortClause(sort);

    const [ratesResult, scopedResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      withShopTx(this.pool, shopId, async (tx) => {
        const queryParams: unknown[] = [shopId];
        let whereExtra = '';

        // ─── existing filters ────────────────────────────────────────────────
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

        // ─── B1 new filters ──────────────────────────────────────────────────
        if (purity && purity.trim().length > 0) {
          queryParams.push(purity.trim());
          whereExtra += ` AND p.purity = $${queryParams.length}`;
        }
        if (priceMin !== undefined) {
          queryParams.push(priceMin);
          whereExtra += ` AND p.price_snapshot_paise >= $${queryParams.length}`;
        }
        if (priceMax !== undefined) {
          queryParams.push(priceMax);
          whereExtra += ` AND p.price_snapshot_paise < $${queryParams.length}`;
        }
        if (inStockOnly) {
          whereExtra += ` AND p.quantity > 0`;
        }
        if (style && style.trim().length > 0) {
          queryParams.push(style.trim());
          whereExtra += ` AND p.style = $${queryParams.length}`;
        }
        if (occasion && occasion.trim().length > 0) {
          queryParams.push(occasion.trim());
          whereExtra += ` AND $${queryParams.length} = ANY(p.occasion)`;
        }
        if (giftPersona && giftPersona.trim().length > 0) {
          queryParams.push(giftPersona.trim());
          whereExtra += ` AND $${queryParams.length} = ANY(p.gift_persona)`;
        }

        // ─── collection filter (UUID passthrough or slug → id lookup) ────────
        if (collection && collection.trim().length > 0) {
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let collectionId: string;
          if (UUID_RE.test(collection)) {
            collectionId = collection;
          } else {
            const r = await tx.query<{ id: string }>(
              `SELECT id FROM collections WHERE shop_id = $1 AND slug = $2 AND published_at IS NOT NULL`,
              [shopId, collection.trim()],
            );
            if (!r.rows[0]) {
              return {
                mcResult:       { rows: [] } as { rows: Array<{ making_charges_json: MakingChargeConfig[] | null }> },
                productsResult: { rows: [] } as { rows: Array<ProductCatalogRow> },
              };
            }
            collectionId = r.rows[0].id;
          }
          queryParams.push(collectionId);
          whereExtra += ` AND EXISTS (
          SELECT 1 FROM collection_products cp
           WHERE cp.product_id    = p.id
             AND cp.shop_id       = $1
             AND cp.collection_id = $${queryParams.length}
        )`;
        }

        queryParams.push(safeLimit, offset);
        const limitIdx  = queryParams.length - 1;
        const offsetIdx = queryParams.length;

        // EXISTS guard: suspended/terminated tenants must not surface products.
        const sql = `
        SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
               pc.name AS category_name,
               p.gross_weight_g, p.net_weight_g,
               p.making_charge_override_pct,
               p.huid, p.huid_exemption_category, p.quantity, p.published_at,
               pi.storage_key AS pi_storage_key,
               pi.alt_text    AS pi_alt_text,
               pi.width       AS pi_width,
               pi.height      AS pi_height,
               COUNT(*) OVER() AS total_count
          FROM products p
          LEFT JOIN product_categories pc ON pc.id = p.category_id
          LEFT JOIN product_images pi ON pi.id = p.primary_image_id
         WHERE p.shop_id = $1
           AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')
           AND p.published_at IS NOT NULL
           ${whereExtra}
         ORDER BY ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

        const [mcResult, productsResult] = await Promise.all([
          tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
            `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
            [shopId],
          ),
          tx.query<ProductCatalogRow>(sql, queryParams),
        ]);
        return { mcResult, productsResult };
      }),
    ]);

    const { mcResult, productsResult } = scopedResult;
    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));
    const total = productsResult.rows.length > 0 ? Number(productsResult.rows[0].total_count) : 0;
    const items: CatalogProduct[] = productsResult.rows.map((row) =>
      this.computeCatalogProduct(row, ratesResult, mcMap),
    );
    return { items, total, page: safePage };
    }); // withSpan catalog.getProducts
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from slug lookup, not TenantContext
  async getProduct(id: string, shopId: string): Promise<CatalogProduct> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getProduct', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getProduct', { 'tenant.id': shopId }, async () => {
    const [ratesResult, scopedResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      withShopTx(this.pool, shopId, async (tx) => {
        const [mcResult, productResult] = await Promise.all([
          tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
            `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
            [shopId],
          ),
          tx.query<ProductCatalogRow>(
            // EXISTS guard: suspended/terminated tenants must 404 from public catalog detail too.
            `SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
                    pc.name AS category_name,
                    p.gross_weight_g, p.net_weight_g,
                    p.making_charge_override_pct,
                    p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                    pi.storage_key AS pi_storage_key,
                    pi.alt_text    AS pi_alt_text,
                    pi.width       AS pi_width,
                    pi.height      AS pi_height,
                    '1' AS total_count
               FROM products p
              LEFT JOIN product_categories pc ON pc.id = p.category_id
              LEFT JOIN product_images pi ON pi.id = p.primary_image_id
             WHERE p.id = $1 AND p.shop_id = $2
               AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
               AND p.published_at IS NOT NULL`,
            [id, shopId],
          ),
        ]);
        return { mcResult, productResult };
      }),
    ]);
    const { mcResult, productResult } = scopedResult;

    if (productResult.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }

    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    return this.computeCatalogProduct(productResult.rows[0], ratesResult, mcMap);
    }); // withSpan catalog.getProduct
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from slug lookup, not TenantContext
  async verifyHuid(productId: string, shopId: string, qrPayload: string): Promise<HuidVerifyResult> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'verifyHuid', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.verifyHuid', { 'tenant.id': shopId }, async () => {
    const extractedHuid = parseHuidFromQr(qrPayload);
    if (!extractedHuid) {
      throw new BadRequestException({ code: 'catalog.huid_qr_invalid' });
    }
    const certifyingBody = certifyingBodyFromQr(qrPayload);

    const r = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ huid: string | null }>(
        // EXISTS guard: HUID verification must also respect tenant suspension. Without it, a
        // caller with a cached shop+product ID could keep verifying HUID after suspend.
        `SELECT huid FROM products
          WHERE id = $1 AND shop_id = $2
            AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
            AND published_at IS NOT NULL`,
        [productId, shopId],
      ),
    );
    if (r.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }

    const productHuid = r.rows[0].huid;
    const verified = productHuid !== null && productHuid.toUpperCase() === extractedHuid;
    return { verified, huid: extractedHuid, certifyingBody };
    }); // withSpan catalog.verifyHuid
  }

  private toCardImage(row: Pick<ProductCatalogRow, 'pi_storage_key' | 'pi_alt_text' | 'pi_width' | 'pi_height'>): CatalogImage | null {
    if (!row.pi_storage_key) return null;
    return {
      url:            this.urlBuilder.url(row.pi_storage_key, { width: 640 }),
      placeholderUrl: this.urlBuilder.url(row.pi_storage_key, { width: 40, blur: 30 }),
      srcset:         this.urlBuilder.cardSrcset(row.pi_storage_key),
      width:          row.pi_width  ?? 0,
      height:         row.pi_height ?? 0,
      alt:            row.pi_alt_text,
    };
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
      primaryImage:          this.toCardImage(row),  // B3
    };
  }

  // ---------------------------------------------------------------------------
  // Story 17.1 Task 7 — public images for a product
  // Public catalog routes don't run under TenantContext (no auth middleware).
  // Shop scope comes from the x-tenant-id header (same pattern as getProduct).
  // Use explicit shop-scoped transaction helper so RLS is active under app_user.
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from slug lookup, not TenantContext
  async listPublicImages(productId: string, shopId: string): Promise<PublicImageRow[]> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'listPublicImages', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.listPublicImages', { 'tenant.id': shopId }, async () => {
    // Only show images for published products of ACTIVE shops (security guard).
    // "Published" = products.published_at IS NOT NULL (set by publishProduct() in
    // inventory.service). The products.status column is independent of publish state
    // and must not be used as the publish gate.
    const r = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{
        id: string; alt_text: string | null; width: number; height: number; storage_key: string;
      }>(
        `SELECT pi.id, pi.alt_text, pi.width, pi.height, pi.storage_key
           FROM product_images pi
           JOIN products p ON p.id = pi.product_id
          WHERE pi.product_id = $1
            AND pi.shop_id = $2
            AND p.published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
          ORDER BY pi.sort_order ASC, pi.created_at ASC`,
        [productId, shopId],
      ),
    );
    return r.rows.map((row) => this.toPublicImageRow(row));
    }); // withSpan catalog.listPublicImages
  }

  private toPublicImageRow(row: { id: string; alt_text: string | null; width: number; height: number; storage_key: string }): PublicImageRow {
    return {
      id:              row.id,
      alt_text:        row.alt_text,
      width:           row.width,
      height:          row.height,
      srcset:          this.urlBuilder.srcset(row.storage_key),
      default_url:     this.urlBuilder.url(row.storage_key, { width: 1024 }),
      placeholder_url: this.urlBuilder.url(row.storage_key, { width: 200, blur: 30 }),
    };
  }

  async getReturnPolicy(): Promise<{ returnPolicyText: string | null }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getReturnPolicy', data: {}, level: 'info' });
    const text = await this.settingsRepo.getReturnPolicy();
    return { returnPolicyText: text };
  }

  // ---------------------------------------------------------------------------
  // Story B4 — public reviews with PII redaction + visibility filter
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from x-tenant-id header, not TenantContext
  async getPublicProductReviews(params: {
    shopId:    string;
    productId: string;
    page:      number;
    limit:     number;
  }): Promise<PublicReviewsResponse> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getPublicProductReviews', data: { tenant_id: params.shopId }, level: 'info' });
    return withSpan('catalog.getPublicProductReviews', { 'tenant.id': params.shopId }, async () => {
    const { shopId, productId } = params;
    const safePage  = Math.max(1, params.page);
    const safeLimit = Math.min(50, Math.max(1, params.limit));
    const offset    = (safePage - 1) * safeLimit;

    return withShopTx(this.pool, shopId, async (tx) => {
      // Step 1 — existence guard: product must belong to this (active) tenant and be published.
      // 404 on miss prevents tenant enumeration (caller cannot distinguish "no reviews"
      // from "wrong tenant / suspended shop").
      const existsResult = await tx.query<{ id: string }>(
        `SELECT 1 AS id FROM products
          WHERE id = $1
            AND shop_id = $2
            AND published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')`,
        [productId, shopId],
      );
      if (existsResult.rows.length === 0) {
        throw new NotFoundException({ code: 'catalog.product_not_found' });
      }

      // Step 2 — reviews list + rating breakdown run in parallel inside the same tx.
      // PII redaction is computed in SQL: raw customer name never reaches the app layer.
      // LEFT JOIN handles deleted-customer rows (null name → 'Anonymous').
      const [reviewsResult, breakdownResult] = await Promise.all([
        tx.query<{
          id:                    string;
          rating:                number;
          review_text:           string | null;
          customer_display_name: string;
          created_at:            Date;
        }>(
          `SELECT
             pr.id,
             pr.rating,
             pr.review_text,
             CASE
               WHEN c.name IS NULL THEN 'Anonymous'
               WHEN position(' ' IN c.name) = 0 THEN c.name
               ELSE split_part(c.name, ' ', 1) || ' ' || LEFT(split_part(c.name, ' ', -1), 1) || '.'
             END AS customer_display_name,
             pr.created_at
           FROM product_reviews pr
           LEFT JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
           WHERE pr.shop_id = $1
             AND pr.product_id = $2
             AND pr.is_publicly_visible = TRUE
           ORDER BY pr.created_at DESC
           LIMIT $3 OFFSET $4`,
          [shopId, productId, safeLimit, offset],
        ),
        tx.query<{ rating: number; cnt: number }>(
          `SELECT rating, COUNT(*)::int AS cnt
             FROM product_reviews
            WHERE shop_id = $1
              AND product_id = $2
              AND is_publicly_visible = TRUE
            GROUP BY rating`,
          [shopId, productId],
        ),
      ]);

      const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      for (const row of breakdownResult.rows) {
        const star = row.rating as 1 | 2 | 3 | 4 | 5;
        breakdown[star] = row.cnt;
        total += row.cnt;
      }

      const items: PublicReviewItem[] = reviewsResult.rows.map((row) => ({
        id:                  row.id,
        rating:              row.rating,
        reviewText:          row.review_text,
        customerDisplayName: row.customer_display_name,
        createdAt:           row.created_at.toISOString(),
      }));

      return { items, total, page: safePage, ratingBreakdown: breakdown };
    });
    }); // withSpan catalog.getPublicProductReviews
  }

  // ---------------------------------------------------------------------------
  // Private helper — fetch a list of published products with the standard join
  // and map them to CatalogProduct[]. Used by featured/new-arrivals/top-sellers.
  // extraWhere must only contain hardcoded SQL (never user-supplied strings).
  // params[0] is always shopId.
  // ---------------------------------------------------------------------------
  private async fetchProductCards(
    shopId: string,
    extraWhere: string,
    extraParams: unknown[],
    orderBy: string,
    limit: number,
  ): Promise<CatalogProduct[]> {
    const allParams: unknown[] = [shopId, ...extraParams, limit];
    const limitIdx = allParams.length;

    const [ratesResult, scopedResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      withShopTx(this.pool, shopId, async (tx) => {
        const [mcResult, productsResult] = await Promise.all([
          tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
            `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
            [shopId],
          ),
          tx.query<ProductCatalogRow>(
            `SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
                    pc.name AS category_name,
                    p.gross_weight_g, p.net_weight_g,
                    p.making_charge_override_pct,
                    p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                    pi.storage_key AS pi_storage_key,
                    pi.alt_text    AS pi_alt_text,
                    pi.width       AS pi_width,
                    pi.height      AS pi_height,
                    '0'::text      AS total_count
               FROM products p
               LEFT JOIN product_categories pc ON pc.id = p.category_id
               LEFT JOIN product_images pi ON pi.id = p.primary_image_id
              WHERE p.shop_id = $1
                AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')
                AND p.published_at IS NOT NULL
                AND p.quantity > 0
                ${extraWhere}
              ORDER BY ${orderBy}
              LIMIT $${limitIdx}`,
            allParams,
          ),
        ]);
        return { mcResult, productsResult };
      }),
    ]);

    const configs = scopedResult.mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));
    return scopedResult.productsResult.rows.map((row) =>
      this.computeCatalogProduct(row, ratesResult, mcMap),
    );
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/categories
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getCategories(shopId: string): Promise<{ categories: CategoryNode[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getCategories', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getCategories', { 'tenant.id': shopId }, async () => {
    const result = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ id: string; name: string; name_hi: string | null; product_count: number }>(
        `SELECT pc.id, pc.name, pc.name_hi, COUNT(p.id)::int AS product_count
           FROM product_categories pc
           LEFT JOIN products p ON p.category_id = pc.id
             AND p.shop_id = pc.shop_id
             AND p.published_at IS NOT NULL
             AND p.quantity > 0
          WHERE pc.shop_id = $1
            AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')
          GROUP BY pc.id, pc.name, pc.name_hi
          ORDER BY product_count DESC, pc.name ASC`,
        [shopId],
      ),
    );

    const categories: CategoryNode[] = result.rows.map((row) => ({
      id:           row.id,
      name:         row.name,
      slug:         row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      productCount: row.product_count,
    }));
    return { categories };
    }); // withSpan catalog.getCategories
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/collections
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getCollections(shopId: string): Promise<{ items: Collection[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getCollections', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getCollections', { 'tenant.id': shopId }, async () => {
    const result = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{
        id: string; slug: string; title_hi: string; title_en: string | null;
        subtitle_hi: string | null; is_premium: boolean;
        hero_storage_key: string | null; hero_alt: string | null;
        hero_w: number | null; hero_h: number | null;
        product_count: number;
      }>(
        `SELECT c.id, c.slug, c.title_hi, c.title_en, c.subtitle_hi, c.is_premium,
                pi.storage_key AS hero_storage_key, pi.alt_text AS hero_alt,
                pi.width AS hero_w, pi.height AS hero_h,
                COUNT(cp.product_id)::int AS product_count
           FROM collections c
           LEFT JOIN product_images pi ON pi.id = c.hero_image_id AND pi.shop_id = c.shop_id
           LEFT JOIN collection_products cp ON cp.collection_id = c.id AND cp.shop_id = c.shop_id
          WHERE c.shop_id = $1
            AND c.published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')
          GROUP BY c.id, c.slug, c.title_hi, c.title_en, c.subtitle_hi, c.is_premium,
                   c.sort_order, c.created_at,
                   pi.storage_key, pi.alt_text, pi.width, pi.height
          ORDER BY c.sort_order ASC, c.created_at ASC`,
        [shopId],
      ),
    );

    const items: Collection[] = result.rows.map((row) => ({
      id:           row.id,
      slug:         row.slug,
      titleHi:      row.title_hi,
      titleEn:      row.title_en ?? undefined,
      subtitleHi:   row.subtitle_hi ?? undefined,
      heroImage:    row.hero_storage_key ? this.toCardImage({
        pi_storage_key: row.hero_storage_key,
        pi_alt_text:    row.hero_alt,
        pi_width:       row.hero_w,
        pi_height:      row.hero_h,
      }) : null,
      productCount: row.product_count,
      isPremium:    row.is_premium,
    }));
    return { items };
    }); // withSpan catalog.getCollections
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/collections/:slug
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getCollection(
    slug: string,
    shopId: string,
    page: number,
    limit: number,
  ): Promise<{ collection: Collection; products: CatalogProductsResponse }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getCollection', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getCollection', { 'tenant.id': shopId }, async () => {
    // Validate collection exists (also gates product list)
    const colResult = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ id: string; title_hi: string; title_en: string | null; subtitle_hi: string | null; is_premium: boolean; hero_storage_key: string | null; hero_alt: string | null; hero_w: number | null; hero_h: number | null }>(
        `SELECT c.id, c.title_hi, c.title_en, c.subtitle_hi, c.is_premium,
                pi.storage_key AS hero_storage_key, pi.alt_text AS hero_alt,
                pi.width AS hero_w, pi.height AS hero_h
           FROM collections c
           LEFT JOIN product_images pi ON pi.id = c.hero_image_id AND pi.shop_id = c.shop_id
          WHERE c.shop_id = $1 AND c.slug = $2 AND c.published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')`,
        [shopId, slug],
      ),
    );
    if (colResult.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.collection_not_found' });
    }
    const col = colResult.rows[0];
    const collection: Collection = {
      id:         col.id,
      slug,
      titleHi:    col.title_hi,
      titleEn:    col.title_en ?? undefined,
      subtitleHi: col.subtitle_hi ?? undefined,
      heroImage:  col.hero_storage_key ? this.toCardImage({ pi_storage_key: col.hero_storage_key, pi_alt_text: col.hero_alt, pi_width: col.hero_w, pi_height: col.hero_h }) : null,
      productCount: 0, // populated below via getProducts total
      isPremium:  col.is_premium,
    };

    const products = await this.getProducts({ shopId, collection: col.id, page, limit });
    collection.productCount = products.total;
    return { collection, products };
    }); // withSpan catalog.getCollection
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/products/featured
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getFeatured(shopId: string, limit: number): Promise<{ items: CatalogProduct[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getFeatured', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getFeatured', { 'tenant.id': shopId }, async () => {
    const items = await this.fetchProductCards(
      shopId,
      'AND p.featured_score > 0',
      [],
      'p.featured_score DESC, p.published_at DESC',
      limit,
    );
    return { items };
    }); // withSpan catalog.getFeatured
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/products/new-arrivals
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getNewArrivals(shopId: string, limit: number): Promise<{ items: CatalogProduct[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getNewArrivals', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getNewArrivals', { 'tenant.id': shopId }, async () => {
    const items = await this.fetchProductCards(
      shopId,
      `AND p.published_at >= NOW() - INTERVAL '30 days'`,
      [],
      'p.published_at DESC',
      limit,
    );
    return { items };
    }); // withSpan catalog.getNewArrivals
  }

  // ---------------------------------------------------------------------------
  // B2 — GET /catalog/products/top-sellers
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getTopSellers(shopId: string, limit: number): Promise<{ items: CatalogProduct[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getTopSellers', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getTopSellers', { 'tenant.id': shopId }, async () => {
    const items = await this.fetchProductCards(
      shopId,
      '',
      [],
      '(p.sales_count_30d * 2 + p.view_count_30d) DESC, p.published_at DESC',
      limit,
    );
    return { items };
    }); // withSpan catalog.getTopSellers
  }

  // ---------------------------------------------------------------------------
  // B5 — GET /catalog/storefront-config
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getStorefrontConfig(shopId: string): Promise<StorefrontConfig> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getStorefrontConfig', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getStorefrontConfig', { 'tenant.id': shopId }, async () => {
    const result = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ storefront_config_json: unknown }>(
        `SELECT ss.storefront_config_json
           FROM shop_settings ss
          WHERE ss.shop_id = $1
            AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')`,
        [shopId],
      ),
    );

    const raw = result.rows[0]?.storefront_config_json ?? {};
    try {
      const merged = { ...STOREFRONT_CONFIG_DEFAULTS, ...(typeof raw === 'object' && raw !== null ? raw : {}) };
      return StorefrontConfigSchema.parse(merged);
    } catch {
      this.logger.warn(`storefront-config parse failed for shop ${shopId} — returning defaults`);
      return STOREFRONT_CONFIG_DEFAULTS;
    }
    }); // withSpan catalog.getStorefrontConfig
  }

  // ---------------------------------------------------------------------------
  // B6 — GET /catalog/products/:id/recommendations
  // Multi-tier: same collection → same style → same metal+purity+weight ±20%
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint
  async getRecommendations(productId: string, shopId: string): Promise<{ items: CatalogProduct[] }> {
    Sentry.addBreadcrumb({ category: 'catalog', message: 'getRecommendations', data: { tenant_id: shopId }, level: 'info' });
    return withSpan('catalog.getRecommendations', { 'tenant.id': shopId }, async () => {
    // Step 1: fetch the source product's attributes for tier matching
    const srcResult = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ collection_id: string | null; style: string | null; metal: string; purity: string; net_weight_g: string }>(
        `SELECT p.style, p.metal, p.purity, p.net_weight_g,
                (SELECT cp.collection_id FROM collection_products cp
                  WHERE cp.product_id = $1 AND cp.shop_id = $2
                  ORDER BY cp.sort_order ASC LIMIT 1) AS collection_id
           FROM products p
          WHERE p.id = $1 AND p.shop_id = $2
            AND p.published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')`,
        [productId, shopId],
      ),
    );
    if (srcResult.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }
    const src = srcResult.rows[0];
    const weightG = parseFloat(src.net_weight_g);
    const weightLow = (weightG * 0.80).toFixed(3);
    const weightHigh = (weightG * 1.20).toFixed(3);

    const [ratesResult, scopedResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      withShopTx(this.pool, shopId, async (tx) => {
        const BASE_WHERE = `
          p.id != $1
          AND p.shop_id = $2
          AND p.published_at IS NOT NULL
          AND p.quantity > 0`;

        const CARD_SELECT = `
          SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
                 pc.name AS category_name,
                 p.gross_weight_g, p.net_weight_g,
                 p.making_charge_override_pct,
                 p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                 pi.storage_key AS pi_storage_key,
                 pi.alt_text    AS pi_alt_text,
                 pi.width       AS pi_width,
                 pi.height      AS pi_height,
                 '0'::text      AS total_count
            FROM products p
            LEFT JOIN product_categories pc ON pc.id = p.category_id
            LEFT JOIN product_images pi ON pi.id = p.primary_image_id`;

        const [mcResult, tier1, tier2, tier3] = await Promise.all([
          tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
            `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
            [shopId],
          ),
          // Tier 1: same collection
          src.collection_id
            ? tx.query<ProductCatalogRow>(
                `${CARD_SELECT}
                 WHERE ${BASE_WHERE}
                   AND EXISTS (
                     SELECT 1 FROM collection_products cp
                      WHERE cp.product_id = p.id
                        AND cp.collection_id = $3
                        AND cp.shop_id = $2
                   )
                 LIMIT 4`,
                [productId, shopId, src.collection_id],
              )
            : Promise.resolve({ rows: [] as ProductCatalogRow[] }),
          // Tier 2: same style
          src.style
            ? tx.query<ProductCatalogRow>(
                `${CARD_SELECT}
                 WHERE ${BASE_WHERE}
                   AND p.style = $3
                 LIMIT 4`,
                [productId, shopId, src.style],
              )
            : Promise.resolve({ rows: [] as ProductCatalogRow[] }),
          // Tier 3: same metal + purity + weight ±20%
          tx.query<ProductCatalogRow>(
            `${CARD_SELECT}
             WHERE ${BASE_WHERE}
               AND p.metal = $3
               AND p.purity = $4
               AND p.net_weight_g::numeric BETWEEN $5 AND $6
             LIMIT 6`,
            [productId, shopId, src.metal, src.purity, weightLow, weightHigh],
          ),
        ]);
        return { mcResult, tier1: tier1.rows, tier2: tier2.rows, tier3: tier3.rows };
      }),
    ]);

    const configs = scopedResult.mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    // De-duplicate across tiers, cap at 6
    const seen = new Set<string>();
    const merged: ProductCatalogRow[] = [];
    for (const row of [...scopedResult.tier1, ...scopedResult.tier2, ...scopedResult.tier3]) {
      if (!seen.has(row.id) && merged.length < 6) {
        seen.add(row.id);
        merged.push(row);
      }
    }

    return { items: merged.map((row) => this.computeCatalogProduct(row, ratesResult, mcMap)) };
    }); // withSpan catalog.getRecommendations
  }

  private readonly logger = new Logger(CatalogService.name);
}
