import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from './SectionHeading';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

interface NewArrivalsSectionProps {
  products: CatalogProductCard[];
}

export function NewArrivalsSection({ products }: NewArrivalsSectionProps) {
  const items = products.slice(0, 4);

  return (
    <section aria-labelledby="new-arrivals-heading" className="py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6">
          <SectionHeading
            id="new-arrivals-heading"
            titleHi="नई कलेक्शन"
            eyebrowHi="नई कलेक्शन"
            eyebrowEn="New Arrivals"
          />
          <Link
            href="/products?sort=newest"
            className="font-ui text-sm text-primaryDeep underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary"
          >
            सभी देखें →
          </Link>
        </div>

        {items.length > 0 ? (
          <>
            {/* Desktop: 4-column grid */}
            <div className="hidden md:grid grid-cols-4 gap-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {/* Mobile: horizontal scroll-snap (peek 1.15 cards) */}
            <div
              className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
              style={{ scrollPaddingLeft: '1rem' }}
            >
              {items.map((p) => (
                <div key={p.id} className="snap-start shrink-0 w-[72vw]">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Fallback: 4 category tiles */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STOREFRONT_CATEGORY_TILES.slice(0, 4).map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="flex flex-col items-center gap-2 p-6 bg-surface border border-borderSubtle rounded-md hover:border-borderStrong transition-colors"
              >
                <span className="font-heading text-3xl text-primary/40">आ</span>
                <span className="font-ui text-sm font-medium text-ink">{tile.labelHi}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
