import { METAL_LABELS, PURITY_LABELS } from './format-internals';

// Re-export so consumers only need one import for all label utilities
export { METAL_LABELS, PURITY_LABELS } from './format-internals';

export function metalLabel(metal: string): string {
  return METAL_LABELS[metal] ?? metal;
}

// `metalHint` is the catalog API's `product.metal` enum (GOLD/SILVER/PLATINUM).
// The historic contract returned long-form purities like "GOLD_22K", so the
// metal could be derived by splitting on "_". The current customer catalog
// endpoint returns SHORT purities ("22K", "999"); the split is empty and the
// Hindi metal prefix was being dropped on browse + carousel cards (verified
// on Moto G 2026-05-12 — "22K" instead of "सोना 22K"). Callers in front of
// CatalogProductCard data should always pass `product.metal`.
export function purityLabel(purity: string, metalHint?: string): string {
  const splitKey = purity.split('_')[0] ?? '';
  const metalKey = METAL_LABELS[splitKey] ? splitKey : (metalHint ?? '');
  const metalHi  = METAL_LABELS[metalKey] ?? '';
  const k        = PURITY_LABELS[purity] ?? purity;
  return metalHi ? `${metalHi} ${k}` : k;
}

export interface PriceBand {
  labelHi: string;
  labelEn: string;
  min:     number;
  max?:    number;
}

export const PRICE_BANDS: PriceBand[] = [
  { labelHi: '₹10K तक',      labelEn: 'Under ₹10K',     min: 0,          max: 1_000_000  },
  { labelHi: '₹10K–₹25K',    labelEn: '₹10K–₹25K',      min: 1_000_000,  max: 2_500_000  },
  { labelHi: '₹25K–₹50K',    labelEn: '₹25K–₹50K',      min: 2_500_000,  max: 5_000_000  },
  { labelHi: '₹50K–₹1L',     labelEn: '₹50K–₹1L',       min: 5_000_000,  max: 10_000_000 },
  { labelHi: '₹1L–₹5L',      labelEn: '₹1L–₹5L',        min: 10_000_000, max: 50_000_000 },
  { labelHi: '₹5L से ऊपर',   labelEn: 'Above ₹5L',      min: 50_000_000                  },
];

export interface PurityFilter {
  labelHi: string;
  value:   string;
}

export const PURITY_FILTERS: PurityFilter[] = [
  { labelHi: 'सोना 24K',   value: 'GOLD_24K'   },
  { labelHi: 'सोना 22K',   value: 'GOLD_22K'   },
  { labelHi: 'सोना 18K',   value: 'GOLD_18K'   },
  { labelHi: 'चाँदी 999',  value: 'SILVER_999' },
  { labelHi: 'चाँदी 925',  value: 'SILVER_925' },
];

export const CATALOG_STYLES = [
  'DAILY_WEAR', 'ENGAGEMENT', 'COUPLE', 'JHUMKA', 'STUDS',
  'HOOPS', 'DROP', 'STATEMENT', 'TEMPLE', 'BRIDAL', 'OFFICE', 'KIDS',
] as const;

export const CATALOG_OCCASIONS = [
  'WEDDING', 'ENGAGEMENT', 'ANNIVERSARY', 'FESTIVAL', 'DAILY',
  'GIFT', 'OFFICE', 'PARTY',
] as const;

export const CATALOG_GIFT_PERSONAS = [
  'MOTHER', 'SISTER', 'WIFE', 'BRIDE', 'SELF', 'FRIEND',
] as const;

export const CATALOG_SORTS = [
  'newest', 'priceAsc', 'priceDesc', 'trending', 'bestseller',
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

export interface ProductsHrefParams {
  metal?:       string;
  purity?:      string;
  search?:      string;
  collection?:  string;
  style?:       string;
  occasion?:    string;
  giftPersona?: string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  sort?:        CatalogSort;
  page?:        number;
}

export function buildProductsHref(params: ProductsHrefParams): string {
  const qs = new URLSearchParams();
  if (params.metal)       qs.set('metal', params.metal);
  if (params.purity)      qs.set('purity', params.purity);
  if (params.search)      qs.set('search', params.search);
  if (params.collection)  qs.set('collection', params.collection);
  if (params.style)       qs.set('style', params.style);
  if (params.occasion)    qs.set('occasion', params.occasion);
  if (params.giftPersona) qs.set('giftPersona', params.giftPersona);
  if (params.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params.inStockOnly) qs.set('inStockOnly', 'true');
  if (params.sort)        qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  const str = qs.toString();
  return `/products${str ? `?${str}` : ''}`;
}
