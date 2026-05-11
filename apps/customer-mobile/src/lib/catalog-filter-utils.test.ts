import { describe, it, expect } from 'vitest';
import {
  countActiveFilters,
  findPriceBand,
  activeFilterChips,
  removeFilterChip,
  EMPTY_FILTERS,
} from './catalog-filter-utils';
import type { ActiveFilters } from './catalog-filter-utils';

describe('countActiveFilters', () => {
  it('returns 0 for empty filters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });
  it('counts each purity separately', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, purity: ['GOLD_22K', 'GOLD_24K'] };
    expect(countActiveFilters(f)).toBe(2);
  });
  it('counts metal + purity + inStockOnly', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, metal: 'GOLD', purity: ['GOLD_22K'], inStockOnly: true };
    expect(countActiveFilters(f)).toBe(3);
  });
  it('counts price band as 1 regardless of min/max', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, priceMin: 0, priceMax: 1_000_000 };
    expect(countActiveFilters(f)).toBe(1);
  });
  it('counts open-ended price as 1', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, priceMin: 50_000_000 };
    expect(countActiveFilters(f)).toBe(1);
  });
  it('counts style entries separately', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, style: ['BRIDAL', 'JHUMKA'] };
    expect(countActiveFilters(f)).toBe(2);
  });
});

describe('findPriceBand', () => {
  it('returns undefined when both values are undefined', () => {
    expect(findPriceBand(undefined, undefined)).toBeUndefined();
  });
  it('finds the under-₹10K band', () => {
    expect(findPriceBand(0, 1_000_000)?.labelHi).toBe('₹10K तक');
  });
  it('finds the ₹10K–₹25K band', () => {
    expect(findPriceBand(1_000_000, 2_500_000)?.labelHi).toBe('₹10K–₹25K');
  });
  it('finds the open-ended top band (no max)', () => {
    const band = findPriceBand(50_000_000, undefined);
    expect(band?.labelHi).toBe('₹5L से ऊपर');
  });
  it('returns undefined for non-existent custom range', () => {
    expect(findPriceBand(123, 456)).toBeUndefined();
  });
});

describe('activeFilterChips', () => {
  it('returns empty array for empty filters', () => {
    expect(activeFilterChips(EMPTY_FILTERS)).toHaveLength(0);
  });
  it('includes metal chip with Hindi label', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, metal: 'GOLD' };
    const chips = activeFilterChips(f);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.labelHi).toBe('सोना');
    expect(chips[0]?.key).toBe('metal:GOLD');
  });
  it('includes one chip per purity', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, purity: ['GOLD_22K', 'SILVER_999'] };
    const chips = activeFilterChips(f);
    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.labelHi)).toContain('सोना 22K');
    expect(chips.map((c) => c.labelHi)).toContain('चाँदी 999');
  });
  it('includes price band chip', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, priceMin: 2_500_000, priceMax: 5_000_000 };
    const chips = activeFilterChips(f);
    expect(chips[0]?.labelHi).toBe('₹25K–₹50K');
    expect(chips[0]?.key).toBe('price');
  });
  it('includes inStock chip', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, inStockOnly: true };
    expect(activeFilterChips(f)[0]?.labelHi).toBe('उपलब्ध');
  });
});

describe('removeFilterChip', () => {
  it('removes metal', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, metal: 'GOLD' };
    expect(removeFilterChip(f, 'metal:GOLD').metal).toBeUndefined();
  });
  it('removes one purity while keeping others', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, purity: ['GOLD_22K', 'GOLD_24K'] };
    const result = removeFilterChip(f, 'purity:GOLD_22K');
    expect(result.purity).toEqual(['GOLD_24K']);
  });
  it('clears both priceMin and priceMax on price chip removal', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, priceMin: 0, priceMax: 1_000_000 };
    const result = removeFilterChip(f, 'price');
    expect(result.priceMin).toBeUndefined();
    expect(result.priceMax).toBeUndefined();
  });
  it('removes inStock', () => {
    const f: ActiveFilters = { ...EMPTY_FILTERS, inStockOnly: true };
    expect(removeFilterChip(f, 'inStock').inStockOnly).toBe(false);
  });
  it('ignores unknown chip key', () => {
    expect(removeFilterChip(EMPTY_FILTERS, 'unknown:xyz')).toEqual(EMPTY_FILTERS);
  });
});
