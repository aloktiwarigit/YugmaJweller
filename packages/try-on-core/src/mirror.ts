export function mirrorXIfNeeded(x: number, mirrored: boolean): number {
  return mirrored ? 1 - x : x;
}

export function resolveEarSide(
  side: 'left' | 'right',
  mirrored: boolean,
): 'left' | 'right' {
  if (!mirrored) return side;
  return side === 'left' ? 'right' : 'left';
}
