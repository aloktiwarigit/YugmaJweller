import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import {
  fetchTenantConfig,
  fetchPublicRates,
  fetchNewArrivals,
  fetchTopSellers,
  fetchFeaturedProducts,
  fetchStorefrontConfig,
  fetchCollections,
} from '@/lib/api';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import type { Collection, StorefrontConfig } from '@/lib/api';
import { HeroSection }               from '@/components/sections/HeroSection';
import { RetailRateStrip }           from '@/components/sections/RetailRateStrip';
import { CampaignStorySection }      from '@/components/sections/CampaignStorySection';
import { CategoryTileGrid }          from '@/components/sections/CategoryTileGrid';
import { NewArrivalsSection }        from '@/components/sections/NewArrivalsSection';
import { SpotlightSection }          from '@/components/sections/SpotlightSection';
import { GiftPersonasSection }       from '@/components/sections/GiftPersonasSection';
import { TopSellersSection }         from '@/components/sections/TopSellersSection';
import { EverydayCollectionSection } from '@/components/sections/EverydayCollectionSection';
import { PremiumCollectionSection }  from '@/components/sections/PremiumCollectionSection';
import { RecommendedSection }        from '@/components/sections/RecommendedSection';
import { PromiseSection }            from '@/components/sections/PromiseSection';

export default async function HomePage() {
  const slug = resolveShopSlug(headers());

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

  const [rates, storefrontConfig, newArrivalsData, topSellersData, featuredData, collections] = await Promise.all([
    fetchPublicRates(),
    fetchStorefrontConfig(config.shopId).catch(() => null),
    fetchNewArrivals(config.shopId).catch(() => null),
    fetchTopSellers(config.shopId).catch(() => null),
    fetchFeaturedProducts(config.shopId).catch(() => null),
    fetchCollections(config.shopId).catch(() => []),
  ]);

  const newArrivals  = newArrivalsData?.items  ?? [];
  const topSellers   = topSellersData?.items   ?? [];
  const recommended  = featuredData?.items     ?? [];
  const spotlightCollection = (collections as Collection[]).find((collection) => collection.isPremium) ?? collections[0];
  const heroBanners   = ((storefrontConfig as StorefrontConfig | null)?.heroBanners ?? []).flatMap((banner) =>
    banner.imageUrl && banner.headlineHi && banner.ctaUrl
      ? [{
          imageUrl:   banner.imageUrl,
          headlineHi: banner.headlineHi,
          ctaUrl:     banner.ctaUrl,
        }]
      : [],
  );

  return (
    <>
      {/* 1. Hero */}
      <HeroSection
        shopName={config.appName}
        heroBanners={heroBanners}
      />

      {/* 2. Live rate strip */}
      <RetailRateStrip rates={rates} />

      {/* 3. Editorial campaign band */}
      <CampaignStorySection />

      {/* 4. Shop by category */}
      <section aria-labelledby="category-heading" className="py-10 bg-bg">
        <div className="max-w-6xl mx-auto px-4">
          <h2 id="category-heading" className="font-heading text-2xl text-ink mb-6">
            श्रेणी से खोजें
          </h2>
          <CategoryTileGrid tiles={STOREFRONT_CATEGORY_TILES} headingId="category-heading" />
        </div>
      </section>

      {/* 5. New arrivals */}
      <NewArrivalsSection products={newArrivals} />

      {/* 5. Spotlight — hidden when empty */}
      <SpotlightSection
        featuredCollection={spotlightCollection}
        spotlightProducts={recommended.slice(0, 4)}
      />

      {/* 7. Gift personas */}
      <GiftPersonasSection collections={collections} />

      {/* 8. Top sellers */}
      <TopSellersSection products={topSellers} />

      {/* 9. Everyday collection */}
      <EverydayCollectionSection collections={collections} />

      {/* 9. Premium collection — dark surface */}
      <PremiumCollectionSection enabled collections={collections} />

      {/* 10. Recommended — hidden when empty */}
      <RecommendedSection products={recommended} />

      {/* 12. Promise pillars */}
      <PromiseSection />
    </>
  );
}
