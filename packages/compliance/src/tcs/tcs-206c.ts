export const TCS_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000 × 100 paise
export const TCS_RATE_BP = 100; // 1% expressed as basis points (100 bp = 1%)

// Section 206C(1D) of the Income Tax Act: sellers of jewellery must collect 1% TCS
// when the invoice total exceeds Rs 2,00,000 (cash or non-cash, any payment mode).
// Threshold is EXCLUSIVE: exactly Rs 2L incurs no TCS; Rs 2L + 1p does.
export function computeTcs(invoiceTotalPaise: bigint): bigint {
  if (invoiceTotalPaise <= TCS_THRESHOLD_PAISE) return 0n;
  return (invoiceTotalPaise * BigInt(TCS_RATE_BP)) / 10_000n;
}
