import Image from 'next/image';
import type { Collection } from '@goldsmith/customer-shared';

interface PremiumCollectionSectionProps {
  enabled?: boolean;
  collections?: Collection[];
}

const PREMIUM_TILES = [
  { key: 'bridal', labelHi: 'ब्राइडल कलेक्शन', href: '/products?style=BRIDAL' },
  { key: 'diamond', labelHi: 'हीरे की ज्वेलरी', href: '/products?search=diamond' },
  { key: 'statement', labelHi: 'स्टेटमेंट पीस', href: '/products?style=STATEMENT' },
  { key: 'wedding', labelHi: 'वेडिंग एडिट', href: '/products?occasion=WEDDING' },
];

function premiumCollections(collections: Collection[]): Collection[] {
  const withImages = collections.filter((collection) => collection.heroImage);
  const premium = withImages.filter((collection) => collection.isPremium);
  const remaining = withImages.filter((collection) => !collection.isPremium);
  return [...premium, ...remaining].slice(0, 4);
}

export function PremiumCollectionSection({ enabled = true, collections = [] }: PremiumCollectionSectionProps) {
  if (!enabled) return null;

  const collectionTiles = premiumCollections(collections);

  return (
    <section
      aria-labelledby="premium-heading"
      className="py-14"
      style={{ backgroundColor: '#1E2440' }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <p className="mb-1 font-prose text-xs italic tracking-wide" style={{ color: '#B58A3C' }}>
            प्रीमियम संग्रह / Premium Collection
          </p>
          <h2 id="premium-heading" className="font-heading text-3xl" style={{ color: '#F5EDDD' }}>
            विशेष आभूषण
          </h2>
        </div>

        {collectionTiles.length > 0 ? (
          <>
            <div className="hidden grid-cols-4 gap-4 md:grid">
              {collectionTiles.map((collection) => (
                <a
                  key={collection.id}
                  href={`/products?collection=${encodeURIComponent(collection.slug)}`}
                  className="group flex flex-col overflow-hidden rounded-lg border focus-visible:outline-2"
                  style={{ borderColor: '#B58A3C33', aspectRatio: '3/4' }}
                >
                  <div className="relative flex-1 overflow-hidden">
                    <Image
                      src={collection.heroImage!.url}
                      alt={collection.heroImage!.alt ?? collection.titleHi}
                      fill
                      sizes="280px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      placeholder={collection.heroImage!.placeholderUrl ? 'blur' : 'empty'}
                      blurDataURL={collection.heroImage!.placeholderUrl || undefined}
                    />
                  </div>
                  <div className="px-4 py-3" style={{ backgroundColor: '#232847' }}>
                    <p className="font-ui text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: '#F5EDDD' }}>
                      {collection.titleHi}
                    </p>
                    <p className="mt-0.5 font-ui text-xs" style={{ color: '#B58A3C' }}>
                      {collection.productCount} designs
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-0.5 md:hidden">
              <a
                href={`/products?collection=${encodeURIComponent(collectionTiles[0]!.slug)}`}
                className="relative w-full overflow-hidden rounded-t-lg"
                style={{ aspectRatio: '16/9' }}
              >
                <Image
                  src={collectionTiles[0]!.heroImage!.url}
                  alt={collectionTiles[0]!.heroImage!.alt ?? collectionTiles[0]!.titleHi}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  placeholder={collectionTiles[0]!.heroImage!.placeholderUrl ? 'blur' : 'empty'}
                  blurDataURL={collectionTiles[0]!.heroImage!.placeholderUrl || undefined}
                />
              </a>
              {collectionTiles.map((collection) => (
                <a
                  key={collection.id}
                  href={`/products?collection=${encodeURIComponent(collection.slug)}`}
                  className="flex items-center justify-between px-5 py-4 focus-visible:outline-2"
                  style={{ backgroundColor: '#232847', borderTop: '1px solid #B58A3C22' }}
                >
                  <span className="font-ui text-sm font-semibold" style={{ color: '#F5EDDD' }}>
                    {collection.titleHi}
                  </span>
                  <span style={{ color: '#B58A3C' }}>→</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="hidden grid-cols-4 gap-4 md:grid">
              {PREMIUM_TILES.map((tile) => (
                <a
                  key={tile.key}
                  href={tile.href}
                  className="group flex flex-col overflow-hidden rounded-lg border focus-visible:outline-2"
                  style={{ borderColor: '#B58A3C33', aspectRatio: '3/4' }}
                >
                  <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: '#2A3054' }} aria-hidden="true">
                    <span className="font-heading text-5xl" style={{ color: '#B58A3C33' }}>✦</span>
                  </div>
                  <div className="px-4 py-3" style={{ backgroundColor: '#232847' }}>
                    <p className="font-ui text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: '#F5EDDD' }}>
                      {tile.labelHi}
                    </p>
                    <p className="mt-0.5 font-ui text-xs" style={{ color: '#B58A3C' }}>
                      देखें →
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-0.5 md:hidden">
              <div
                className="flex w-full items-center justify-center rounded-t-lg"
                style={{ aspectRatio: '16/9', backgroundColor: '#2A3054' }}
                aria-hidden="true"
              >
                <span className="font-heading text-6xl" style={{ color: '#B58A3C33' }}>✦</span>
              </div>
              {PREMIUM_TILES.map((tile) => (
                <a
                  key={tile.key}
                  href={tile.href}
                  className="flex items-center justify-between px-5 py-4 focus-visible:outline-2"
                  style={{ backgroundColor: '#232847', borderTop: '1px solid #B58A3C22' }}
                >
                  <span className="font-ui text-sm font-semibold" style={{ color: '#F5EDDD' }}>
                    {tile.labelHi}
                  </span>
                  <span style={{ color: '#B58A3C' }}>→</span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
