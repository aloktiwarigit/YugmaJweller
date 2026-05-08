import type { Collection, CatalogProductCard } from '@goldsmith/customer-shared';
import { SectionHeading } from './SectionHeading';

interface SpotlightSectionProps {
  featuredCollection?: Collection;
  spotlightProducts?: CatalogProductCard[];
}

export function SpotlightSection({ featuredCollection, spotlightProducts }: SpotlightSectionProps) {
  if (!featuredCollection && (!spotlightProducts || spotlightProducts.length === 0)) {
    return null;
  }

  const collectionTitle = featuredCollection?.titleHi ?? 'वेडिंग एडिट';
  const collectionHref  = featuredCollection ? `/collections/${featuredCollection.slug}` : '/products?occasion=WEDDING';
  const tiles           = spotlightProducts?.slice(0, 4) ?? [];

  return (
    <section aria-labelledby="spotlight-heading" className="py-10 bg-surfaceElevated border-y border-borderSubtle">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading
          id="spotlight-heading"
          titleHi="स्पॉटलाइट में"
          eyebrowHi="इस सीज़न की पसंद"
        />

        {/* Desktop: asymmetric 1.12fr / 0.88fr */}
        <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: '1.12fr 0.88fr' }}>
          {/* Large editorial tile */}
          <a
            href={collectionHref}
            className="group relative flex flex-col justify-end rounded-lg bg-surface border border-borderSubtle overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-primary"
            style={{ minHeight: 340 }}
          >
            <div className="absolute inset-0 bg-primaryWash flex items-center justify-center" aria-hidden="true">
              <span className="font-heading text-6xl text-primary/20">✦</span>
            </div>
            <div className="relative p-6 bg-gradient-to-t from-surfaceElevated/90 to-transparent">
              <p className="font-prose italic text-xs text-inkSoft mb-1">संग्रह / Collection</p>
              <p className="font-heading text-2xl text-ink">{collectionTitle}</p>
              <span className="mt-2 inline-block font-ui text-sm text-primaryDeep underline group-hover:opacity-80">
                देखें →
              </span>
            </div>
          </a>

          {/* 2×2 small tiles */}
          {tiles.length > 0 ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {tiles.map((p) => (
                <a
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group flex flex-col rounded-md bg-surface border border-borderSubtle overflow-hidden hover:shadow-sm hover:border-borderStrong transition-all focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="flex-1 bg-bg flex items-center justify-center p-4" aria-hidden="true">
                    <span className="font-heading text-3xl text-primary/20">✦</span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="font-ui text-xs font-semibold text-ink line-clamp-1">
                      {p.categoryName ?? p.metal}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {[
                { titleHi: 'ब्राइडल', href: '/products?style=BRIDAL' },
                { titleHi: 'मंदिर', href: '/products?style=TEMPLE' },
                { titleHi: 'स्टेटमेंट', href: '/products?style=STATEMENT' },
                { titleHi: 'ऑफिस', href: '/products?style=OFFICE' },
              ].map((t) => (
                <a
                  key={t.titleHi}
                  href={t.href}
                  className="flex items-center justify-center rounded-md bg-surface border border-borderSubtle p-4 hover:border-borderStrong transition-colors font-ui text-sm text-ink"
                >
                  {t.titleHi}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Mobile: 1 hero editorial + 2×2 small tiles */}
        <div className="md:hidden flex flex-col gap-3">
          <a
            href={collectionHref}
            className="group relative flex flex-col justify-end rounded-lg bg-surface border border-borderSubtle overflow-hidden focus-visible:outline-2 focus-visible:outline-primary"
            style={{ aspectRatio: '16/10' }}
          >
            <div className="absolute inset-0 bg-primaryWash flex items-center justify-center" aria-hidden="true">
              <span className="font-heading text-5xl text-primary/20">✦</span>
            </div>
            <div className="relative p-4 bg-gradient-to-t from-surfaceElevated/90 to-transparent">
              <p className="font-heading text-xl text-ink">{collectionTitle}</p>
            </div>
          </a>
          <div className="grid grid-cols-2 gap-3">
            {(tiles.length > 0 ? tiles.slice(0, 4) : [
              { id: '1', href: '/products?style=BRIDAL', labelHi: 'ब्राइडल' },
              { id: '2', href: '/products?style=TEMPLE', labelHi: 'मंदिर' },
              { id: '3', href: '/products?style=STATEMENT', labelHi: 'स्टेटमेंट' },
              { id: '4', href: '/products?style=OFFICE', labelHi: 'ऑफिस' },
            ] as Array<{ id: string; href?: string; labelHi?: string } & Partial<CatalogProductCard>>).map((item, i) => {
              const href = 'href' in item && item.href ? item.href : `/products/${item.id}`;
              const label = 'labelHi' in item && item.labelHi ? item.labelHi : ((item as CatalogProductCard).categoryName ?? (item as CatalogProductCard).metal ?? '');
              return (
                <a
                  key={item.id ?? i}
                  href={href}
                  className="flex items-center justify-center p-4 rounded-md bg-surface border border-borderSubtle font-ui text-sm text-ink hover:border-borderStrong"
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
