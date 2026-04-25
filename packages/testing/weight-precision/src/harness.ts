import Decimal from 'decimal.js';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceInput } from '@goldsmith/money';

const GST_METAL_BP  = 300n;
const GST_MAKING_BP = 500n;

// ---------------------------------------------------------------------------
// Invoice harness types
// ---------------------------------------------------------------------------

type InvoiceHarnessLine = PriceInput;

interface InvoiceGoldenTotals {
  subtotalPaise:   bigint;
  gstMetalPaise:   bigint;
  gstMakingPaise:  bigint;
  totalPaise:      bigint;
}

export interface HarnessResult {
  total:    number;
  passed:   number;
  failed:   number;
  failures: Array<{ input: PriceInput; expected: bigint; actual: bigint }>;
}

/**
 * Independent Decimal.js golden reference.
 * Replicates the formula using ROUND_FLOOR at every step — same as computeProductPrice.
 * Used to cross-validate BigInt arithmetic in pricing.ts across 10,000 random inputs.
 */
function goldenTotal(input: PriceInput): bigint {
  const goldValuePaise = BigInt(
    new Decimal(input.ratePerGramPaise.toString())
      .mul(new Decimal(input.netWeightG))
      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
      .toString(),
  );

  const makingChargePaise = BigInt(
    new Decimal(goldValuePaise.toString())
      .mul(new Decimal(input.makingChargePct))
      .div(100)
      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
      .toString(),
  );

  const metalGstPaise  = (goldValuePaise    * GST_METAL_BP)  / 10000n;
  const makingGstPaise = (makingChargePaise * GST_MAKING_BP) / 10000n;

  return goldValuePaise + makingChargePaise + input.stoneChargesPaise + metalGstPaise + makingGstPaise + input.hallmarkFeePaise;
}

function randomDecimal(lo: number, hi: number, decimals: number): string {
  const range = hi - lo;
  const raw   = lo + Math.random() * range;
  return raw.toFixed(decimals);
}

function randomBigIntRange(lo: bigint, hi: bigint): bigint {
  const range = Number(hi - lo);
  return lo + BigInt(Math.floor(Math.random() * range));
}

export async function runWeightPrecisionHarness(): Promise<HarnessResult> {
  const TOTAL = 10_000;
  const failures: HarnessResult['failures'] = [];

  for (let i = 0; i < TOTAL; i++) {
    const netWeightG       = randomDecimal(0.0001, 999.9999, 4);
    const ratePerGramPaise = randomBigIntRange(100_000n, 1_000_000n);
    const makingChargePct  = randomDecimal(0, 25, 2);
    const stoneChargesPaise = randomBigIntRange(0n, 10_000_000n);
    const hallmarkFeePaise  = Math.random() < 0.5 ? 0n : 4_500n;

    const input: PriceInput = {
      netWeightG,
      ratePerGramPaise,
      makingChargePct,
      stoneChargesPaise,
      hallmarkFeePaise,
    };

    const expected = goldenTotal(input);
    const actual   = computeProductPrice(input).totalPaise;

    if (actual !== expected) {
      failures.push({ input, expected, actual });
    }
  }

  return {
    total:  TOTAL,
    passed: TOTAL - failures.length,
    failed: failures.length,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Invoice harness — 10,000 multi-line invoices
// ---------------------------------------------------------------------------

/**
 * Independent Decimal.js golden reference for a multi-line invoice.
 * Sums each line's totals using the same paise-floor arithmetic as computeProductPrice.
 */
function goldenInvoice(lines: InvoiceHarnessLine[]): InvoiceGoldenTotals {
  let subtotalPaise  = 0n;
  let gstMetalPaise  = 0n;
  let gstMakingPaise = 0n;
  let totalPaise     = 0n;

  for (const ln of lines) {
    const goldValuePaise = BigInt(
      new Decimal(ln.ratePerGramPaise.toString())
        .mul(new Decimal(ln.netWeightG))
        .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
        .toString(),
    );

    const makingChargePaise = BigInt(
      new Decimal(goldValuePaise.toString())
        .mul(new Decimal(ln.makingChargePct))
        .div(100)
        .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
        .toString(),
    );

    const lineMetalGst  = (goldValuePaise    * GST_METAL_BP)  / 10000n;
    const lineMakingGst = (makingChargePaise * GST_MAKING_BP) / 10000n;

    subtotalPaise  += goldValuePaise + makingChargePaise + ln.stoneChargesPaise + ln.hallmarkFeePaise;
    gstMetalPaise  += lineMetalGst;
    gstMakingPaise += lineMakingGst;
    totalPaise     += goldValuePaise + makingChargePaise + ln.stoneChargesPaise + lineMetalGst + lineMakingGst + ln.hallmarkFeePaise;
  }

  return { subtotalPaise, gstMetalPaise, gstMakingPaise, totalPaise };
}

/**
 * Generates 10,000 random multi-line invoices (1-5 lines each) and cross-validates
 * the summed computeProductPrice().totalPaise against an independent Decimal.js golden.
 * Zero failures are tolerated — any divergence is a pricing bug.
 */
export async function runInvoiceWeightPrecisionHarness(): Promise<HarnessResult> {
  const TOTAL = 10_000;
  const failures: HarnessResult['failures'] = [];

  for (let i = 0; i < TOTAL; i++) {
    const lineCount = 1 + Math.floor(Math.random() * 5);
    const lines: InvoiceHarnessLine[] = [];

    for (let j = 0; j < lineCount; j++) {
      lines.push({
        netWeightG:        randomDecimal(0.0001, 999.9999, 4),
        ratePerGramPaise:  randomBigIntRange(100_000n, 1_000_000n),
        makingChargePct:   randomDecimal(0, 25, 2),
        stoneChargesPaise: randomBigIntRange(0n, 10_000_000n),
        hallmarkFeePaise:  Math.random() < 0.5 ? 0n : 4_500n,
      });
    }

    const golden = goldenInvoice(lines);
    let actualTotal = 0n;
    for (const ln of lines) {
      actualTotal += computeProductPrice(ln).totalPaise;
    }

    if (actualTotal !== golden.totalPaise) {
      // Record the first line as a representative sample for diagnosis
      failures.push({ input: lines[0]!, expected: golden.totalPaise, actual: actualTotal });
    }
  }

  return {
    total:  TOTAL,
    passed: TOTAL - failures.length,
    failed: failures.length,
    failures,
  };
}
