export function normalizeGstin(gstin: string): string {
  return gstin.toUpperCase().replace(/\s+/g, '');
}

export function validateGstinFormat(gstin: string): boolean {
  const normalized = normalizeGstin(gstin);

  // 1. Length exactly 15 chars
  if (normalized.length !== 15) {
    return false;
  }

  // 2. Position 0-1 (chars 1-2): state code — numeric string '01'-'38'
  const stateCode = normalized.slice(0, 2);
  const stateNum = parseInt(stateCode, 10);
  if (stateNum < 1 || stateNum > 38) {
    return false;
  }

  // 3. Position 2-11 (chars 3-12): embedded PAN — must match /^[A-Z]{5}[0-9]{4}[A-Z]$/
  const pan = normalized.slice(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(pan)) {
    return false;
  }

  // 4. Position 12 (char 13): entity number — one of '1'-'9' or 'A'-'Z'
  const entityChar = normalized[12];
  if (!/^[1-9A-Z]$/.test(entityChar)) {
    return false;
  }

  // 5. Position 13 (char 14): always 'Z'
  if (normalized[13] !== 'Z') {
    return false;
  }

  // 6. Position 14 (char 15): checksum
  return validateGstinChecksum(normalized);
}

function validateGstinChecksum(gstin: string): boolean {
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let factor = 2;
  let sum = 0;

  for (const ch of gstin.slice(0, 14)) {
    const product = factor * CHARS.indexOf(ch);
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }

  const check = (36 - (sum % 36)) % 36;
  return gstin[14] === CHARS[check];
}

export function getStateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}
