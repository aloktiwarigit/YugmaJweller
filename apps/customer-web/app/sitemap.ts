import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { fetchProducts, fetchTenantConfig } from '@/lib/api';
import { STATIC_STOREFRONT_ROUTES, baseUrlFromHeaders } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = headers();
  const baseUrl = baseUrlFromHeaders(h);
  const slug = h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_STOREFRONT_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' || route === '/products' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route === '/products' ? 0.9 : 0.6,
  }));

  if (!slug) return staticEntries;

  const config = await fetchTenantConfig(slug);
  if (!config) return staticEntries;

  const products = await fetchProducts(config.shopId, { limit: 200 });
  const productEntries: MetadataRoute.Sitemap =
    products?.items.map((product) => ({
      url: `${baseUrl}/products/${product.id}`,
      lastModified: product.publishedAt ? new Date(product.publishedAt) : now,
      changeFrequency: 'daily',
      priority: 0.8,
    })) ?? [];

  return [...staticEntries, ...productEntries];
}
