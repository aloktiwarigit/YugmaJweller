import Image from 'next/image';
import { GoldTexturePlaceholder } from './GoldTexturePlaceholder';
import { HuidBadge } from './HuidBadge';
import { EstimatedPriceBadge } from './EstimatedPriceBadge';
import { purityLabel } from '@/lib/theme';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

// Accepts both CatalogProduct (Phase 1) and CatalogProductCard (Phase B)
export function ProductCard({ product }: { product: CatalogProductCard }) {
  const isUnavailable = product.quantity === 0;
  const label = purityLabel(product.purity);

  return (
    <a
      href={`/products/${product.id}`}
      className="group block rounded-lg border border-border bg-white overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`${label} — ${product.sku}${isUnavailable ? ' (उपलब्ध नहीं)' : ''}`}
    >
      <div className="relative" style={{ aspectRatio: '4/5' }}>
        <div className="absolute inset-0 bg-bg overflow-hidden rounded-t-lg">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? label}
              fill
              sizes="(max-width: 640px) 50vw, 280px"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              placeholder={product.primaryImage.placeholderUrl ? 'blur' : 'empty'}
              blurDataURL={product.primaryImage.placeholderUrl || undefined}
            />
          ) : (
            <GoldTexturePlaceholder className="w-full h-full group-hover:scale-105 transition-transform duration-300" />
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
      <div className="p-3 flex flex-col gap-1.5">
        <p className="font-body text-sm font-medium text-ink">{label}</p>
        <p className="font-body text-xs text-inkMute">{product.sku}</p>
        <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
        <EstimatedPriceBadge
          priceAvailable={product.priceAvailable}
          totalFormatted={product.estimatedPrice?.totalFormatted}
          compact
        />
      </div>
    </a>
  );
}
