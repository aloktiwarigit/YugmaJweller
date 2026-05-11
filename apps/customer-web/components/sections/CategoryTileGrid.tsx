import Link from 'next/link';
import type { CategoryTile } from '@goldsmith/customer-shared';

interface CategoryTileGridProps {
  tiles: CategoryTile[];
  columns?: 4 | 3;
  headingId?: string;
}

const colClass: Record<number, string> = {
  4: 'grid-cols-4 sm:grid-cols-4 md:grid-cols-4',
  3: 'grid-cols-3 sm:grid-cols-3 md:grid-cols-3',
};

function CategoryIcon({ label }: { label: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="text-primary"
    >
      <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <text x="16" y="21" textAnchor="middle" fontSize="14" fill="currentColor" fontFamily="serif">
        {label.slice(0, 1)}
      </text>
    </svg>
  );
}

export function CategoryTileGrid({ tiles, columns = 4, headingId }: CategoryTileGridProps) {
  const gridClass = colClass[columns] ?? colClass[4];

  return (
    <div
      className={`grid gap-3 ${gridClass}`}
      role="list"
      aria-labelledby={headingId}
    >
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href={tile.href}
          role="listitem"
          className="group flex flex-col items-center gap-2 p-3 bg-surface rounded-md border border-borderSubtle hover:border-borderStrong hover:shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="w-12 h-12 flex items-center justify-center">
            <CategoryIcon label={tile.labelHi} />
          </div>
          <span className="font-ui font-medium text-xs text-center text-ink group-hover:text-primaryDeep transition-colors line-clamp-2">
            {tile.labelHi}
          </span>
        </Link>
      ))}
    </div>
  );
}
