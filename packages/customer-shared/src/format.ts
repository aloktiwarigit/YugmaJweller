import { METAL_LABELS, PURITY_LABELS } from './format-internals';

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const MERCH_NAME_STEMS = [
  'Aarohi',
  'Kashvi',
  'Naira',
  'Anika',
  'Ira',
  'Meera',
  'Tara',
  'Veda',
  'Avni',
  'Reva',
  'Ziya',
  'Kiara',
  'Saanvi',
  'Mira',
  'Aadhya',
] as const;

const STYLE_LABELS: Record<string, string> = {
  ENGAGEMENT: 'Engagement',
  COUPLE: 'Couple',
  DAILY_WEAR: 'Daily',
  JHUMKA: 'Jhumka',
  STUDS: 'Stud',
  HOOPS: 'Hoop',
  DROP: 'Drop',
  STATEMENT: 'Statement',
  TEMPLE: 'Temple',
  BRIDAL: 'Bridal',
  OFFICE: 'Office',
  KIDS: 'Kids',
};

function stableNameStem(sku: string): string {
  const score = Array.from(sku).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return MERCH_NAME_STEMS[score % MERCH_NAME_STEMS.length] ?? MERCH_NAME_STEMS[0];
}

function categoryMerchLabel(categoryName: string | null, metal: string): string {
  const normalized = categoryName?.trim().toLowerCase() ?? '';
  if (normalized.includes('bridal')) return 'Necklace Set';
  if (normalized.includes('mangalsutra')) return 'Mangalsutra';
  if (normalized.includes('bangle') || normalized.includes('चू')) return 'Bangle';
  if (normalized.includes('bracelet') || normalized.includes('कड़ा')) return 'Bracelet';
  if (normalized.includes('earring') || normalized.includes('झुम')) return 'Earring';
  if (normalized.includes('pendant') || normalized.includes('पेंड')) return 'Pendant';
  if (normalized.includes('chain') || normalized.includes('चेन')) return 'Chain';
  if (normalized.includes('necklace') || normalized.includes('हार')) return 'Necklace';
  if (normalized.includes('anklet') || normalized.includes('पायल')) return 'Anklet';
  if (normalized.includes('ring') || normalized.includes('अंग')) return 'Ring';
  if (metal === 'SILVER') return 'Silver Jewellery';
  return categoryName ?? 'Jewellery';
}

function materialMerchLabel(product: { metal: string; purity: string; categoryName: string | null }): string {
  const normalizedCategory = product.categoryName?.toLowerCase() ?? '';
  if (normalizedCategory.includes('diamond') || product.metal === 'DIAMOND') return 'Diamond';
  if (product.metal === 'SILVER') return 'Silver';
  if (product.metal === 'PLATINUM') return 'Platinum';
  if (product.purity.includes('18K')) return '18K Gold';
  if (product.purity.includes('22K')) return '22K Gold';
  if (product.purity.includes('24K')) return '24K Gold';
  return METAL_LABELS[product.metal] ?? product.metal;
}

function compactUniqueWords(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  return words
    .filter((word, index) => index === 0 || word.toLowerCase() !== words[index - 1]?.toLowerCase())
    .join(' ');
}

function demoMerchandisingName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
  style?:       string | null;
}): string | null {
  if (!product.sku.startsWith('DMO-')) return null;

  const stem = stableNameStem(product.sku);
  const material = materialMerchLabel(product);
  const style = product.style ? STYLE_LABELS[product.style] : undefined;
  const category = categoryMerchLabel(product.categoryName, product.metal);
  const stylePart = style && !category.toLowerCase().includes(style.toLowerCase()) ? `${style} ` : '';

  return compactUniqueWords(`${stem} ${material} ${stylePart}${category}`);
}

export function productDisplayName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
  displayName?: string | null;
  style?:       string | null;
}): string {
  if (product.displayName?.trim()) return product.displayName.trim();

  const demoName = demoMerchandisingName(product);
  if (demoName) return demoName;

  const metal    = METAL_LABELS[product.metal] ?? product.metal;
  const purity   = PURITY_LABELS[product.purity] ?? product.purity;
  const category = product.categoryName ?? product.sku;
  return `${purity} ${metal} ${category}`;
}

export function productSubtitle(product: {
  metal:        string;
  purity:       string;
  netWeightG?:  string | null;
  huid?:        string | null;
}): string {
  const purity = PURITY_LABELS[product.purity] ?? product.purity;
  const metal = METAL_LABELS[product.metal] ?? product.metal;
  const weightValue = product.netWeightG ? Number(product.netWeightG) : Number.NaN;
  const weight = Number.isFinite(weightValue) ? `${weightValue.toFixed(2)} g` : null;
  return [purity, metal, weight, product.huid ? 'BIS/HUID' : null].filter(Boolean).join(' | ');
}

export function productMerchBadges(product: {
  huid?:        string | null;
  quantity?:    number;
  publishedAt?: string;
  priceAvailable?: boolean;
}): string[] {
  const badges: string[] = [];
  if (product.huid) badges.push('HUID');
  if (product.priceAvailable) badges.push('Live price');
  if (product.quantity !== undefined && product.quantity > 0 && product.quantity <= 3) badges.push('Low stock');
  if (product.publishedAt) {
    const ageMs = Date.now() - new Date(product.publishedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 30 * 24 * 60 * 60 * 1000) badges.push('New');
  }
  return badges.slice(0, 3);
}
