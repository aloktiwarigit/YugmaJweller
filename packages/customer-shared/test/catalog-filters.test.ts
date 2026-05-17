import { describe, it, expect } from 'vitest';
import {
  PRICE_BANDS,
  CATALOG_STYLES,
  metalLabel,
  purityLabel,
  buildProductsHref,
} from '../src/catalog-filters';

describe('PRICE_BANDS', () => {
  it('has at least 4 bands', () => {
    expect(PRICE_BANDS.length).toBeGreaterThanOrEqual(4);
  });

  it('each band has labelHi and min', () => {
    for (const band of PRICE_BANDS) {
      expect(typeof band.labelHi).toBe('string');
      expect(typeof band.min).toBe('number');
    }
  });
});

describe('CATALOG_STYLES', () => {
  it('includes DAILY_WEAR and BRIDAL', () => {
    expect(CATALOG_STYLES).toContain('DAILY_WEAR');
    expect(CATALOG_STYLES).toContain('BRIDAL');
  });
});

describe('metalLabel', () => {
  it('returns सोना for GOLD', () => {
    expect(metalLabel('GOLD')).toBe('सोना');
  });

  it('returns चाँदी for SILVER', () => {
    expect(metalLabel('SILVER')).toBe('चाँदी');
  });

  it('returns the raw value for unknown metal', () => {
    expect(metalLabel('TITANIUM')).toBe('TITANIUM');
  });
});

describe('purityLabel', () => {
  it('returns "सोना 22K" for long-form GOLD_22K', () => {
    expect(purityLabel('GOLD_22K')).toBe('सोना 22K');
  });

  it('returns "चाँदी 999" for long-form SILVER_999', () => {
    expect(purityLabel('SILVER_999')).toBe('चाँदी 999');
  });

  // The current customer catalog API returns short-form purities like "22K"
  // without the leading metal token. Without the metalHint the split-based
  // metal recovery breaks and the metal prefix is dropped — see catalog-
  // filters.ts comment. Callers in front of CatalogProductCard data should
  // always pass `product.metal` as the second argument.
  it('returns "सोना 22K" for short-form "22K" with metalHint GOLD', () => {
    expect(purityLabel('22K', 'GOLD')).toBe('सोना 22K');
  });

  it('returns "चाँदी 999" for short-form "999" with metalHint SILVER', () => {
    expect(purityLabel('999', 'SILVER')).toBe('चाँदी 999');
  });

  it('returns bare purity when neither split nor metalHint resolves', () => {
    expect(purityLabel('22K')).toBe('22K');
    expect(purityLabel('22K', 'UNKNOWN')).toBe('22K');
  });

  it('prefers split metal over metalHint when split resolves', () => {
    // Defensive: if a caller passes mismatched metalHint with a long-form
    // purity, we should trust the long-form (it's authoritative).
    expect(purityLabel('GOLD_22K', 'SILVER')).toBe('सोना 22K');
  });
});

describe('buildProductsHref', () => {
  it('returns /products with no params when called with empty object', () => {
    expect(buildProductsHref({})).toBe('/products');
  });

  it('serialises metal param', () => {
    expect(buildProductsHref({ metal: 'GOLD' })).toBe('/products?metal=GOLD');
  });

  it('serialises multiple params', () => {
    const href = buildProductsHref({ metal: 'GOLD', purity: 'GOLD_22K', sort: 'newest' });
    expect(href).toContain('metal=GOLD');
    expect(href).toContain('purity=GOLD_22K');
    expect(href).toContain('sort=newest');
    expect(href.startsWith('/products?')).toBe(true);
  });

  it('omits undefined/null params', () => {
    const href = buildProductsHref({ metal: 'GOLD' });
    expect(href).not.toContain('purity');
  });

  it('serialises priceMin and priceMax as strings', () => {
    const href = buildProductsHref({ priceMin: 100000, priceMax: 500000 });
    expect(href).toContain('priceMin=100000');
    expect(href).toContain('priceMax=500000');
  });
});
