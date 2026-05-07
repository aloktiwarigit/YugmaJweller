import type React from 'react';

export { METAL_LABELS, PURITY_LABELS, metalLabel, purityLabel } from '@goldsmith/customer-shared';

export function buildThemeStyle(primaryColor: string): React.CSSProperties {
  return {
    ['--primary-color' as string]: primaryColor,
  } as React.CSSProperties;
}
