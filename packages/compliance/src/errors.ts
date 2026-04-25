/**
 * Thrown by compliance gates when a request must be hard-blocked.
 * The global exception filter maps this to 422 Unprocessable Entity
 * with body { code, ...meta } so clients get a stable error contract.
 *
 * `code` is one of the `compliance.*` keys defined per gate
 * (e.g. `compliance.huid_missing`, `compliance.cash_269st_exceeded`).
 */
export class ComplianceHardBlockError extends Error {
  constructor(
    public readonly code: string,
    public readonly meta: Record<string, unknown> = {},
  ) {
    super(`Compliance hard-block: ${code}`);
    this.name = 'ComplianceHardBlockError';
    // Preserve prototype across transpile to ES5 (instanceof checks survive Vitest pool boundaries)
    Object.setPrototypeOf(this, ComplianceHardBlockError.prototype);
  }
}
