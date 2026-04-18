const PII_KEYS = new Set([
  'phone', 'pan', 'email', 'aadhaar', 'dob',
  'address', 'customerName', 'ownerName', 'display_name',
  'gstin', 'bankAccount', 'ifsc', 'otp',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

export function redactPii<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    if (seen.has(input)) return '[Circular]' as unknown as T;
    seen.add(input);
    return input.map((item) => redactPii(item, seen)) as unknown as T;
  }
  if (isPlainObject(input)) {
    if (seen.has(input)) return '[Circular]' as unknown as T;
    seen.add(input);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = PII_KEYS.has(k) ? `[REDACTED:${k}]` : redactPii(v, seen);
    }
    return out as unknown as T;
  }
  // Error, Date, Buffer, class instances, Map, Set, Symbol — preserve as-is.
  return input;
}
