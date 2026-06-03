'use client';
import Image from 'next/image';
import { HuidBadge } from './HuidBadge';
import { EstimatedPriceBadge } from './EstimatedPriceBadge';
import { WishlistButton } from './WishlistButton';
import { storefrontBlurDataUrl, storefrontImageUrl } from '@/lib/image-url';
import { purityLabel } from '@/lib/theme';
import {
  categoryToFallbackSvg,
  productDisplayName,
  productSubtitle,
} from '@goldsmith/customer-shared';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

interface ProductCardProps {
  product: CatalogProductCard;
  variant?: 'default' | 'compact';
  priority?: boolean;
}

// Accepts both CatalogProduct (Phase 1) and CatalogProductCard (Phase B)
export function ProductCard({ product, variant = 'default', priority = false }: ProductCardProps) {
  const isUnavailable = product.quantity === 0;
  const isCompact = variant === 'compact';
  const label = purityLabel(product.purity, product.metal);
  const displayName = productDisplayName(product);
  const subtitle = product.subtitle?.trim() || productSubtitle(product);
  const badges = product.badges ?? [];
  const imageUrl = product.primaryImage ? storefrontImageUrl(product.primaryImage.url) : null;
  const placeholderUrl = product.primaryImage ? storefrontBlurDataUrl(product.primaryImage.placeholderUrl) : undefined;

  return (
    <div className="group relative overflow-hidden rounded-md border border-borderSubtle bg-white transition-colors hover:border-primary/40">
      {/* Primary navigation link wraps the image */}
      <a
        href={`/products/${product.id}`}
        className="block focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${displayName}${isUnavailable ? ' (उपलब्ध नहीं)' : ''}`}
      >
        <div
          className={isCompact ? 'relative h-28 sm:h-[124px] lg:h-[132px]' : 'relative'}
          style={isCompact ? undefined : { aspectRatio: '1/1' }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-t-md bg-surface">
            {product.primaryImage && imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.primaryImage.alt ?? displayName}
                fill
                sizes={isCompact ? '(max-width: 640px) 50vw, 180px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 210px'}
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                placeholder={placeholderUrl ? 'blur' : 'empty'}
                blurDataURL={placeholderUrl}
                priority={priority}
              />
            ) : (
              // Category-aware illustrated fallback (ring / earring / pendant / bangle / necklace / silver).
              // Uses an SVG string from @goldsmith/customer-shared, served via a data: URI so it works
              // identically across SSR, edge runtime, and client bundle without bundler-specific imports.
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(categoryToFallbackSvg(product.categoryName))}`}
                alt={product.categoryName ?? label}
                className={`${isCompact ? 'h-full w-full object-contain p-3' : 'h-full w-full object-cover'} transition-transform duration-300 group-hover:scale-[1.03]`}
              />
            )}
          </div>
          {isUnavailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40" aria-hidden="true">
              <span className="font-ui text-white text-sm font-medium bg-ink/70 px-3 py-1 rounded">
                उपलब्ध नहीं
              </span>
            </div>
          )}
        </div>
      </a>

      {/* Compact wishlist button — positioned top-right, z above the link */}
      {!isUnavailable && (
        <div className="absolute right-2 top-2 z-10">
          <WishlistButton productId={product.id} productName={label} compact />
        </div>
      )}

      {/* Card footer — duplicate link for visual layout; hidden from keyboard/screen readers */}
      <a
        href={`/products/${product.id}`}
        className={`${isCompact ? 'p-2.5' : 'p-2.5'} block focus-visible:outline-2 focus-visible:outline-primary`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className={`${isCompact ? 'min-h-[96px] gap-1' : 'min-h-[112px] gap-1.5'} flex flex-col`}>
          <p className={`${isCompact ? 'text-[13px] leading-4' : 'text-sm leading-5'} line-clamp-1 font-body font-semibold text-ink`}>
            {displayName}
          </p>
          <p className={`${isCompact ? 'text-[11px] leading-4' : 'text-[11px]'} line-clamp-1 font-body text-inkMute`}>
            {subtitle}
          </p>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span key={badge} className="rounded-pill bg-primaryWash px-2 py-0.5 font-ui text-[11px] text-primaryDeep">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          {isCompact ? null : (
            <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
          )}
          <EstimatedPriceBadge
            priceAvailable={product.priceAvailable}
            totalFormatted={product.estimatedPrice?.totalFormatted}
            compact
          />
        </div>
      </a>
    </div>
  );
}
