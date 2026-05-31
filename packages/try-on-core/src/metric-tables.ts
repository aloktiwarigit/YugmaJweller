export const RING_DIAMETER_MM: Record<number, number> = {
  1: 12.1, 2: 12.6, 3: 13.0, 4: 13.4, 5: 13.8, 6: 14.3, 7: 14.7, 8: 15.1,
  9: 15.6, 10: 16.0, 11: 16.4, 12: 16.8, 13: 17.3, 14: 17.7, 15: 18.1,
  16: 18.5, 17: 19.0, 18: 19.4, 19: 19.8, 20: 20.2,
};

export const BANGLE_DIAMETER_MM: Record<string, number> = {
  XS: 54, S: 56, M: 58, L: 60, XL: 62, XXL: 64,
};

export function ringDiameterForIndianSize(size: number): number | undefined {
  return RING_DIAMETER_MM[size];
}

export function nearestBangleSize(diameterMm: number): string {
  let best = '';
  let bestDelta = Infinity;
  for (const [label, dia] of Object.entries(BANGLE_DIAMETER_MM)) {
    const delta = Math.abs(dia - diameterMm);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = label;
    }
  }
  return best;
}
