export function buildThemeStyle(primaryColor: string): React.CSSProperties {
  return {
    ['--primary-color' as string]: primaryColor,
  } as React.CSSProperties;
}

export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

export const PURITY_LABELS: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};

export function metalLabel(metal: string): string {
  return METAL_LABELS[metal] ?? metal;
}

export function purityLabel(purity: string): string {
  const metalKey = purity.split('_')[0] ?? '';
  const metal = METAL_LABELS[metalKey] ?? '';
  const k = PURITY_LABELS[purity] ?? purity;
  return metal ? `${metal} ${k}` : k;
}
