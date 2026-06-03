import Image from 'next/image';
import type { Collection, CatalogProductCard } from '@goldsmith/customer-shared';
import { storefrontBlurDataUrl, storefrontImageUrl } from '@/lib/image-url';
import { SectionHeading } from './SectionHeading';

interface SpotlightSectionProps {
  featuredCollection?: Collection;
  spotlightProducts?: CatalogProductCard[];
}

const FALLBACK_TILES = [
  { titleHi: 'ब्राइडल', href: '/products?style=BRIDAL' },
  { titleHi: 'मंदिर', href: '/products?style=TEMPLE' },
  { titleHi: 'स्टेटमेंट', href: '/products?style=STATEMENT' },
  { titleHi: 'ऑफिस', href: '/products?style=OFFICE' },
];

function ProductSpotlightTile({ product }: { product: CatalogProductCard }) {
  const label = product.categoryName ?? product.metal;

  return (
    <a
      href={`/products/${product.id}`}
      className="group flex min-h-[170px] flex-col overflow-hidden rounded-md border border-borderSubtle bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="relative flex-1 bg-bg">
        {product.primaryImage ? (
          <Image
            src={storefrontImageUrl(product.primaryImage.url)}
            alt={product.primaryImage.alt ?? label}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            placeholder={storefrontBlurDataUrl(product.primaryImage.placeholderUrl) ? 'blur' : 'empty'}
            blurDataURL={storefrontBlurDataUrl(product.primaryImage.placeholderUrl)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4" aria-hidden="true">
            <span className="font-heading text-3xl text-primary/20">✦</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="line-clamp-1 font-ui text-xs font-semibold text-ink">{label}</p>
      </div>
    </a>
  );
}

export function SpotlightSection({ featuredCollection, spotlightProducts }: SpotlightSectionProps) {
  if (!featuredCollection && (!spotlightProducts || spotlightProducts.length === 0)) {
    return null;
  }

  const collectionTitle = featuredCollection?.titleHi ?? 'वेडिंग एडिट';
  const collectionHref = featuredCollection
    ? `/products?collection=${encodeURIComponent(featuredCollection.slug)}`
    : '/products?occasion=WEDDING';
  const tiles = spotlightProducts?.slice(0, 4) ?? [];

  return (
    <section aria-labelledby="spotlight-heading" className="border-y border-borderSubtle bg-surfaceElevated py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          id="spotlight-heading"
          titleHi="स्पॉटलाइट में"
          eyebrowHi="इस सीजन की पसंद"
        />

        <div className="hidden gap-4 md:grid" style={{ gridTemplateColumns: '1.12fr 0.88fr' }}>
          <a
            href={collectionHref}
            className="group overflow-hidden rounded-md border border-borderSubtle bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="relative min-h-[270px] bg-bg">
              {featuredCollection?.heroImage ? (
                <Image
                  src={storefrontImageUrl(featuredCollection.heroImage.url)}
                  alt={featuredCollection.heroImage.alt ?? collectionTitle}
                  fill
                  sizes="(max-width: 768px) 100vw, 620px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  placeholder={storefrontBlurDataUrl(featuredCollection.heroImage.placeholderUrl) ? 'blur' : 'empty'}
                  blurDataURL={storefrontBlurDataUrl(featuredCollection.heroImage.placeholderUrl)}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-primaryWash" aria-hidden="true">
                  <span className="font-heading text-6xl text-primary/20">✦</span>
                </div>
              )}
            </div>
            <div className="p-6">
              <p className="mb-1 font-prose text-xs italic text-inkSoft">संग्रह / Collection</p>
              <p className="font-heading text-2xl text-ink">{collectionTitle}</p>
              <span className="mt-2 inline-block font-ui text-sm text-primaryDeep underline group-hover:opacity-80">
                देखें →
              </span>
            </div>
          </a>

          {tiles.length > 0 ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {tiles.map((product) => (
                <ProductSpotlightTile key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {FALLBACK_TILES.map((tile) => (
                <a
                  key={tile.titleHi}
                  href={tile.href}
                  className="flex items-center justify-center rounded-md border border-borderSubtle bg-surface p-4 font-ui text-sm text-ink transition-colors hover:border-borderStrong"
                >
                  {tile.titleHi}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          <a
            href={collectionHref}
            className="group overflow-hidden rounded-md border border-borderSubtle bg-surface focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="relative bg-bg" style={{ aspectRatio: '16/10' }}>
              {featuredCollection?.heroImage ? (
                <Image
                  src={storefrontImageUrl(featuredCollection.heroImage.url)}
                  alt={featuredCollection.heroImage.alt ?? collectionTitle}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  placeholder={storefrontBlurDataUrl(featuredCollection.heroImage.placeholderUrl) ? 'blur' : 'empty'}
                  blurDataURL={storefrontBlurDataUrl(featuredCollection.heroImage.placeholderUrl)}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-primaryWash" aria-hidden="true">
                  <span className="font-heading text-5xl text-primary/20">✦</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="font-heading text-xl text-ink">{collectionTitle}</p>
            </div>
          </a>

          <div className="grid grid-cols-2 gap-3">
            {tiles.length > 0
              ? tiles.map((product) => <ProductSpotlightTile key={product.id} product={product} />)
              : FALLBACK_TILES.map((tile) => (
                  <a
                    key={tile.titleHi}
                    href={tile.href}
                    className="flex items-center justify-center rounded-md border border-borderSubtle bg-surface p-4 font-ui text-sm text-ink hover:border-borderStrong"
                  >
                    {tile.titleHi}
                  </a>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
