import Decimal from 'decimal.js';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceInput } from '@goldsmith/money';

const GST_METAL_BP  = 300n;
const GST_MAKING_BP = 500n;

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
