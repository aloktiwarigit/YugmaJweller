import { ComplianceHardBlockError } from '../errors';

export const RESTRICTION_269SS_THRESHOLD_PAISE = 2_000_000n; // Rs 20,000 × 100

export type CashRestrictionType = 'advance' | 'deposit' | 'repayment';

// Section 269SS: prohibits accepting any loan/deposit/advance in cash ≥ Rs 20,000.
// Section 269T: prohibits repaying any loan/deposit in cash ≥ Rs 20,000.
// Both sections share the same Rs 20,000 threshold — use type to distinguish.
// Penalty = 100% of the prohibited amount. No supervisor override permitted.
export function enforce269ss(amountPaise: bigint, type: CashRestrictionType): void {
  if (amountPaise >= RESTRICTION_269SS_THRESHOLD_PAISE) {
    throw new ComplianceHardBlockError('compliance.section_269ss', {
      code:           'SECTION_269SS',
      type,
      amountPaise:    amountPaise.toString(),
      thresholdPaise: RESTRICTION_269SS_THRESHOLD_PAISE.toString(),
    });
  }
}
