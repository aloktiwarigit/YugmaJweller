import { headers } from 'next/headers';
import {
  fetchTenantConfig,
  fetchPublicRates,
  fetchNewArrivals,
  fetchTopSellers,
  fetchFeaturedProducts,
} from '@/lib/api';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import { HeroSection }               from '@/components/sections/HeroSection';
import { RetailRateStrip }           from '@/components/sections/RetailRateStrip';
import { CategoryTileGrid }          from '@/components/sections/CategoryTileGrid';
import { NewArrivalsSection }        from '@/components/sections/NewArrivalsSection';
import { SpotlightSection }          from '@/components/sections/SpotlightSection';
import { GiftPersonasSection }       from '@/components/sections/GiftPersonasSection';
import { TopSellersSection }         from '@/components/sections/TopSellersSection';
import { EverydayCollectionSection } from '@/components/sections/EverydayCollectionSection';
import { PremiumCollectionSection }  from '@/components/sections/PremiumCollectionSection';
import { RecommendedSection }        from '@/components/sections/RecommendedSection';
import { PromiseSection }            from '@/components/sections/PromiseSection';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function HomePage() {
  const slug = resolveSlug();

  if (!slug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="font-ui text-inkMute">दुकान नहीं मिली।</p>
      </div>
    );
  }

  const config = await fetchTenantConfig(slug);

  if (!config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="font-ui text-inkMute">दुकान उपलब्ध नहीं है।</p>
      </div>
    );
  }

  const [rates, newArrivalsData, topSellersData, featuredData] = await Promise.all([
    fetchPublicRates(),
    fetchNewArrivals(config.shopId).catch(() => null),
    fetchTopSellers(config.shopId).catch(() => null),
    fetchFeaturedProducts(config.shopId).catch(() => null),
  ]);

  const newArrivals  = newArrivalsData?.items  ?? [];
  const topSellers   = topSellersData?.items   ?? [];
  const recommended  = featuredData?.items     ?? [];

  return (
    <>
      {/* 1. Hero */}
      <HeroSection shopName={config.appName} heroBanners={[]} />

      {/* 2. Live rate strip */}
      <RetailRateStrip rates={rates} />

      {/* 3. Shop by category */}
      <section aria-labelledby="category-heading" className="py-10 bg-bg">
        <div className="max-w-6xl mx-auto px-4">
          <h2 id="category-heading" className="font-heading text-2xl text-ink mb-6">
            श्रेणी से खोजें
          </h2>
          <CategoryTileGrid tiles={STOREFRONT_CATEGORY_TILES} headingId="category-heading" />
        </div>
      </section>

      {/* 4. New arrivals */}
      <NewArrivalsSection products={newArrivals} />

      {/* 5. Spotlight — hidden when empty */}
      <SpotlightSection />

      {/* 6. Gift personas */}
      <GiftPersonasSection />

      {/* 7. Top sellers */}
      <TopSellersSection products={topSellers} />

      {/* 8. Everyday collection */}
      <EverydayCollectionSection />

      {/* 9. Premium collection — dark surface */}
      <PremiumCollectionSection enabled />

      {/* 10. Recommended — hidden when empty */}
      <RecommendedSection products={recommended} />

      {/* 11. Promise pillars */}
      <PromiseSection />
    </>
  );
}
