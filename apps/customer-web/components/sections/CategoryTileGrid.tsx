import Image from 'next/image';
import Link from 'next/link';
import type { CategoryTile } from '@goldsmith/customer-shared';

interface CategoryTileGridProps {
  tiles: CategoryTile[];
  columns?: 4 | 3;
  headingId?: string;
}

const colClass: Record<number, string> = {
  4: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-4',
  3: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3',
};

const CATEGORY_IMAGES: Record<string, string> = {
  rings: '/demo-shop/campaign-rings-showcase.jpg',
  earrings: '/demo-shop/campaign-gift-table.jpg',
  pendants: '/demo-shop/campaign-lifestyle-necklace.jpg',
  bangles: '/demo-shop/hero-bangles.jpg',
  necklaces: '/demo-shop/campaign-necklace-showcase.jpg',
  mangalsutra: '/demo-shop/campaign-black-gold.jpg',
  bracelets: '/demo-shop/gold-ginkgo-wide.jpg',
  silver: '/demo-shop/campaign-luxe-window.jpg',
};

export function CategoryTileGrid({ tiles, columns = 4, headingId }: CategoryTileGridProps) {
  const gridClass = colClass[columns] ?? colClass[4];

  return (
    <ul
      className={`grid gap-3 ${gridClass}`}
      aria-labelledby={headingId}
    >
      {tiles.map((tile) => {
        const image = CATEGORY_IMAGES[tile.key] ?? '/demo-shop/campaign-showroom-display.jpg';

        return (
          <li key={tile.key}>
            <Link
              href={tile.href}
              className="group block overflow-hidden rounded-md border border-borderSubtle bg-surface transition-all hover:border-borderStrong hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="relative bg-bg" style={{ aspectRatio: '4/3' }}>
                <Image
                  src={image}
                  alt={tile.labelEn}
                  fill
                  sizes="(max-width: 640px) 50vw, 280px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex min-h-12 items-center justify-center px-2 py-2">
                <span className="line-clamp-2 text-center font-ui text-xs font-semibold text-ink transition-colors group-hover:text-primaryDeep">
                  {tile.labelHi}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
