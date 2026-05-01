import axios from 'axios';
import { api } from './client';
import type { Tenant, TenantBranding } from '../stores/tenantStore';

interface TenantBootApiResponse {
  id: string;
  display_name: string;
  config: Record<string, unknown> | null;
}

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}
export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

export interface PublicProduct {
  id: string;
  name: string;
}

export interface CatalogEstimatedPrice {
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
  estimatedPrice?:       CatalogEstimatedPrice;
  publishedAt:           string;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
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
): Promise<{ tenant: Tenant; etag: string | null; notModified: boolean }> {
  const res = await api.get<TenantBootApiResponse>(`/api/v1/tenant/boot`, {
    params: { slug },
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (s: number) => s === 200 || s === 304,
  });
  if (res.status === 304) {
    return { tenant: null as unknown as Tenant, etag: etag ?? null, notModified: true };
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
  return {
    primaryColor: typeof config['primary_color'] === 'string' ? (config['primary_color'] as string) : undefined,
    secondaryColor: typeof config['secondary_color'] === 'string' ? (config['secondary_color'] as string) : undefined,
    logoUrl: typeof config['logo_url'] === 'string' ? (config['logo_url'] as string) : undefined,
    appName: typeof config['app_name'] === 'string' ? (config['app_name'] as string) : undefined,
    defaultLanguage: lang === 'hi-IN' || lang === 'en-IN' ? lang : undefined,
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
  metal?:      string;
  search?:     string;
  categoryId?: string;
  page?:       number;
  limit?:      number;
} = {}): Promise<CatalogProductsResponse> {
  const params: Record<string, string | number> = {};
  if (opts.metal)      params['metal']      = opts.metal;
  if (opts.search)     params['search']     = opts.search;
  if (opts.categoryId) params['categoryId'] = opts.categoryId;
  if (opts.page)       params['page']       = opts.page;
  if (opts.limit)      params['limit']      = opts.limit;
  const res = await api.get<CatalogProductsResponse>('/api/v1/catalog/products', { params });
  return res.data;
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct> {
  const res = await api.get<CatalogProduct>(`/api/v1/catalog/products/${id}`);
  return res.data;
}

export async function verifyHuid(productId: string, qrPayload: string): Promise<HuidVerifyResult> {
  const res = await api.get<HuidVerifyResult>(
    `/api/v1/catalog/products/${productId}/verify-huid`,
    { params: { payload: qrPayload } },
  );
  return res.data;
}

export async function customerSelfDelete(): Promise<void> {
  try {
    await api.delete('/api/v1/crm/customer/me');
  } catch (e) {
    const axiosErr = axios.isAxiosError<{ code?: string }>(e) ? e : null;
    const code = axiosErr?.response?.data?.code ?? 'unknown';
    const status = axiosErr?.response?.status;
    const err: TypedApiError = Object.assign(new Error(code), { code, status });
    throw err;
  }
}
