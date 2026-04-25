import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Static-analysis gate: BillingService.createInvoice MUST call
 * validateHuidPresence and the per-line price computation MUST go through
 * computeProductPrice (which internally calls applyGstSplit). If the source
 * ever loses these calls, this test fails — defense against accidental
 * compliance-gate removal during refactors.
 */
describe('BillingService compliance-gate static checks', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/modules/billing/billing.service.ts'),
    'utf8',
  );

  it('imports validateHuidPresence from @goldsmith/compliance', () => {
    expect(src).toMatch(/import\s*\{[^}]*validateHuidPresence[^}]*\}\s*from\s*['"]@goldsmith\/compliance['"]/);
  });

  it('calls validateHuidPresence before any DB write', () => {
    const idxValidate = src.indexOf('validateHuidPresence(');
    const idxInsert   = src.indexOf('this.repo.insertInvoice(');
    expect(idxValidate).toBeGreaterThan(-1);
    expect(idxInsert).toBeGreaterThan(-1);
    expect(idxValidate).toBeLessThan(idxInsert);
  });

  it('imports computeProductPrice from @goldsmith/money', () => {
    expect(src).toMatch(/import\s*\{[^}]*computeProductPrice[^}]*\}\s*from\s*['"]@goldsmith\/money['"]/);
  });

  it('does not import applyGstSplit directly (must flow through computeProductPrice)', () => {
    // applyGstSplit is the lower-level primitive; routing through computeProductPrice
    // ensures the invoice path can never diverge from the catalog/product price path.
    expect(src).not.toMatch(/import\s*\{[^}]*applyGstSplit/);
  });

  it('does not accept any *Paise field from request DTOs (server-authoritative pricing)', () => {
    // Controller passes the Zod-validated DTO; the DTO must NOT contain any
    // gold_value / line_total / etc. fields. Search for forbidden field references.
    expect(src).not.toMatch(/dto\.\w*lineTotal/i);
    expect(src).not.toMatch(/dto\.\w*goldValue/i);
    expect(src).not.toMatch(/input\.\w*lineTotal/i);
    expect(src).not.toMatch(/input\.\w*goldValue/i);
  });
});
