import Decimal from 'decimal.js';
import { applyGstSplit } from '@goldsmith/compliance';

export interface PriceInput {
  netWeightG:        string;  // DECIMAL(12,4) string — e.g. "10.0000"
  ratePerGramPaise:  bigint;  // from pricing service
  makingChargePct:   string;  // DECIMAL(5,2) string — e.g. "12.00"
  stoneChargesPaise: bigint;  // may be 0n
  hallmarkFeePaise:  bigint;  // may be 0n (non-hallmarked pieces)
}

export interface PriceBreakdown {
  goldValuePaise:    bigint;
  makingChargePaise: bigint;
  stoneChargesPaise: bigint;
  gstMetalPaise:     bigint;
  gstMakingPaise:    bigint;
  hallmarkFeePaise:  bigint;
  totalPaise:        bigint;
  // Display helpers — pre-formatted, never use for arithmetic
  totalRupees:       string;  // e.g. "84,138.52"
  totalFormatted:    string;  // e.g. "₹84,138.52"
}

function validateInputs(input: PriceInput): void {
  let weightDecimal: Decimal;
  try {
    weightDecimal = new Decimal(input.netWeightG);
  } catch {
    throw new RangeError('netWeightG must be a valid positive decimal string');
  }
  if (weightDecimal.isNaN() || !weightDecimal.isFinite() || weightDecimal.lte(0)) {
    throw new RangeError('netWeightG must be a positive finite number');
  }

  if (input.ratePerGramPaise <= 0n) {
    throw new RangeError('ratePerGramPaise must be > 0');
  }

  let makingPct: Decimal;
  try {
    makingPct = new Decimal(input.makingChargePct);
  } catch {
    throw new RangeError('makingChargePct must be a valid decimal string');
  }
  if (makingPct.isNaN() || !makingPct.isFinite() || makingPct.lt(0) || makingPct.gt(100)) {
    throw new RangeError('makingChargePct must be between 0.00 and 100.00');
  }

  if (input.stoneChargesPaise < 0n) {
    throw new RangeError('stoneChargesPaise must be >= 0');
  }
  if (input.hallmarkFeePaise < 0n) {
    throw new RangeError('hallmarkFeePaise must be >= 0');
  }
}

export function computeProductPrice(input: PriceInput): PriceBreakdown {
  validateInputs(input);

  // Step 1: gold value — floor via ROUND_FLOOR on the Decimal result, then BigInt
  const goldValuePaise = BigInt(
    new Decimal(input.ratePerGramPaise.toString())
      .mul(new Decimal(input.netWeightG))
      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
      .toString(),
  );

  // Step 2: making charge — floor
  const makingChargePaise = BigInt(
    new Decimal(goldValuePaise.toString())
      .mul(new Decimal(input.makingChargePct))
      .div(100)
      .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
      .toString(),
  );

  // Step 3 + 4: GST split — pure BigInt arithmetic (integer division = floor)
  const { metalGstPaise, makingGstPaise } = applyGstSplit({
    goldValuePaise,
    makingChargePaise,
  });

  // Step 5: total
  const totalPaise =
    goldValuePaise +
    makingChargePaise +
    input.stoneChargesPaise +
    metalGstPaise +
    makingGstPaise +
    input.hallmarkFeePaise;

  // Display-only conversion — safe up to ~900 trillion paise (₹9 trillion)
  const totalRupees = (Number(totalPaise) / 100).toLocaleString('hi-IN', {
    minimumFractionDigits: 2,
  });

  return {
    goldValuePaise,
    makingChargePaise,
    stoneChargesPaise: input.stoneChargesPaise,
    gstMetalPaise:     metalGstPaise,
    gstMakingPaise:    makingGstPaise,
    hallmarkFeePaise:  input.hallmarkFeePaise,
    totalPaise,
    totalRupees,
    totalFormatted: `₹${totalRupees}`,
  };
}
