import { describe, expect, it } from 'vitest';
import { generateInvoiceNumber } from './invoice-number';

describe('generateInvoiceNumber', () => {
  const SHOP = '0a1b2c3d-4e5f-4000-8000-000000000000';
  const DATE = new Date('2026-04-25T13:30:00Z');

  it('matches the GS-{6}-{YYYYMMDD}-{6} pattern', () => {
    const n = generateInvoiceNumber(SHOP, DATE);
    expect(n).toMatch(/^GS-[A-Z0-9]{6}-20260425-[A-Z0-9]{6}$/);
  });

  it('embeds the first 6 hex chars of the shop UUID (uppercased, dashes stripped)', () => {
    const n = generateInvoiceNumber(SHOP, DATE);
    expect(n).toMatch(/^GS-0A1B2C-/);
  });

  it('formats the date as YYYYMMDD in UTC', () => {
    // 2026-04-25T23:50:00Z is still 25 April UTC
    const n = generateInvoiceNumber(SHOP, new Date('2026-04-25T23:50:00Z'));
    expect(n).toContain('-20260425-');
  });

  it('is unique across 10000 invocations for the same shop+date', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateInvoiceNumber(SHOP, DATE));
    expect(set.size).toBe(10_000);
  });

  it('throws on a malformed shop UUID', () => {
    expect(() => generateInvoiceNumber('not-a-uuid', DATE)).toThrow();
  });
});
