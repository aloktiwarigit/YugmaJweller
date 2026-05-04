import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProduct, fetchProductReviews, fetchProductImages } from '@/lib/api';
import { HuidBadge } from '@/components/HuidBadge';
import { WishlistButton } from '@/components/WishlistButton';
import { ReviewSection } from '@/components/ReviewSection';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { ProductGallery } from '@/components/products/ProductGallery';
import { purityLabel, metalLabel } from '@/lib/theme';

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

  const [product, reviewsData, images] = await Promise.all([
    fetchProduct(params.id, config.shopId),
    fetchProductReviews(params.id, config.shopId),
    fetchProductImages(params.id, config.shopId),
  ]);
  if (!product) notFound();

  const isUnavailable = product.quantity === 0;
  const displayPurity = purityLabel(product.purity);
  const displayMetal  = metalLabel(product.metal);

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
        {/* Product image — responsive preload for LCP hero */}
        {images.length > 0 && (
          <link
            rel="preload"
            as="image"
            imageSrcSet={images[0]!.srcset}
            imageSizes="(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 800px"
            fetchPriority="high"
            href={images[0]!.default_url}
          />
        )}
        <div className="relative rounded-lg overflow-hidden border border-border bg-bg">
          <ProductGallery images={images} productName={displayPurity} />
          {isUnavailable && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-ink/40 pointer-events-none"
              aria-hidden="true"
            >
              <span className="font-body text-white text-lg font-medium">उपलब्ध नहीं</span>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="flex flex-col gap-5" aria-label="उत्पाद विवरण">
          <div>
            <h1 className="font-heading text-3xl text-ink">{displayPurity}</h1>
            <p className="font-body text-sm text-inkMute mt-1">
              {displayMetal} · SKU: {product.sku}
            </p>
            {product.categoryName && (
              <p className="font-body text-xs text-inkMute mt-0.5">{product.categoryName}</p>
            )}
          </div>

          {/* HUID badge */}
          <div className="flex flex-wrap gap-2">
            <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
            {product.huid && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-body text-green-700 border border-green-200"
                aria-label="BIS प्रमाणित हॉलमार्क आभूषण"
              >
                BIS प्रमाणित ✓
              </span>
            )}
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

          {/* Weight details */}
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

          {/* Full price breakdown */}
          {product.priceAvailable && product.estimatedPrice ? (
            <PriceBreakdown price={product.estimatedPrice} />
          ) : (
            <p className="font-body text-sm text-inkMute border border-border rounded-lg p-4">
              मूल्य के लिए कृपया दुकान पर संपर्क करें।
            </p>
          )}

          {/* Action CTAs */}
          {!isUnavailable && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <WishlistButton productId={product.id} productName={displayPurity} />

              {/* Try at Home CTA */}
              <a
                href={`/try-at-home?product=${product.id}`}
                className="w-full rounded-md border border-primary bg-primary/5 px-6 py-3 font-body text-primary text-center hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                aria-label={`${displayPurity} — घर पर कोशिश करने की जानकारी`}
              >
                🏠 कोशिश घर पर करें
              </a>

              {/* Rate Lock CTA */}
              <a
                href={`/rate-lock?product=${product.id}`}
                className="w-full rounded-md border border-border bg-white px-6 py-3 font-body text-ink text-center hover:bg-border/30 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                aria-label={`${displayPurity} — आज का मूल्य लॉक करें`}
              >
                🔒 दर-लॉक बुकिंग करें
              </a>
            </div>
          )}

          {/* Price disclaimer */}
          {product.priceAvailable && (
            <p className="font-body text-xs text-inkMute" role="note">
              * यह अनुमानित मूल्य है। अंतिम मूल्य की पुष्टि दुकान पर करें।
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
