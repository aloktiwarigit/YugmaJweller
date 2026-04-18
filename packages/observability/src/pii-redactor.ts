const PII_KEYS = new Set([
  'phone', 'pan', 'email', 'aadhaar', 'dob',
  'address', 'customerName', 'ownerName', 'display_name',
  'gstin', 'bankAccount', 'ifsc', 'otp',
]);

export function redactPii<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((item) => redactPii(item)) as unknown as T;
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (PII_KEYS.has(k)) {
        out[k] = `[REDACTED:${k}]`;
      } else {
        out[k] = redactPii(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}
