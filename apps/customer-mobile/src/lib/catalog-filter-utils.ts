import { PRICE_BANDS } from '@goldsmith/customer-shared';
import type { PriceBand, CatalogSort } from '@goldsmith/customer-shared';

export interface ActiveFilters {
  metal?:      string;
  purity:      string[];
  priceMin?:   number;
  priceMax?:   number;
  style:       string[];
  occasion:    string[];
  inStockOnly: boolean;
  sort?:       CatalogSort;
}

export const EMPTY_FILTERS: ActiveFilters = {
  purity:      [],
  style:       [],
  occasion:    [],
  inStockOnly: false,
};

export const METAL_FILTER_LABELS: Record<string, string> = {
  GOLD:    'सोना',
  SILVER:  'चाँदी',
  DIAMOND: 'हीरा',
};

export const PURITY_FILTER_LABELS: Record<string, string> = {
  GOLD_24K:   'सोना 24K',
  GOLD_22K:   'सोना 22K',
  GOLD_20K:   'सोना 20K',
  GOLD_18K:   'सोना 18K',
  GOLD_14K:   'सोना 14K',
  SILVER_999: 'चाँदी 999',
  SILVER_925: 'चाँदी 925',
};

export const STYLE_FILTER_LABELS: Record<string, string> = {
  DAILY_WEAR: 'रोज़मर्रा',
  ENGAGEMENT: 'सगाई',
  COUPLE:     'जोड़ी',
  JHUMKA:     'झुमका',
  STUDS:      'स्टड्स',
  HOOPS:      'हूप्स',
  DROP:       'ड्रॉप',
  STATEMENT:  'स्टेटमेंट',
  TEMPLE:     'मंदिर',
  BRIDAL:     'दुल्हन',
  OFFICE:     'ऑफिस',
  KIDS:       'बच्चे',
};

export const OCCASION_FILTER_LABELS: Record<string, string> = {
  WEDDING:     'शादी',
  ENGAGEMENT:  'सगाई',
  ANNIVERSARY: 'सालगिरह',
  FESTIVAL:    'त्योहार',
  DAILY:       'रोज़मर्रा',
  GIFT:        'उपहार',
  OFFICE:      'ऑफिस',
  PARTY:       'पार्टी',
};

/** Returns the PRICE_BANDS entry matching priceMin+priceMax, or undefined. */
export function findPriceBand(
  priceMin?: number,
  priceMax?: number,
): PriceBand | undefined {
  if (priceMin === undefined && priceMax === undefined) return undefined;
  return PRICE_BANDS.find(
    (b) => b.min === priceMin && b.max === priceMax,
  );
}

/** Total count of individual filter selections (used for badge). */
export function countActiveFilters(filters: ActiveFilters): number {
  let n = 0;
  if (filters.metal)              n++;
  if (filters.purity.length)      n += filters.purity.length;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) n++;
  if (filters.style.length)       n += filters.style.length;
  if (filters.occasion.length)    n += filters.occasion.length;
  if (filters.inStockOnly)        n++;
  return n;
}

/** Flat chip list for the active-filter rail. */
export function activeFilterChips(
  filters: ActiveFilters,
): Array<{ key: string; labelHi: string }> {
  const chips: Array<{ key: string; labelHi: string }> = [];

  if (filters.metal) {
    chips.push({ key: `metal:${filters.metal}`, labelHi: METAL_FILTER_LABELS[filters.metal] ?? filters.metal });
  }
  for (const p of filters.purity) {
    chips.push({ key: `purity:${p}`, labelHi: PURITY_FILTER_LABELS[p] ?? p });
  }
  const band = findPriceBand(filters.priceMin, filters.priceMax);
  if (band) {
    chips.push({ key: 'price', labelHi: band.labelHi });
  }
  for (const s of filters.style) {
    chips.push({ key: `style:${s}`, labelHi: STYLE_FILTER_LABELS[s] ?? s });
  }
  for (const o of filters.occasion) {
    chips.push({ key: `occasion:${o}`, labelHi: OCCASION_FILTER_LABELS[o] ?? o });
  }
  if (filters.inStockOnly) {
    chips.push({ key: 'inStock', labelHi: 'उपलब्ध' });
  }
  return chips;
}

/** Returns a new filters object with the chip identified by key removed. */
export function removeFilterChip(
  filters: ActiveFilters,
  key: string,
): ActiveFilters {
  const [type, value] = key.split(':');
  switch (type) {
    case 'metal':    return { ...filters, metal: undefined };
    case 'purity':   return { ...filters, purity: filters.purity.filter((p) => p !== value) };
    case 'price':    return { ...filters, priceMin: undefined, priceMax: undefined };
    case 'style':    return { ...filters, style: filters.style.filter((s) => s !== value) };
    case 'occasion': return { ...filters, occasion: filters.occasion.filter((o) => o !== value) };
    case 'inStock':  return { ...filters, inStockOnly: false };
    default:         return filters;
  }
}
