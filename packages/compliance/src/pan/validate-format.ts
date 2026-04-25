// PAN format: AAAAA9999A — 5 uppercase alpha, 4 numeric, 1 uppercase alpha (no checksum)
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(pan: string): string {
  return pan.toUpperCase().replace(/\s+/g, '');
}

export function validatePanFormat(pan: string): boolean {
  return PAN_RE.test(normalizePan(pan));
}
