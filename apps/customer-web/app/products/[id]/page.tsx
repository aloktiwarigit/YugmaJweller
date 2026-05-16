import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig, fetchProduct, fetchProductReviews, fetchProductImages } from '@/lib/api';
import { HuidBadge } from '@/components/HuidBadge';
import { WishlistButton } from '@/components/WishlistButton';
import { ReviewSection } from '@/components/ReviewSection';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { ProductGallery } from '@/components/products/ProductGallery';
import { StickyCTABar } from '@/components/pdp/StickyCTABar';
import { TrustStrip } from '@/components/pdp/TrustStrip';
import { CompleteTheLook } from '@/components/pdp/CompleteTheLook';
import { ActionRow } from '@/components/pdp/ActionRow';
import { purityLabel, metalLabel } from '@/lib/theme';
import { jsonLd } from '@/lib/storefront';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = resolveShopSlug(headers());
  if (!slug) return { title: 'उत्पाद उपलब्ध नहीं' };

  const config = await fetchTenantConfig(slug);
  if (!config) return { title: 'उत्पाद उपलब्ध नहीं' };

  const product = await fetchProduct(params.id, config.shopId);
  if (!product) return { title: 'उत्पाद उपलब्ध नहीं' };

  const displayName = purityLabel(product.purity);
  const displayMetal = metalLabel(product.metal);
  const title = `${displayName} | ${config.appName}`;
  const description = `${displayName} — ${displayMetal}`.trim();
  const ogImages = product.primaryImage?.url ? [{ url: product.primaryImage.url }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImages,
      type: 'website',
    },
    alternates: {
      canonical: `/products/${params.id}`,
    },
  };
}

function computeAverageRating(
  breakdown: { 1: number; 2: number; 3: number; 4: number; 5: number },
): number | null {
  const total = breakdown[1] + breakdown[2] + breakdown[3] + breakdown[4] + breakdown[5];
  if (total === 0) return null;
  const sum = 1 * breakdown[1] + 2 * breakdown[2] + 3 * breakdown[3] + 4 * breakdown[4] + 5 * breakdown[5];
  return Math.round((sum / total) * 10) / 10;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const slug = resolveShopSlug(headers());
  if (!slug) notFound();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const config = await fetchTenantConfig(slug!);
  if (!config) notFound();

  const [product, reviewsData, images] = await Promise.all([
    fetchProduct(params.id, config.shopId),
    fetchProductReviews(params.id, config.shopId),
    fetchProductImages(params.id, config.shopId),
  ]);
  if (!product) notFound();

  const averageRating = computeAverageRating(reviewsData.ratingBreakdown);
  const isUnavailable  = product.quantity === 0;
  const displayPurity  = purityLabel(product.purity, product.metal);
  const displayMetal   = metalLabel(product.metal);
  const totalFormatted = product.estimatedPrice?.totalFormatted;

  // Build Product JSON-LD. Only include `offers` when we have a real numeric price
  // from the catalog API — never fabricate price data.
  const totalPaiseRaw = product.estimatedPrice?.totalPaise;
  const totalPaise = totalPaiseRaw ? Number.parseInt(totalPaiseRaw, 10) : NaN;
  const hasPrice = Number.isFinite(totalPaise) && totalPaise > 0;

  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: displayPurity,
    image: product.primaryImage?.url ? [product.primaryImage.url] : [],
    description: `${displayPurity} — ${displayMetal}`.trim(),
    brand: { '@type': 'Brand', name: config.appName },
    sku: product.sku ?? params.id,
  };
  if (hasPrice) {
    productSchema['offers'] = {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: (totalPaise / 100).toFixed(2),
      availability: isUnavailable
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productSchema) }}
      />
      {/* Sticky bottom CTA — appears after user scrolls past hero */}
      <StickyCTABar
        productId={product.id}
        productName={displayPurity}
        totalFormatted={totalFormatted}
        disabled={isUnavailable}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <a
          href="/products"
          className="inline-block font-ui text-sm text-primaryDeep underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="सभी उत्पाद सूची पर वापस जाएं"
        >
          ← उत्पाद देखें
        </a>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product gallery */}
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
          <div className="relative rounded-lg overflow-hidden border border-borderSubtle bg-bg">
            <ProductGallery images={images} productName={displayPurity} />
            {isUnavailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/40 pointer-events-none" aria-hidden="true">
                <span className="font-ui text-white text-lg font-medium">उपलब्ध नहीं</span>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col gap-5" aria-label="उत्पाद विवरण">
            <div>
              <h1 className="font-heading text-3xl text-ink">{displayPurity}</h1>
              <p className="font-ui text-sm text-inkMute mt-1">
                {displayMetal} · SKU: {product.sku}
              </p>
              {product.categoryName && (
                <p className="font-ui text-xs text-inkMute mt-0.5">{product.categoryName}</p>
              )}
            </div>

            {/* HUID + BIS badges */}
            <div className="flex flex-wrap gap-2">
              <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
              {product.huid && (
                <span
                  className="inline-flex items-center gap-1 rounded-pill bg-successWash px-2 py-0.5 text-xs font-ui text-successJade border border-successJade/30"
                  aria-label="BIS प्रमाणित हॉलमार्क आभूषण"
                >
                  BIS प्रमाणित ✓
                </span>
              )}
              {isUnavailable && (
                <span
                  className="inline-block rounded-pill bg-error/10 px-2 py-0.5 text-xs font-ui text-error border border-error/30"
                  role="status"
                  aria-label="यह उत्पाद अभी उपलब्ध नहीं है"
                >
                  उपलब्ध नहीं
                </span>
              )}
            </div>

            {/* Average rating */}
            {reviewsData.total > 0 && averageRating !== null && (
              <div className="flex items-center gap-2">
                <span
                  className="text-warningSaffron text-lg"
                  role="img"
                  aria-label={`5 में से ${averageRating} तारे`}
                >
                  {'★'.repeat(Math.round(averageRating))}
                  <span className="text-borderSubtle">{'★'.repeat(5 - Math.round(averageRating))}</span>
                </span>
                <span className="font-ui text-sm text-inkMute">
                  {averageRating} ({reviewsData.total} समीक्षाएं)
                </span>
              </div>
            )}

            {/* Weight */}
            <dl className="grid grid-cols-2 gap-2 font-ui text-sm">
              <div>
                <dt className="text-inkMute">कुल वज़न</dt>
                <dd className="text-ink font-medium tabular-nums">{product.grossWeightG} ग्राम</dd>
              </div>
              <div>
                <dt className="text-inkMute">शुद्ध वज़न</dt>
                <dd className="text-ink font-medium tabular-nums">{product.netWeightG} ग्राम</dd>
              </div>
            </dl>

            {/* Price */}
            {product.priceAvailable && product.estimatedPrice ? (
              <PriceBreakdown price={product.estimatedPrice} />
            ) : (
              <p className="font-ui text-sm text-inkMute border border-borderSubtle rounded-md p-4">
                मूल्य के लिए कृपया दुकान पर संपर्क करें।
              </p>
            )}

            {/* Trust strip: BIS/HUID · Free Exchange · Try at Home · WhatsApp */}
            <TrustStrip />

            {/* Share / Rate-lock / Wishlist action row */}
            <ActionRow
              productId={product.id}
              productName={displayPurity}
            />

            {/* Primary CTAs */}
            {!isUnavailable && (
              <div className="flex flex-col gap-3 border-t border-borderSubtle pt-4">
                <WishlistButton productId={product.id} productName={displayPurity} />
                <a
                  href={`/try-at-home?product=${product.id}`}
                  className="w-full rounded-md border border-primary bg-primary/5 px-6 py-3 font-ui text-primary text-center hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                  aria-label={`${displayPurity} — घर पर कोशिश करने की जानकारी`}
                >
                  घर पर ट्राय करें
                </a>
              </div>
            )}

            {product.priceAvailable && (
              <p className="font-ui text-xs text-inkSoft" role="note">
                * यह अनुमानित मूल्य है। अंतिम मूल्य की पुष्टि दुकान पर करें।
              </p>
            )}
          </div>
        </div>

        {/* Complete the look — fetches /recommendations server-side */}
        <CompleteTheLook productId={product.id} shopId={config.shopId} />

        {/* Reviews */}
        <ReviewSection
          productId={product.id}
          shopId={config.shopId}
          reviews={reviewsData.items}
          averageRating={averageRating}
          total={reviewsData.total}
        />
      </div>
    </>
  );
}
