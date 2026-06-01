import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig } from '@/lib/api';
import { TryOnWvClient } from './TryOnWvClient';

interface PageProps {
  params: { id: string };
  searchParams: { shop?: string };
}

/**
 * Fullscreen, chrome-less try-on route for embedding in the customer-mobile
 * WebView. The root layout's StorefrontWrapper chrome renders behind the
 * opaque fullscreen TryOnModal and is never visible. `?shop=<slug>` lets the
 * mobile host pin its tenant; otherwise we fall back to the normal resolver.
 */
export default async function TryOnWvPage({ params, searchParams }: PageProps) {
  const slug = searchParams.shop?.trim().toLowerCase() || resolveShopSlug(headers());
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  return <TryOnWvClient productId={params.id} shopId={config.shopId} />;
}
