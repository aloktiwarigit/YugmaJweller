export const PMLA_WARN_THRESHOLD_PAISE  = 80_000_000n;  // Rs 8,00,000
export const PMLA_BLOCK_THRESHOLD_PAISE = 100_000_000n; // Rs 10,00,000

export type PmlaThresholdStatus = 'ok' | 'warn' | 'block';

export function getPmlaThresholdStatus(cumulativePaise: bigint): PmlaThresholdStatus {
  if (cumulativePaise >= PMLA_BLOCK_THRESHOLD_PAISE) return 'block';
  if (cumulativePaise >= PMLA_WARN_THRESHOLD_PAISE)  return 'warn';
  return 'ok';
}
