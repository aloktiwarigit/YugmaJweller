import Image from 'next/image';
import type { Collection } from '@goldsmith/customer-shared';
import { SectionHeading } from './SectionHeading';

interface EverydayCollectionSectionProps {
  collections?: Collection[];
}

const EVERYDAY_TILES = [
  { key: 'daily-rings', labelHi: 'रोज़ाना अंगूठी', href: '/products?style=DAILY_WEAR&search=ring', collectionSlug: 'daily-gold' },
  { key: 'studs', labelHi: 'टॉप्स / स्टड्स', href: '/products?style=STUDS', collectionSlug: 'minimal-edit' },
  { key: 'office', labelHi: 'ऑफिस वेयर', href: '/products?style=OFFICE', collectionSlug: 'minimal-edit' },
  { key: 'chains', labelHi: 'सादी चेन', href: '/products?search=chain', collectionSlug: 'mens-edit' },
  { key: 'silver-anklets', labelHi: 'चाँदी पायल', href: '/products?metal=SILVER&search=anklet', collectionSlug: 'silver-style' },
  { key: 'kids', labelHi: 'बच्चों के लिए', href: '/products?style=KIDS', collectionSlug: 'gift-ready' },
];

function imageForTile(collections: Collection[], slug: string, index: number) {
  const imageCollections = collections.filter((collection) => collection.heroImage);
  return (
    collections.find((collection) => collection.slug === slug && collection.heroImage)?.heroImage ??
    imageCollections[index % Math.max(imageCollections.length, 1)]?.heroImage
  );
}

export function EverydayCollectionSection({ collections = [] }: EverydayCollectionSectionProps) {
  return (
    <section aria-labelledby="everyday-heading" className="bg-bg py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          id="everyday-heading"
          titleHi="रोज़मर्रा की पसंद"
          eyebrowHi="एवरीडे कलेक्शन"
          eyebrowEn="Everyday Collection"
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {EVERYDAY_TILES.map((tile, index) => {
            const image = imageForTile(collections, tile.collectionSlug, index);

            return (
              <a
                key={tile.key}
                href={tile.href}
                className="group overflow-hidden rounded-md border border-borderSubtle bg-surfaceElevated text-center transition-all hover:border-borderStrong hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="relative bg-bg" style={{ aspectRatio: '4/3' }}>
                  {image ? (
                    <Image
                      src={image.url}
                      alt={image.alt ?? tile.labelHi}
                      fill
                      sizes="(max-width: 768px) 50vw, 360px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      placeholder={image.placeholderUrl ? 'blur' : 'empty'}
                      blurDataURL={image.placeholderUrl || undefined}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center" aria-hidden="true">
                      <span className="font-heading text-3xl text-primary/30">✦</span>
                    </div>
                  )}
                </div>
                <div className="flex min-h-14 items-center justify-center px-3 py-3">
                  <span className="font-ui text-sm font-medium text-ink transition-colors group-hover:text-primaryDeep">
                    {tile.labelHi}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
