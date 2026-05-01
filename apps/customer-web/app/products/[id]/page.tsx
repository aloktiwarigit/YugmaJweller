import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProduct, fetchProductReviews } from '@/lib/api';
import { HuidBadge } from '@/components/HuidBadge';
import { EstimatedPriceBadge } from '@/components/EstimatedPriceBadge';
import { WishlistButton } from '@/components/WishlistButton';
import { GoldTexturePlaceholder } from '@/components/GoldTexturePlaceholder';
import { ReviewSection } from '@/components/ReviewSection';
import { purityLabel } from '@/lib/theme';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

interface PageProps {
  params: { id: string };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const slug = resolveSlug();
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  const [product, reviewsData] = await Promise.all([
    fetchProduct(params.id, config.shopId),
    fetchProductReviews(params.id, config.shopId),
  ]);
  if (!product) notFound();

  const isUnavailable  = product.quantity === 0;
  const displayPurity  = purityLabel(product.purity);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <a
        href="/products"
        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="सभी उत्पाद सूची पर वापस जाएं"
      >
        ← उत्पाद देखें
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product image */}
        <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg">
          <GoldTexturePlaceholder className="w-full h-full" />
          {isUnavailable && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-ink/40"
              aria-hidden="true"
            >
              <span className="font-body text-white text-lg font-medium">उपलब्ध नहीं</span>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="flex flex-col gap-4" aria-label="उत्पाद विवरण">
          <div>
            <h1 className="font-heading text-3xl text-ink">{displayPurity}</h1>
            <p className="font-body text-sm text-inkMute mt-1">SKU: {product.sku}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
            {isUnavailable && (
              <span
                className="inline-block rounded-full bg-error/10 px-2 py-0.5 text-xs font-body text-error border border-error/30"
                role="status"
                aria-label="यह उत्पाद अभी उपलब्ध नहीं है"
              >
                उपलब्ध नहीं
              </span>
            )}
          </div>

          {/* Average rating summary */}
          {reviewsData.total > 0 && reviewsData.averageRating !== null && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-500 text-lg" aria-hidden="true">
                {'★'.repeat(Math.round(reviewsData.averageRating))}
                {'☆'.repeat(5 - Math.round(reviewsData.averageRating))}
              </span>
              <span className="font-body text-sm text-inkMute">
                {reviewsData.averageRating} ({reviewsData.total} समीक्षाएं)
              </span>
            </div>
          )}

          {/* Weight */}
          <dl className="grid grid-cols-2 gap-2 font-body text-sm">
            <div>
              <dt className="text-inkMute">कुल वज़न</dt>
              <dd className="text-ink font-medium">{product.grossWeightG} ग्राम</dd>
            </div>
            <div>
              <dt className="text-inkMute">शुद्ध वज़न</dt>
              <dd className="text-ink font-medium">{product.netWeightG} ग्राम</dd>
            </div>
          </dl>

          {/* Estimated price */}
          <div className="border-t border-border pt-4">
            <EstimatedPriceBadge
              priceAvailable={product.priceAvailable}
              totalFormatted={product.estimatedPrice?.totalFormatted}
            />
          </div>

          {/* Wishlist toggle — only when available */}
          {!isUnavailable && (
            <WishlistButton productId={product.id} productName={displayPurity} />
          )}

          {/* Price disclaimer */}
          {product.priceAvailable && (
            <p className="font-body text-xs text-inkMute" role="note">
              * यह अनुमानित मूल्य है। पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं।
              अंतिम मूल्य के लिए दुकान पर संपर्क करें।
            </p>
          )}
        </div>
      </div>

      {/* Reviews */}
      <ReviewSection
        productId={product.id}
        shopId={config.shopId}
        reviews={reviewsData.reviews}
        averageRating={reviewsData.averageRating}
        total={reviewsData.total}
      />
    </div>
  );
}
