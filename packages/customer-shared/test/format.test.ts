import { describe, it, expect } from 'vitest';
import { formatInrFromPaise, productDisplayName } from '../src/format';

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
});
