import Image from 'next/image';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import {
  STOREFRONT_CATEGORY_TILES,
  STOREFRONT_GIFT_PERSONAS,
  STOREFRONT_OCCASION_TILES,
} from '@goldsmith/customer-shared';
import type { Collection } from '@goldsmith/customer-shared';
import { fetchCollections, fetchTenantConfig } from '@/lib/api';

const fallbackCollections = [
  { title: 'ब्राइडल कलेक्शन', href: '/products?style=BRIDAL', meta: 'शादी और रस्मों के लिए' },
  { title: 'रोज़मर्रा की पसंद', href: '/products?style=DAILY_WEAR', meta: 'हल्के, नियमित पहनावे के लिए' },
  { title: 'त्यौहार विशेष', href: '/products?occasion=FESTIVAL', meta: 'उत्सव और उपहार के लिए' },
  { title: 'चाँदी संग्रह', href: '/products?metal=SILVER', meta: '925 और 999 चाँदी' },
];

function CollectionCard({ collection }: { collection: Collection }) {
  const href = `/products?collection=${encodeURIComponent(collection.slug)}`;

  return (
    <a
      href={href}
      className="group overflow-hidden rounded-md border border-borderSubtle bg-surface transition-all hover:border-borderStrong hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="relative bg-bg" style={{ aspectRatio: '4/5' }}>
        {collection.heroImage ? (
          <Image
            src={collection.heroImage.url}
            alt={collection.heroImage.alt ?? collection.titleHi}
            fill
            sizes="(max-width: 768px) 50vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            placeholder={collection.heroImage.placeholderUrl ? 'blur' : 'empty'}
            blurDataURL={collection.heroImage.placeholderUrl || undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden="true">
            <span className="font-heading text-5xl text-primary/25">✦</span>
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, transparent 100%)' }}
        >
          <h3 className="font-heading text-xl leading-tight text-ink">{collection.titleHi}</h3>
          {collection.subtitleHi ? (
            <p className="mt-1 line-clamp-2 font-prose text-sm text-inkMute">{collection.subtitleHi}</p>
          ) : null}
          <p className="mt-2 font-ui text-xs font-semibold text-primaryDeep">
            {collection.productCount} designs
          </p>
        </div>
      </div>
    </a>
  );
}

export default async function CollectionsPage() {
  const slug = resolveShopSlug(headers());
  const config = slug ? await fetchTenantConfig(slug) : null;
  const collections = config ? await fetchCollections(config.shopId) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <p className="font-prose text-[11px] uppercase tracking-[0.28em] text-inkMute">
        क्यूरेटेड
      </p>
      <h1 className="mt-2 font-heading text-3xl text-ink md:text-[2.25rem]">
        कलेक्शन
      </h1>
      <p className="mt-3 max-w-2xl font-prose text-sm leading-relaxed text-inkMute md:text-[15px]">
        अवसर, शैली और धातु के अनुसार चुने गए आभूषण। हर लिंक सीधे उपलब्ध कैटलॉग फ़िल्टर पर जाता है।
      </p>

      <section aria-labelledby="featured-collections" className="mt-8">
        <h2 id="featured-collections" className="font-heading text-2xl text-ink">
          विशेष संग्रह
        </h2>
        {collections.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {fallbackCollections.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md border border-borderSubtle bg-surface p-5 transition-colors hover:border-primary hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
              >
                <h3 className="font-heading text-xl text-ink">{item.title}</h3>
                <p className="mt-2 font-prose text-sm text-inkMute">{item.meta}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="category-collections" className="mt-10">
        <h2 id="category-collections" className="font-heading text-2xl text-ink">
          श्रेणी से खोजें
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {STOREFRONT_CATEGORY_TILES.map((tile) => (
            <a
              key={tile.key}
              href={tile.href}
              className="rounded-pill border border-border bg-surface px-4 py-2 font-ui text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
            >
              {tile.labelHi}
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="occasion-collections" className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 id="occasion-collections" className="font-heading text-2xl text-ink">
            अवसर
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {STOREFRONT_OCCASION_TILES.map((tile) => (
              <a
                key={tile.key}
                href={tile.href}
                className="rounded-pill border border-border bg-surface px-4 py-2 font-ui text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
              >
                {tile.labelHi}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-heading text-2xl text-ink">उपहार</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {STOREFRONT_GIFT_PERSONAS.map((tile) => (
              <a
                key={tile.key}
                href={tile.href}
                className="rounded-pill border border-border bg-surface px-4 py-2 font-ui text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
              >
                {tile.labelHi}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
