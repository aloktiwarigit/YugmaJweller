// Typed fetch helpers for public catalog API.
// Type definitions live in @goldsmith/customer-shared.

export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  PublicReviewsResponse,
  PublicReviewItem,
  PublicImageItem,
  StorefrontConfig,
  Collection,
} from '@goldsmith/customer-shared';

import type {
  TenantConfigResponse,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRatesResponse,
  PublicReviewsResponse,
  PublicImageItem,
  StorefrontConfig,
  Collection,
} from '@goldsmith/customer-shared';

// Isomorphic base URL:
//   Server (SSG build): API_URL is an internal/private URL (server-to-server).
//   Browser (client component): API_URL is undefined (Next.js strips non-public vars
//   from client bundles), so we fall through to NEXT_PUBLIC_API_BASE which is inlined
//   at build time and safe to expose to the browser.
function resolveApiUrl(): string {
  const value = process.env['API_URL'] ?? process.env.NEXT_PUBLIC_API_BASE;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[env] API_URL or NEXT_PUBLIC_API_BASE is required in production');
    }
    return 'http://localhost:3001';
  }

  const normalized = value.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    if (normalized.includes('localhost')) {
      throw new Error('[env] API_URL must not point to localhost in production');
    }
    if (!normalized.startsWith('https://')) {
      throw new Error('[env] API_URL must use https in production');
    }
  }

  return normalized;
}

const API_URL = resolveApiUrl();

// Per-request timeout protects TTFB budget (<500ms) — slow API calls fall back
// to graceful empty/unavailable states instead of blocking the page render.
// Tuned to 1500ms: API p95 should be <300ms in prod; this leaves headroom
// for cold starts without exceeding the LCP budget (<2500ms).
// 5s, not 1.5s. Cloud Run cold starts (min-instances=0 environments) can take
// 3-5s; a 1.5s SSR timeout caused intermittent "दुकान उपलब्ध नहीं है" failures
// when the API container had idled out. min-instances=1 on goldsmith-api now
// prevents most cold starts, but this is the second layer of defense.
const FETCH_TIMEOUT_MS = 5000;

function withTimeout(): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };
}

export async function fetchTenantConfig(slug: string): Promise<TenantConfigResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/tenant-config`, {
      headers: { 'X-Shop-Slug': slug },
      next: { revalidate: 3600 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<TenantConfigResponse>;
  } catch {
    return null;
  }
}

export async function fetchStorefrontConfig(shopId: string): Promise<StorefrontConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/storefront-config`, {
      headers: { 'X-Tenant-Id': shopId },
      cache: 'no-store',
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<StorefrontConfig>;
  } catch {
    return null;
  }
}

export async function fetchCollections(shopId: string): Promise<Collection[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/collections`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 300 },
      ...withTimeout(),
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: Collection[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchPublicRates(): Promise<PublicRatesResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/rates`, {
      next: { revalidate: 60 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<PublicRatesResponse>;
  } catch {
    return null;
  }
}

export interface FetchProductsParams {
  categoryId?:  string;
  search?:      string;
  metal?:       string;
  purity?:      string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  style?:       string;
  occasion?:    string;
  giftPersona?: string;
  collection?:  string;
  sort?:        string;
  page?:        number;
  limit?:       number;
}

export async function fetchProducts(
  shopId: string,
  params: FetchProductsParams = {},
): Promise<CatalogProductsResponse | null> {
  const qs = new URLSearchParams();
  if (params.categoryId)             qs.set('categoryId',  params.categoryId);
  if (params.search)                 qs.set('search',      params.search);
  if (params.metal)                  qs.set('metal',       params.metal);
  if (params.purity)                 qs.set('purity',      params.purity);
  if (params.priceMin !== undefined) qs.set('priceMin',    String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax',    String(params.priceMax));
  if (params.inStockOnly)            qs.set('inStockOnly', 'true');
  if (params.style)                  qs.set('style',       params.style);
  if (params.occasion)               qs.set('occasion',    params.occasion);
  if (params.giftPersona)            qs.set('giftPersona', params.giftPersona);
  if (params.collection)             qs.set('collection',  params.collection);
  if (params.sort)                   qs.set('sort',        params.sort);
  if (params.page)                   qs.set('page',        String(params.page));
  if (params.limit)                  qs.set('limit',       String(params.limit));

  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products?${qs.toString()}`, {
      headers: { 'X-Tenant-Id': shopId },
      cache: 'no-store',
      ...withTimeout(),
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
      ...withTimeout(),
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
): Promise<PublicReviewsResponse> {
  const empty: PublicReviewsResponse = { items: [], total: 0, page: 1, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${productId}/reviews`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 60 },
      ...withTimeout(),
    });
    if (!res.ok) return empty;
    return res.json() as Promise<PublicReviewsResponse>;
  } catch {
    return empty;
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
      ...withTimeout(),
    });
    if (!res.ok) return [];
    const data = await res.json() as { images: PublicImageItem[] };
    return data.images ?? [];
  } catch {
    return [];
  }
}

export async function fetchRecommendations(
  productId: string,
  shopId: string,
): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/catalog/products/${productId}/recommendations`,
      { headers: { 'X-Tenant-Id': shopId }, next: { revalidate: 300 }, ...withTimeout() },
    );
    if (!res.ok) return [];
    const data = await res.json() as { items?: CatalogProduct[] } | CatalogProduct[];
    return Array.isArray(data) ? data : (data.items ?? []);
  } catch {
    return [];
  }
}

export async function fetchNewArrivals(shopId: string): Promise<CatalogProductsResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/new-arrivals`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 300 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProductsResponse>;
  } catch {
    return null;
  }
}

export async function fetchTopSellers(shopId: string): Promise<CatalogProductsResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/top-sellers`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 600 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProductsResponse>;
  } catch {
    return null;
  }
}

export async function fetchFeaturedProducts(shopId: string): Promise<CatalogProductsResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/featured`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 300 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProductsResponse>;
  } catch {
    return null;
  }
}

export async function fetchReturnPolicy(shopId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/return-policy`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 300 },
      ...withTimeout(),
    });
    if (!res.ok) return null;
    const data = await res.json() as { returnPolicyText: string | null };
    return data.returnPolicyText;
  } catch {
    return null;
  }
}

// ── Wishlist API — client-side only (requires Firebase ID token) ──────────────

export interface WishlistItemResponse {
  productId:    string;
  sku:          string;
  purity:       string;
  metal:        string;
  grossWeightG: string;
  netWeightG:   string;
  huid:         string | null;
  addedAt:      string;
}

function authHeaders(idToken: string, shopId: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${idToken}`,
    'X-Tenant-Id':   shopId,
  };
}

export async function getWishlist(idToken: string, shopId: string): Promise<WishlistItemResponse[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/wishlist`, {
      headers: authHeaders(idToken, shopId),
      cache: 'no-store',
      ...withTimeout(),
    });
    if (!res.ok) return [];
    return res.json() as Promise<WishlistItemResponse[]>;
  } catch {
    return [];
  }
}

export async function addToWishlist(
  productId: string,
  idToken: string,
  shopId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/wishlist`, {
      method:  'POST',
      headers: { ...authHeaders(idToken, shopId), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ productId }),
      ...withTimeout(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeFromWishlist(
  productId: string,
  idToken: string,
  shopId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/wishlist/${productId}`, {
      method:  'DELETE',
      headers: authHeaders(idToken, shopId),
      ...withTimeout(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
