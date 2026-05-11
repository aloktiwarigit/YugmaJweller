import { METAL_LABELS, PURITY_LABELS } from './format-internals';

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function productDisplayName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
}): string {
  const metal    = METAL_LABELS[product.metal] ?? product.metal;
  const purity   = PURITY_LABELS[product.purity] ?? product.purity;
  const category = product.categoryName ?? product.sku;
  return `${purity} ${metal} ${category}`;
}
