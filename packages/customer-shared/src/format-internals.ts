// Private shared constants — not exported from the package barrel.
// Used by format.ts and catalog-filters.ts to avoid duplication.

export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

// PURITY_LABELS is also re-exported from catalog-filters.ts as a public constant.
export const PURITY_LABELS: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};
