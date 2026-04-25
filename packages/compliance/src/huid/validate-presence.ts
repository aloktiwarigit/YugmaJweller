import { ComplianceHardBlockError } from '../errors';

export interface HuidPresenceLine {
  /** 0-based index in the request — surfaced back to the client. */
  lineIndex: number;
  /** HUID supplied on the request line (null/undefined if omitted by client). */
  huid: string | null | undefined;
  /**
   * The HUID stored on the product row at write time.
   * Non-null means the product is hallmarked — the line MUST carry a HUID.
   * Null means the product is not hallmarked — the line is unconstrained.
   *
   * For manual lines (no productId), pass `null`. The hallmarked-vs-not
   * decision is the product's, not the request's; clients can never
   * bypass the gate by omitting fields.
   */
  productHuidOnRecord: string | null;
}

/**
 * Hard-blocks invoice creation when any line targets a hallmarked product
 * but does not supply a HUID. Throws ComplianceHardBlockError with the
 * first failing lineIndex so the UI can highlight the bad line.
 *
 * Pure function — no DB, no network, no logging side-effects. Call BEFORE
 * any DB write in the billing service so a doomed transaction never opens.
 */
export function validateHuidPresence(lines: HuidPresenceLine[]): void {
  for (const line of lines) {
    if (line.productHuidOnRecord === null) continue; // not hallmarked
    const trimmed = (line.huid ?? '').trim();
    if (trimmed.length === 0) {
      throw new ComplianceHardBlockError('compliance.huid_missing', {
        lineIndex: line.lineIndex,
      });
    }
  }
}
