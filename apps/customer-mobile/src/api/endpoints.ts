import { api } from './client';
import type { Tenant } from '../stores/tenantStore';

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
  const res = await api.get<Tenant>(`/api/v1/tenant/boot`, {
    params: { slug },
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (s: number) => s === 200 || s === 304,
  });
  if (res.status === 304) {
    return { tenant: null as unknown as Tenant, etag: etag ?? null, notModified: true };
  }
  return {
    tenant: res.data,
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
    await api.delete('/api/v1/customer/me');
  } catch (e) {
    const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code ?? 'unknown';
    const status = (e as { response?: { status?: number } }).response?.status;
    const err: TypedApiError = Object.assign(new Error(code), { code, status });
    throw err;
  }
}
