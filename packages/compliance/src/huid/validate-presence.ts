import { ComplianceHardBlockError } from '../errors';
import { HuidExemptionCategory, isHuidExempt } from './huid-exemption';

export interface HuidPresenceLine {
  lineIndex: number;
  huid: string | null | undefined;
  /**
   * The HUID stored on the product row at write time.
   * Non-null means the product is hallmarked — the line MUST carry a HUID
   * unless the product has an exemption category.
   * Null means the product is not hallmarked — unconstrained.
   * For manual lines (no productId), pass `null`.
   */
  productHuidOnRecord: string | null;
  /**
   * BIS exemption category. Exempt products bypass the HUID check entirely.
   * Defaults to 'none' when omitted (backward compatible).
   */
  huidExemptionCategory?: HuidExemptionCategory;
}

/**
 * Hard-blocks invoice creation when any line targets a hallmarked, non-exempt
 * product but does not supply a HUID. Pure function — no DB, no network.
 * Call BEFORE any DB write in the billing service.
 */
export function validateHuidPresence(lines: HuidPresenceLine[]): void {
  for (const line of lines) {
    const exemption = line.huidExemptionCategory ?? HuidExemptionCategory.None;
    if (isHuidExempt(exemption)) continue;
    if (line.productHuidOnRecord === null) continue;
    const trimmed = (line.huid ?? '').trim();
    if (trimmed.length === 0) {
      throw new ComplianceHardBlockError('compliance.huid_missing', {
        lineIndex: line.lineIndex,
      });
    }
  }
}
