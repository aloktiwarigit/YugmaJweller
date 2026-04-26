import { ComplianceHardBlockError } from '../errors';

export const SECTION_269ST_LIMIT_PAISE = 19_999_900n; // Rs 1,99,999 × 100 paise

export interface CashCapCheckInput {
  shopId:             string;
  customerId:         string | null;
  customerPhone:      string | null;
  cashAmountPaise:    bigint; // the NEW cash amount being added in this transaction
  existingDailyPaise: bigint; // from pmla_aggregates for today (IST)
}

// Call BEFORE recording the payment. Throws if the projected daily cash total
// would exceed the Section 269ST limit of Rs 1,99,999.
export function enforce269ST(input: CashCapCheckInput): void {
  const projected = input.existingDailyPaise + input.cashAmountPaise;
  if (projected <= SECTION_269ST_LIMIT_PAISE) return;

  const remaining = SECTION_269ST_LIMIT_PAISE - input.existingDailyPaise;
  throw new ComplianceHardBlockError('compliance.cash_cap_exceeded', {
    projectedPaise:         projected.toString(),
    limitPaise:             SECTION_269ST_LIMIT_PAISE.toString(),
    allowedRemainingPaise:  (remaining < 0n ? 0n : remaining).toString(),
  });
}

export interface OverrideInput {
  role:          string; // must be 'shop_admin' or 'shop_manager'
  justification: string; // min 10 chars (trimmed)
}

export interface CashCapOverride {
  type:              '269ST';
  overriddenAt:      string; // ISO timestamp
  overrideActorRole: string;
  justification:     string;
  projectedPaise:    string;
  limitPaise:        string;
}

// Validates that the actor has override authority and the justification is substantive.
// Returns override metadata to store in compliance_overrides_jsonb on the invoice.
// Does NOT bypass the hard-block automatically — caller must explicitly choose to proceed.
export function buildCashCapOverride(
  input: OverrideInput,
  projected: bigint,
): CashCapOverride {
  if (input.role !== 'shop_admin' && input.role !== 'shop_manager') {
    throw new ComplianceHardBlockError('compliance.override.role_required', {
      role:          input.role,
      requiredRoles: ['shop_admin', 'shop_manager'],
    });
  }

  const trimmed = input.justification?.trim() ?? '';
  if (trimmed.length < 10) {
    throw new ComplianceHardBlockError('compliance.override.justification_too_short', {
      minLength: 10,
      provided:  trimmed.length,
    });
  }

  return {
    type:              '269ST',
    overriddenAt:      new Date().toISOString(),
    overrideActorRole: input.role,
    justification:     trimmed,
    projectedPaise:    projected.toString(),
    limitPaise:        SECTION_269ST_LIMIT_PAISE.toString(),
  };
}
