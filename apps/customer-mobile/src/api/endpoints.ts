import axios from 'axios';
import { api } from './client';
import type { Tenant, TenantBranding } from '../stores/tenantStore';
import type {
  PublicRatesResponse,
  CatalogProduct,
  CatalogProductsResponse,
  HuidVerifyResult,
  ReviewsResponse,
  PublicReviewsResponse,
} from '@goldsmith/customer-shared';
import { catalogImageUriForHint } from '../assets/storefrontImages';

// CatalogEstimatedPrice was the mobile-side name for EstimatedPrice.
// Re-export as alias to avoid breaking existing mobile code that references it.
export type { EstimatedPrice as CatalogEstimatedPrice } from '@goldsmith/customer-shared';
export type {
  PublicRateEntry,
  PublicRatesResponse,
  CatalogProduct,
  CatalogProductsResponse,
  HuidVerifyResult,
  ReviewItem,
  ReviewsResponse,
  PublicReviewsResponse,
} from '@goldsmith/customer-shared';

interface TenantBootApiResponse {
  id: string;
  display_name: string;
  config: Record<string, unknown> | null;
}

export interface PublicProduct {
  id:            string;
  sku:           string;
  metal:         string;
  purity:        string;
  categoryId:    string;
  categoryName:  string;
  grossWeightG:  string;
  netWeightG:    string;
  huid:          string | null;
  huidExemptionCategory: string;
  quantity:      number;
  priceAvailable: boolean;
  publishedAt:   string;
  primaryImage:  string | null;
}

export interface PublicProductsResponse {
  items: PublicProduct[];
  total: number;
}

export interface TypedApiError extends Error {
  code: string;
  status?: number;
}

export async function getTenantBoot(
  slug: string,
  etag?: string,
): Promise<{ tenant: Tenant | null; etag: string | null; notModified: boolean }> {
  const res = await api.get<TenantBootApiResponse>(`/api/v1/tenant/boot`, {
    params: { slug },
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (s: number) => s === 200 || s === 304,
  });
  if (res.status === 304) {
    return { tenant: null, etag: etag ?? null, notModified: true };
  }
  // The API returns snake_case `{ id, display_name, config }` from
  // `tenant_boot_lookup`. `shops.config` is a flat JSONB of snake_case keys
  // (e.g. `app_name`, `default_language`, `primary_color`), NOT a nested
  // `branding` object — see apps/api/test/tenant-boot.integration.test.ts
  // for the production seed shape. Map each known key into the mobile
  // `TenantBranding` interface; unknown keys are ignored.
  const tenant: Tenant = {
    id: res.data.id,
    slug,
    displayName: res.data.display_name,
    branding: brandingFromConfig(res.data.config),
  };
  return {
    tenant,
    etag: (res.headers['etag'] as string | undefined) ?? null,
    notModified: false,
  };
}

function brandingFromConfig(config: Record<string, unknown> | null): TenantBranding {
  if (config === null || typeof config !== 'object') return {};
  const lang = config['default_language'];
  const logoUrl = typeof config['logo_url'] === 'string' ? (config['logo_url'] as string) : undefined;
  return {
    primaryColor: typeof config['primary_color'] === 'string' ? (config['primary_color'] as string) : undefined,
    secondaryColor: typeof config['secondary_color'] === 'string' ? (config['secondary_color'] as string) : undefined,
    logoUrl: logoUrl ? resolveApiAssetUrl(logoUrl) : undefined,
    appName: typeof config['app_name'] === 'string' ? (config['app_name'] as string) : undefined,
    defaultLanguage: lang === 'hi-IN' || lang === 'en-IN' ? lang : undefined,
  };
}

type CatalogImageLike = {
  url: string;
  placeholderUrl: string;
  srcset: string;
};

type CatalogProductWithImage = {
  primaryImage: CatalogImageLike | null;
};

function resolveApiAssetUrl(value: string): string {
  if (/^(?:https?|data|file|content|asset):/i.test(value)) return value;
  if (value.startsWith('/demo-shop/')) return catalogImageUriForHint(value);
  const baseURL = api.defaults.baseURL;
  if (!baseURL) return value;
  try {
    return new URL(value, baseURL).toString();
  } catch {
    return value;
  }
}

function resolveApiSrcset(srcset: string): string {
  return srcset
    .split(',')
    .map((entry) => {
      const [url, ...descriptor] = entry.trim().split(/\s+/);
      if (!url) return entry.trim();
      const resolved = resolveApiAssetUrl(url);
      if (resolved.startsWith('data:')) return resolved;
      return [resolved, ...descriptor].join(' ');
    })
    .join(', ');
}

function normalizeCatalogImage<T extends CatalogImageLike | null>(image: T): T {
  if (!image) return image;
  return {
    ...image,
    url: resolveApiAssetUrl(image.url),
    placeholderUrl: resolveApiAssetUrl(image.placeholderUrl),
    srcset: resolveApiSrcset(image.srcset),
  };
}

function normalizeCatalogProduct<T extends CatalogProductWithImage>(product: T): T {
  return {
    ...product,
    primaryImage: normalizeCatalogImage(product.primaryImage),
  };
}

function normalizeCatalogProducts<T extends { items: CatalogProductWithImage[] }>(data: T): T {
  return {
    ...data,
    items: data.items.map(normalizeCatalogProduct),
  };
}

export async function getPublicRates(): Promise<PublicRatesResponse> {
  const res = await api.get<PublicRatesResponse>('/api/v1/catalog/rates');
  return res.data;
}

export async function listPublicProducts(opts: { limit?: number } = {}): Promise<PublicProductsResponse> {
  const res = await api.get<PublicProductsResponse>('/api/v1/catalog/products', {
    params: opts.limit ? { limit: opts.limit } : undefined,
  });
  return res.data;
}

export async function getCatalogProducts(opts: {
  metal?:       string;
  purity?:      string;
  search?:      string;
  categoryId?:  string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  style?:       string;
  occasion?:    string;
  sort?:        string;
  page?:        number;
  limit?:       number;
} = {}): Promise<CatalogProductsResponse> {
  const params: Record<string, string | number | boolean> = {};
  if (opts.metal)                    params['metal']       = opts.metal;
  if (opts.purity)                   params['purity']      = opts.purity;
  if (opts.search)                   params['search']      = opts.search;
  if (opts.categoryId)               params['categoryId']  = opts.categoryId;
  if (opts.priceMin !== undefined)   params['priceMin']    = opts.priceMin;
  if (opts.priceMax !== undefined)   params['priceMax']    = opts.priceMax;
  if (opts.inStockOnly)              params['inStockOnly'] = true;
  if (opts.style)                    params['style']       = opts.style;
  if (opts.occasion)                 params['occasion']    = opts.occasion;
  if (opts.sort)                     params['sort']        = opts.sort;
  if (opts.page)                     params['page']        = opts.page;
  if (opts.limit)                    params['limit']       = opts.limit;
  const res = await api.get<CatalogProductsResponse>('/api/v1/catalog/products', { params });
  return normalizeCatalogProducts(res.data);
}

export async function getProductRecommendations(productId: string): Promise<CatalogProductsResponse> {
  const res = await api.get<CatalogProductsResponse>(
    `/api/v1/catalog/products/${productId}/recommendations`,
  );
  return normalizeCatalogProducts(res.data);
}

export async function getNewArrivalProducts(limit = 8): Promise<CatalogProductsResponse> {
  const res = await api.get<CatalogProductsResponse>('/api/v1/catalog/products/new-arrivals', {
    params: { limit },
  });
  return normalizeCatalogProducts(res.data);
}

export async function getTopSellerProducts(limit = 8): Promise<CatalogProductsResponse> {
  const res = await api.get<CatalogProductsResponse>('/api/v1/catalog/products/top-sellers', {
    params: { limit },
  });
  return normalizeCatalogProducts(res.data);
}

export async function getCatalogProductReviews(productId: string): Promise<PublicReviewsResponse> {
  const res = await api.get<PublicReviewsResponse>(
    `/api/v1/catalog/products/${productId}/reviews`,
  );
  return res.data;
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct> {
  const res = await api.get<CatalogProduct>(`/api/v1/catalog/products/${id}`);
  return normalizeCatalogProduct(res.data);
}

export async function verifyHuid(productId: string, qrPayload: string): Promise<HuidVerifyResult> {
  const res = await api.get<HuidVerifyResult>(
    `/api/v1/catalog/products/${productId}/verify-huid`,
    { params: { payload: qrPayload } },
  );
  return res.data;
}

// ── Customer-specific authenticated endpoints ──────────────────────────────────

export interface LoyaltyState {
  pointsBalance:  number;
  lifetimePoints: number;
  currentTier:    string | null;
  tierSince:      string | null;
}

export interface LoyaltyTransaction {
  id:          string;
  pointsDelta: number;
  reason:      string;
  createdAt:   string;
}

export interface LoyaltyResponse {
  state:        LoyaltyState;
  transactions: LoyaltyTransaction[];
}

export interface RateLockBookingResult {
  bookingId:                 string;
  razorpayOrderId:           string;
  razorpayKeyId:             string;
  expiresAt:                 string;
  lockedRate24kPaisePerGram: string;
}

export interface TryAtHomeBookingResponse {
  id:          string;
  shopId:      string;
  customerId:  string;
  productIds:  string[];
  status:      string;
  requestedAt: string;
  dispatchAt:  string | null;
  returnDueAt: string | null;
  notes:       string | null;
}

export async function getCustomerLoyalty(): Promise<LoyaltyResponse> {
  const res = await api.get<LoyaltyResponse>('/api/v1/customer/loyalty');
  return res.data;
}

export async function createCustomerRateLockBooking(
  depositAmountPaise: string,
): Promise<RateLockBookingResult> {
  const res = await api.post<RateLockBookingResult>(
    '/api/v1/customer/rate-lock/bookings',
    { depositAmountPaise },
  );
  return res.data;
}

export async function createCustomerTryAtHomeBooking(
  productIds: string[],
  notes?: string,
): Promise<TryAtHomeBookingResponse> {
  const res = await api.post<TryAtHomeBookingResponse>(
    '/api/v1/customer/try-at-home/bookings',
    { productIds, notes },
  );
  return res.data;
}

export interface CustomerSelfDeleteOptions {
  reason?:     'no-need' | 'privacy' | 'other-jeweller' | 'other';
  reasonText?: string;
}

export async function customerSelfDelete(options?: CustomerSelfDeleteOptions): Promise<void> {
  try {
    const body = options && (options.reason || options.reasonText) ? options : undefined;
    await api.delete('/api/v1/crm/customer/me', body ? { data: body } : undefined);
  } catch (e) {
    const axiosErr = axios.isAxiosError<{ code?: string }>(e) ? e : null;
    if (axiosErr) {
      const err: TypedApiError = Object.assign(new Error(axiosErr.message), {
        code:   axiosErr.response?.data?.code ?? 'unknown',
        status: axiosErr.response?.status,
      });
      throw err;
    }
    throw e;
  }
}

export interface WishlistItem {
  productId:    string;
  sku:          string;
  purity:       string;
  metal:        string;
  grossWeightG: string;
  netWeightG:   string;
  huid:         string | null;
  addedAt:      string;
}

export async function getProductReviews(productId: string): Promise<ReviewsResponse> {
  const res = await api.get<ReviewsResponse>(`/api/v1/reviews/products/${productId}`);
  return res.data;
}

export async function getWishlist(): Promise<WishlistItem[]> {
  const res = await api.get<WishlistItem[]>('/api/v1/wishlist');
  return res.data;
}

export async function addToWishlist(productId: string): Promise<void> {
  await api.post('/api/v1/wishlist', { productId });
}

export async function removeFromWishlist(productId: string): Promise<void> {
  await api.delete(`/api/v1/wishlist/${productId}`);
}

export async function getRateLockPaymentToken(bookingId: string): Promise<{ paymentUrl: string }> {
  const res = await api.get<{ paymentUrl: string }>(
    `/api/v1/customer/rate-lock/bookings/${bookingId}/payment-token`,
  );
  return res.data;
}

export async function getReturnPolicy(): Promise<string | null> {
  const res = await api.get<{ returnPolicyText: string | null }>('/api/v1/catalog/return-policy');
  return res.data.returnPolicyText;
}

// ── Product images (public catalog) ───────────────────────────────────────────

export interface ProductImageRow {
  id:              string;
  alt_text:        string | null;
  width:           number;
  height:          number;
  srcset:          string;
  default_url:     string;
  placeholder_url: string;
}

function normalizeProductImages(images: ProductImageRow[]): ProductImageRow[] {
  return images.map((image) => ({
    ...image,
    default_url: resolveApiAssetUrl(image.default_url),
    placeholder_url: resolveApiAssetUrl(image.placeholder_url),
    srcset: resolveApiSrcset(image.srcset),
  }));
}

export async function getProductImages(productId: string): Promise<ProductImageRow[]> {
  const res = await api.get<{ images: ProductImageRow[] }>(
    `/api/v1/catalog/products/${productId}/images`,
  );
  return normalizeProductImages(res.data.images);
}

// ── Customer timeline ─────────────────────────────────────────────────────────

export interface PurchaseHistorySummary {
  invoiceId:     string;
  invoiceNumber: string;
  issuedAt:      string | null;
  totalPaise:    string;
  status:        string;
}

export interface PurchasesResponse {
  invoices: PurchaseHistorySummary[];
  total:    number;
}

export interface CustomerCustomOrderItem {
  id:                    string;
  status:                string;
  description:           string;
  quotedAmountPaise:     string | null;
  depositAmountPaise:    string;
  estimatedDeliveryDate: string | null;
  createdAt:             string;
}

export interface CustomOrdersResponse {
  orders: CustomerCustomOrderItem[];
  total:  number;
}

export interface CustomerRateLockItem {
  id:                        string;
  status:                    string;
  lockedRate24kPaisePerGram: string;
  depositAmountPaise:        string;
  expiresAt:                 string;
  lockedAt:                  string;
}

export interface RateLockBookingsResponse {
  bookings: CustomerRateLockItem[];
  total:    number;
}

export interface CustomerTryAtHomeItem {
  id:          string;
  shopId:      string;
  customerId:  string;
  productIds:  string[];
  status:      string;
  requestedAt: string;
  dispatchAt:  string | null;
  returnDueAt: string | null;
  notes:       string | null;
}

export interface TryAtHomeBookingsListResponse {
  bookings: CustomerTryAtHomeItem[];
  total:    number;
}

export async function getPurchases(
  params: { limit?: number; offset?: number } = {},
): Promise<PurchasesResponse> {
  const res = await api.get<PurchasesResponse>('/api/v1/customer/purchases', { params });
  return res.data;
}

export async function getCustomOrders(
  params: { limit?: number; offset?: number } = {},
): Promise<CustomOrdersResponse> {
  const res = await api.get<CustomOrdersResponse>('/api/v1/customer/custom-orders', { params });
  return res.data;
}

export async function getRateLockBookings(
  params: { limit?: number; offset?: number } = {},
): Promise<RateLockBookingsResponse> {
  const res = await api.get<RateLockBookingsResponse>('/api/v1/customer/rate-lock/bookings', { params });
  return res.data;
}

export async function getTryAtHomeBookings(
  params: { limit?: number; offset?: number } = {},
): Promise<TryAtHomeBookingsListResponse> {
  const res = await api.get<TryAtHomeBookingsListResponse>('/api/v1/customer/try-at-home/bookings', { params });
  return res.data;
}
