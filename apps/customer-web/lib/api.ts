// Typed fetch helpers for public catalog API.
// Type definitions live in @goldsmith/customer-shared.

export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  ReviewItem,
  ReviewsResponse,
  PublicImageItem,
} from '@goldsmith/customer-shared';

import type {
  TenantConfigResponse,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRatesResponse,
  ReviewsResponse,
  PublicImageItem,
} from '@goldsmith/customer-shared';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

export async function fetchTenantConfig(slug: string): Promise<TenantConfigResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/tenant-config`, {
      headers: { 'X-Shop-Slug': slug },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<TenantConfigResponse>;
  } catch {
    return null;
  }
}

export async function fetchPublicRates(): Promise<PublicRatesResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/rates`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<PublicRatesResponse>;
  } catch {
    return null;
  }
}

export async function fetchProducts(
  shopId: string,
  params: { categoryId?: string; search?: string; page?: number; limit?: number } = {},
): Promise<CatalogProductsResponse | null> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.search)     qs.set('search', params.search);
  if (params.page)       qs.set('page', String(params.page));
  if (params.limit)      qs.set('limit', String(params.limit));

  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products?${qs.toString()}`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProductsResponse>;
  } catch {
    return null;
  }
}

export async function fetchProduct(
  productId: string,
  shopId: string,
): Promise<CatalogProduct | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${productId}`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProduct>;
  } catch {
    return null;
  }
}

export async function fetchProductReviews(
  productId: string,
  shopId: string,
): Promise<ReviewsResponse> {
  try {
    const res = await fetch(`${API_URL}/api/v1/reviews/products/${productId}`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { reviews: [], averageRating: null, total: 0 };
    return res.json() as Promise<ReviewsResponse>;
  } catch {
    return { reviews: [], averageRating: null, total: 0 };
  }
}

export async function fetchProductImages(
  productId: string,
  shopId: string,
): Promise<PublicImageItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${productId}/images`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { images: PublicImageItem[] };
    return data.images ?? [];
  } catch {
    return [];
  }
}

export async function fetchReturnPolicy(shopId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/return-policy`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { returnPolicyText: string | null };
    return data.returnPolicyText;
  } catch {
    return null;
  }
}
