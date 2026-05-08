import { ProductCard } from './ProductCard';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

interface ProductGridProps {
  products: CatalogProductCard[];
  emptyMessage?: string;
}

export function ProductGrid({ products, emptyMessage = 'अभी कोई उत्पाद उपलब्ध नहीं है' }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8" aria-live="polite">
        <p className="font-body text-inkMute text-center">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="उत्पाद सूची">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
