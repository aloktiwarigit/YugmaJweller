import type { BodyPart, DimensionsMm } from './types';

const DENSITY_G_PER_CM3: Record<string, number> = {
  'GOLD_24K': 19.32,
  'GOLD_22K': 17.7,
  'GOLD_18K': 15.4,
  'SILVER_999': 10.49,
  'PLATINUM': 21.45,
};

function densityFor(metal: string, purity: string): number {
  const key = `${metal}_${purity}`.toUpperCase();
  if (DENSITY_G_PER_CM3[key]) return DENSITY_G_PER_CM3[key];
  if (metal.toUpperCase() === 'GOLD') return DENSITY_G_PER_CM3['GOLD_22K'];
  if (metal.toUpperCase() === 'SILVER') return DENSITY_G_PER_CM3['SILVER_999'];
  if (metal.toUpperCase() === 'PLATINUM') return DENSITY_G_PER_CM3['PLATINUM'];
  return DENSITY_G_PER_CM3['GOLD_22K'];
}

export interface ProductSizeInput {
  dimensions: DimensionsMm;
  metal: string;
  purity: string;
  netWeightG: number;
}

export interface SizeResult {
  widthNorm: number;
  trueToSize: boolean;
}

export function estimateDiameterMmFromWeight(
  netWeightG: number,
  metal: string,
  purity: string,
): number {
  const density = densityFor(metal, purity);
  const volumeCm3 = netWeightG / density;
  const radiusCm = Math.cbrt((3 * volumeCm3) / (4 * Math.PI));
  return radiusCm * 2 * 10;
}

export function resolveAssetWidthNorm(
  input: ProductSizeInput,
  normPerMm: number,
  part: BodyPart,
): SizeResult {
  const d = input.dimensions;
  const preferDiameter = part === 'FINGER' || part === 'WRIST';

  const mm = preferDiameter
    ? d.diameterMm ?? d.widthMm ?? d.lengthMm
    : d.widthMm ?? d.lengthMm ?? d.diameterMm;

  if (mm && mm > 0) {
    return { widthNorm: mm * normPerMm, trueToSize: true };
  }

  const estMm = estimateDiameterMmFromWeight(input.netWeightG, input.metal, input.purity);
  return { widthNorm: estMm * normPerMm, trueToSize: false };
}
