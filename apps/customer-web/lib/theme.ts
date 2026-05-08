import type React from 'react';

export { METAL_LABELS, PURITY_LABELS, metalLabel, purityLabel } from '@goldsmith/customer-shared';

const BG  = '#F5EDDD';
const INK = '#1E2440';

function hexToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * hexToLinear(r) + 0.7152 * hexToLinear(g) + 0.0722 * hexToLinear(b);
}

export function wcagContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function buildThemeStyle(primaryColor: string): React.CSSProperties {
  // For text rendered ON a primary-colored surface (e.g. CTA button):
  // use white if white has ≥ 4.5:1 contrast against primary, else fall to ink.
  const whiteOnPrimary = wcagContrastRatio('#FFFFFF', primaryColor);
  const primaryFg = whiteOnPrimary >= 4.5 ? '#FFFFFF' : INK;

  // For text rendered in primary color ON the cream canvas (e.g. nav active link):
  // use primary as-is if it has ≥ 4.5:1 contrast against bg, else fall to ink.
  const primaryOnBg = wcagContrastRatio(primaryColor, BG);
  const onPrimary = primaryOnBg >= 4.5 ? primaryColor : INK;

  return {
    ['--color-primary' as string]:    primaryColor,
    ['--color-primary-fg' as string]: primaryFg,
    ['--color-accent' as string]:     '#D4745A',
    ['--color-on-primary' as string]: onPrimary,
  } as React.CSSProperties;
}
