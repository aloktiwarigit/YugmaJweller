export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s-]/g, '');
  if (stripped.length === 0) throw new Error('auth-client.invalid_phone');
  if (/^\+91\d{10}$/.test(stripped)) return stripped;
  if (/^\d{10}$/.test(stripped)) return `+91${stripped}`;
  throw new Error('auth-client.invalid_phone');
}
