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
  // The catalog/products endpoint currently returns an empty array (Epic 7 stub on the API side)
  // — additional fields will land when the catalog story ships.
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
  // The API returns snake_case `{ id, display_name, config }`. The mobile
  // Tenant shape is `{ id, slug, displayName, branding }`. Map here:
  // slug is supplied by the caller (it is the lookup key, not in the response);
  // branding comes from `config.branding` if present, else defaults to {}.
  const config = (res.data.config ?? null) as { branding?: TenantBranding } | null;
  const tenant: Tenant = {
    id: res.data.id,
    slug,
    displayName: res.data.display_name,
    branding: config?.branding ?? {},
  };
  return {
    tenant,
    etag: (res.headers['etag'] as string | undefined) ?? null,
    notModified: false,
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
