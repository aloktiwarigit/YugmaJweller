import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from './SectionHeading';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

interface TopSellersSectionProps {
  products: CatalogProductCard[];
}

export function TopSellersSection({ products }: TopSellersSectionProps) {
  const items = products.slice(0, 4);

  return (
    <section aria-labelledby="top-sellers-heading" className="py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6">
          <SectionHeading
            id="top-sellers-heading"
            titleHi="टॉप सेलर"
            pill={{ labelHi: 'लोकप्रिय', className: 'bg-accentWash text-ink' }}
          />
          <Link
            href="/products?sort=bestseller"
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
            {/* Mobile: horizontal scroll-snap */}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STOREFRONT_CATEGORY_TILES.slice(0, 4).map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="flex items-center justify-center p-6 bg-surface border border-borderSubtle rounded-md hover:border-borderStrong font-ui text-sm text-ink"
              >
                {tile.labelHi}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
