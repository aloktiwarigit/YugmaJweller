import { describe, it, expect } from 'vitest';
import { formatInrFromPaise, productDisplayName, productMerchBadges, productSubtitle } from '../src/format';

describe('formatInrFromPaise', () => {
  it('formats 500000 paise as ₹5,000', () => {
    expect(formatInrFromPaise(500_000)).toBe('₹5,000');
  });

  it('formats 100 paise as ₹1', () => {
    expect(formatInrFromPaise(100)).toBe('₹1');
  });

  it('formats 10000000 paise as ₹1,00,000 (Indian number system)', () => {
    const result = formatInrFromPaise(10_000_000);
    expect(result).toMatch(/₹/);
    expect(result).toContain('1,00,000');
  });

  it('formats 0 paise as ₹0', () => {
    expect(formatInrFromPaise(0)).toBe('₹0');
  });
});

describe('productDisplayName', () => {
  it('returns category + metal + purity in Hindi-first format', () => {
    const result = productDisplayName({
      sku: 'SKU001',
      metal: 'GOLD',
      purity: 'GOLD_22K',
      categoryName: 'अंगूठी',
    });
    expect(result).toContain('सोना');
    expect(result).toContain('22K');
    expect(result).toContain('अंगूठी');
  });

  it('falls back to SKU when categoryName is null', () => {
    const result = productDisplayName({
      sku: 'RING-001',
      metal: 'SILVER',
      purity: 'SILVER_999',
      categoryName: null,
    });
    expect(result).toContain('चाँदी');
    expect(result).toContain('RING-001');
  });

  it('uses curated demo names for image-backed storefront seed products', () => {
    const result = productDisplayName({
      sku: 'DMO-RG-001',
      metal: 'GOLD',
      purity: 'GOLD_22K',
      categoryName: 'Diamond Rings',
      style: 'ENGAGEMENT',
    });

    expect(result).toContain('Diamond');
    expect(result).toContain('Engagement');
    expect(result).toContain('Ring');
    expect(result).not.toContain('DMO-RG-001');
  });
});

describe('productSubtitle', () => {
  it('summarizes purity, metal, weight, and HUID status', () => {
    const result = productSubtitle({
      metal: 'GOLD',
      purity: 'GOLD_22K',
      netWeightG: '4.7520',
      huid: 'AB1234',
    });

    expect(result).toContain('22K');
    expect(result).toContain('4.75 g');
    expect(result).toContain('BIS/HUID');
  });

  it('omits malformed weight values', () => {
    const result = productSubtitle({
      metal: 'GOLD',
      purity: 'GOLD_22K',
      netWeightG: 'unknown',
      huid: null,
    });

    expect(result).not.toContain('NaN');
    expect(result).not.toContain('unknown');
  });
});

describe('productMerchBadges', () => {
  it('returns compact badges for trusted low-stock products', () => {
    const result = productMerchBadges({
      huid: 'AB1234',
      quantity: 2,
      priceAvailable: true,
    });

    expect(result).toEqual(['HUID', 'Live price', 'Low stock']);
  });
});
