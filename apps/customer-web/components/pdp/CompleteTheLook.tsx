import { fetchRecommendations } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

interface CompleteTheLookProps {
  productId: string;
  shopId:    string;
}

export async function CompleteTheLook({ productId, shopId }: CompleteTheLookProps) {
  const recommendations = await fetchRecommendations(productId, shopId);
  if (!recommendations.length) return null;

  const displayed = recommendations.slice(0, 4);

  return (
    <section aria-label="इसके साथ पहनें" className="mt-10 border-t border-borderSubtle pt-6">
      <div className="mb-4">
        <p className="font-ui text-xs font-semibold uppercase tracking-widest text-inkSoft">
          इसके साथ पहनें
        </p>
        <h2 className="font-heading text-xl text-ink mt-0.5">पूरा करें यह लुक</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {displayed.map(product => (
          <div key={product.id} className="w-44 shrink-0 snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
