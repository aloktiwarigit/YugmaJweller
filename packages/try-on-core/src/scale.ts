import type { Landmark } from './types';

export const DEFAULT_IPD_MM = 63;
export const DEFAULT_FINGER_WIDTH_MM = 9;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normPerMmFace(
  leftIris: Landmark,
  rightIris: Landmark,
  ipdMm: number = DEFAULT_IPD_MM,
): number {
  return dist(leftIris, rightIris) / ipdMm;
}

export function normPerMmHand(
  edgeA: Landmark,
  edgeB: Landmark,
  fingerWidthMm: number = DEFAULT_FINGER_WIDTH_MM,
): number {
  return dist(edgeA, edgeB) / fingerWidthMm;
}
