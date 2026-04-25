export function normalizeGstin(gstin: string): string {
  return gstin.toUpperCase().replace(/\s+/g, '');
}

export function validateGstinFormat(gstin: string): boolean {
  const normalized = normalizeGstin(gstin);

  if (normalized.length !== 15) {
    return false;
  }

  const stateCode = normalized.slice(0, 2);
  if (!/^[0-9]{2}$/.test(stateCode)) {
    return false;
  }
  const stateNum = parseInt(stateCode, 10);
  if (stateNum < 1 || stateNum > 38) {
    return false;
  }

  const pan = normalized.slice(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(pan)) {
    return false;
  }

  const entityChar = normalized[12];
  if (!/^[1-9A-Z]$/.test(entityChar)) {
    return false;
  }

  if (normalized[13] !== 'Z') {
    return false;
  }

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
