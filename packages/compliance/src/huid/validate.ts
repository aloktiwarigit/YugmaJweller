const HUID_RE = /^[A-Z0-9]{6}$/;
const HUID_ERROR = 'HUID must be 6 uppercase alphanumeric characters';

export function validateHuidFormat(huid: string): { valid: boolean; error?: string } {
  const upper = huid.toUpperCase();
  if (!HUID_RE.test(upper)) {
    return { valid: false, error: HUID_ERROR };
  }
  return { valid: true };
}
