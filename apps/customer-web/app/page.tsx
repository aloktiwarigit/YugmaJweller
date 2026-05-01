import { headers } from 'next/headers';
import { fetchTenantConfig, fetchPublicRates, fetchProducts } from '@/lib/api';
import { GoldRateCard } from '@/components/GoldRateCard';
import { ProductGrid } from '@/components/ProductGrid';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function HomePage() {
  const slug = resolveSlug();

  if (!slug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="font-body text-inkMute">दुकान नहीं मिली।</p>
      </div>
    );
  }

  const config = await fetchTenantConfig(slug);

  if (!config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="font-body text-inkMute">दुकान उपलब्ध नहीं है।</p>
      </div>
    );
  }

  const [rates, featuredData] = await Promise.all([
    fetchPublicRates(),
    fetchProducts(config.shopId, { limit: 6 }),
  ]);

  const featured = featuredData?.items ?? [];
  const total    = featuredData?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="text-center py-8">
        <h1 id="hero-heading" className="font-heading text-4xl text-ink mb-3">
          {config.appName}
        </h1>
        <p className="font-body text-lg text-inkMute">
          श्रेष्ठ आभूषण, विश्वसनीय सेवा
        </p>
      </section>

      {/* Gold rate card */}
      <section aria-labelledby="rates-heading">
        <h2 id="rates-heading" className="sr-only">आज की दरें</h2>
        <GoldRateCard rates={rates} />
      </section>

      {/* Featured products */}
      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="font-heading text-2xl text-ink mb-4">
          विशेष आभूषण
        </h2>
        <ProductGrid
          products={featured}
          emptyMessage="अभी कोई उत्पाद उपलब्ध नहीं है"
        />
        {total > 6 && (
          <div className="mt-6 text-center">
            <a
              href="/products"
              className="inline-block font-body text-primary underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary"
            >
              सभी उत्पाद देखें →
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
