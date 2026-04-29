# 0003 — Money + Weight Primitives: DECIMAL-Only, Never FLOAT

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Murat (Test Architect)
**Consulted:** Alok (Agency non-negotiables), Mary (BA on compliance precision)

## Context

Gold jewellery retail operates at **paise-level precision over tens of thousands of transactions**. The anchor will process 500+ invoices/day at steady state; a single FLOAT rounding error compounds to material discrepancies. PRD NFR (weight-precision math) + Agency Delivery non-negotiables require:

- `DECIMAL(12,4)` grams for weights; never FLOAT/REAL.
- `BIGINT` paise (or `DECIMAL(18,2)` rupees) for money; never FLOAT.
- GST split (3% metal + 5% making) must round correctly.
- 10,000-transaction synthetic harness must validate paise-exact correctness.

JavaScript's native `number` type (IEEE 754 float) is insufficient. Arithmetic in the frontend, backend, and mobile app must all be consistent.

## Decision

Create `packages/money` with wrapped types:

**`MoneyInPaise` (backend):**
- Storage: `BIGINT` column in Postgres (range covers ~10^10 rupees = ~Rs 10 billion, sufficient).
- Runtime: native JS `bigint` in TS; all arithmetic via helper functions.
- Formatting: Indian grouping (`₹ 1,99,999.00`) via locale formatter.

**`MoneyInPaise` (frontend + mobile):**
- Wire format: JSON integer (paise).
- Runtime: `bigint` in browser (Safari 15+, Chrome 100+, Firefox 100+ all support).
- Mobile (RN Hermes): `bigint` supported since Hermes 0.12.

**`Weight` (grams):**
- Storage: `NUMERIC(12,4)` column — allows up to 99,999,999.9999 grams (99,999 kg; more than enough).
- Runtime: `decimal.js` instance (no floats in the call path).
- Wire format: stringified decimal `"12.3456"` to preserve precision across JSON number limitations.

**`Purity`:**
- `enum` TS type with values `GOLD_24K`, `GOLD_22K`, `GOLD_20K`, `GOLD_18K`, `GOLD_14K`, `SILVER_999`, `SILVER_925`, `PLATINUM_950`, etc.
- Stored as `TEXT` with CHECK constraint in DB.

**Rounding rules (deterministic, documented):**
- GST split: `metal_paise * 3 / 100` uses floor (truncation); `making_paise * 5 / 100` uses floor. Total GST is sum of those two floors (not `(metal+making)*8/100 - floor`).
- Weight rounding: always 4 decimal places (`NUMERIC(12,4)`); display uses 3 decimal places with the 4th as precision reserve.
- Price display: paise → rupees.paise rounding uses nearest (banker's rounding for display only; storage always full paise precision).

**10K-transaction harness:**
- `packages/testing/weight-precision` runs 10,000 synthetic invoices across all purities × making-charge combinations × GST splits.
- Asserts every total paise-exact against a golden reference (computed via `decimal.js` high-precision).
- Blocks CI on any variance ≥ 1 paise.

**Compile-time enforcement:**
- Semgrep rule forbids `number * number` arithmetic in files importing `packages/money` — must use `MoneyInPaise.add`, `MoneyInPaise.multiplyByBp` (basis points), etc.
- ESLint rule forbids `parseFloat` + `Number(...)` on money/weight strings.
- TypeScript branded types prevent accidentally passing a raw number where MoneyInPaise is expected.

## Consequences

**Positive:**
- Paise-exact arithmetic across 10K+ transactions (validated).
- Single definition of rounding rules (GST split + display) — no module re-implements.
- Type system catches most FLOAT misuse at compile time.
- Wire format is unambiguous — no "did they send paise or rupees?" confusion.

**Negative / trade-offs:**
- `bigint` on frontend requires explicit conversion to/from JSON (default JSON.stringify doesn't handle bigint).
- `decimal.js` for weight adds ~30 KB to bundle; acceptable given NFR-P8 budget of 250 KB.
- Developers unfamiliar with DECIMAL may try to bypass; Semgrep + code-review gate catches.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **FLOAT columns** | IEEE 754 rounding errors compound; explicitly banned by non-negotiables |
| **String-based money** | Arithmetic is painful; type system gives no guard; readability poor |
| **Native `number` with 2-decimal rounding** | Insufficient precision for weight (4-decimal grams); inconsistent rounding in JS float arithmetic |
| **Dinero.js** | Good library but heavier than our needs; we wrap our own thin layer over bigint + decimal.js |
| **Prisma Decimal** | Using Drizzle (not Prisma); Prisma's Decimal is also a wrapper over decimal.js anyway |

## Implementation Notes

```ts
// packages/money/src/money.ts
export type MoneyInPaise = bigint & { readonly __brand: 'MoneyInPaise' };

export const paise = (n: number | bigint): MoneyInPaise => BigInt(n) as MoneyInPaise;
export const rupees = (n: number | bigint): MoneyInPaise => paise(BigInt(n) * 100n);

export function add(a: MoneyInPaise, b: MoneyInPaise): MoneyInPaise {
  return (a + b) as MoneyInPaise;
}

export function multiplyByBp(a: MoneyInPaise, bp: number): MoneyInPaise {
  // floor(a * bp / 10000); used for GST 3% = 300 bp, 5% = 500 bp
  return ((a * BigInt(bp)) / 10000n) as MoneyInPaise;
}

export function formatInr(a: MoneyInPaise, locale: 'hi-IN' | 'en-IN' = 'hi-IN'): string {
  const rupees = Number(a / 100n);
  const paise = Number(a % 100n);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR' })
    .format(rupees + paise / 100);
}
```

```ts
// packages/money/src/weight.ts
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export class Weight {
  private constructor(private readonly grams: Decimal) {}

  static from(grams: string | number): Weight {
    return new Weight(new Decimal(grams));
  }

  toGramsString(decimalPlaces = 4): string {
    return this.grams.toFixed(decimalPlaces);
  }

  multiply(ratePerGram: MoneyInPaise): MoneyInPaise {
    // Decimal math then convert to paise
    const paiseD = this.grams.times(new Decimal(ratePerGram.toString()));
    return paise(BigInt(paiseD.round().toString()));
  }
}
```

## Revisit triggers

- Browser/Hermes bigint support regresses (very unlikely).
- Performance of decimal.js on weight-heavy reports becomes a bottleneck — optimize via memoization.
- New purity introduction (e.g., platinum tiers) — extend Purity enum.

## References

- PRD NFR (weight-precision math)
- Architecture §Core Decisions D8, §Patterns Money + weight primitives
- CLAUDE.md non-negotiable rule #2
