import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from './SectionHeading';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

interface RecommendedSectionProps {
  products: CatalogProductCard[];
}

export function RecommendedSection({ products }: RecommendedSectionProps) {
  if (products.length === 0) return null;

  const items = products.slice(0, 4);

  return (
    <section aria-labelledby="recommended-heading" className="py-10 bg-bg">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading
          id="recommended-heading"
          titleHi="आपके लिए चुनिंदा"
          eyebrowHi="सुझाव"
          eyebrowEn="Recommended"
        />
        <div className="hidden md:grid grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
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
      </div>
    </section>
  );
}
