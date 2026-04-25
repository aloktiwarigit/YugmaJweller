import { ComplianceHardBlockError } from '../errors';

export const PAN_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000 × 100 paise

export interface PanEnforcementInput {
  totalPaise:  bigint;
  pan:         string | null | undefined;
  form60Data:  Record<string, unknown> | null | undefined;
}

// Call BEFORE any DB write in the billing service.
// Throws if total >= threshold AND neither PAN nor Form 60 is provided.
export function enforcePanRequired(input: PanEnforcementInput): void {
  if (input.totalPaise < PAN_THRESHOLD_PAISE) return;
  if (input.pan != null && String(input.pan).trim().length > 0) return;
  if (input.form60Data != null && typeof input.form60Data === 'object') return;
  throw new ComplianceHardBlockError('compliance.pan_required', {
    totalPaise:     input.totalPaise.toString(),
    thresholdPaise: PAN_THRESHOLD_PAISE.toString(),
  });
}

const FORM60_REQUIRED_FIELDS: ReadonlyArray<string> = [
  'name',
  'address',
  'reasonForNoPan',
  'estimatedAnnualIncomePaise',
];

export function validateForm60(data: Record<string, unknown>): void {
  const missing = FORM60_REQUIRED_FIELDS.filter((f) => {
    const v = data[f];
    return v == null || String(v).trim().length === 0;
  });
  if (missing.length > 0) {
    throw new ComplianceHardBlockError('compliance.form60_incomplete', { missingFields: missing });
  }
}
