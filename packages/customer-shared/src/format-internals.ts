// Private shared constants — not exported from the package barrel.
// Used by format.ts and catalog-filters.ts to avoid duplication.

export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

// Will also be re-exported as a public constant from catalog-filters.ts (Task 3).
export const PURITY_LABELS: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};
