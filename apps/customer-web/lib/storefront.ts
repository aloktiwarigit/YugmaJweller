import type { CatalogProduct, TenantConfigResponse } from '@/lib/api';
import { metalLabel, purityLabel } from '@/lib/theme';

export const STATIC_STOREFRONT_ROUTES = [
  '/',
  '/products',
  '/wishlist',
  '/try-at-home',
  '/rate-lock',
  '/loyalty',
  '/return-policy',
  '/shipping-policy',
  '/cancellation-policy',
  '/faq',
  '/privacy',
  '/terms',
  '/buying-guide/gold',
  '/buying-guide/diamond',
  '/buying-guide/silver',
] as const;

export const TRUST_PILLARS = [
  { title: 'BIS प्रमाणित', description: 'हॉलमार्क और शुद्धता की साफ जानकारी' },
  { title: 'HUID सत्यापित', description: 'हर योग्य आभूषण पर HUID भरोसा' },
  { title: 'वापसी / आदान-प्रदान', description: 'दुकान की नीति पहले से देखें' },
] as const;

export const PRICE_BANDS = [
  { value: 'lt10000', label: '< ₹10K', minPaise: 0, maxPaise: 1_000_000 },
  { value: '10000-20000', label: '₹10K-20K', minPaise: 1_000_000, maxPaise: 2_000_000 },
  { value: '20000-30000', label: '₹20K-30K', minPaise: 2_000_000, maxPaise: 3_000_000 },
  { value: '30000-50000', label: '₹30K-50K', minPaise: 3_000_000, maxPaise: 5_000_000 },
  { value: '50000-75000', label: '₹50K-75K', minPaise: 5_000_000, maxPaise: 7_500_000 },
  { value: 'gte75000', label: '₹75K+', minPaise: 7_500_000, maxPaise: null },
] as const;

export const PURITY_FILTERS = [
  { value: 'GOLD_24K', label: '24K' },
  { value: 'GOLD_22K', label: '22K' },
  { value: 'GOLD_18K', label: '18K' },
  { value: 'GOLD_14K', label: '14K' },
  { value: 'SILVER_925', label: '925' },
  { value: 'SILVER_999', label: '999' },
] as const;

type TenantStringKey = keyof TenantConfigResponse;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstConfigValue(config: TenantConfigResponse, keys: TenantStringKey[]): string | null {
  for (const key of keys) {
    const value = stringValue(config[key]);
    if (value) return value;
  }
  return null;
}

export function tenantAddress(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, ['address', 'shopAddress', 'shop_address']);
}

export function tenantPhone(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, ['contactPhone', 'contact_phone']);
}

export function tenantWhatsapp(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, [
    'contactWhatsApp',
    'contact_whatsapp',
    'whatsappNumber',
    'whatsapp_number',
    'contactPhone',
    'contact_phone',
  ]);
}

export function tenantAppDownloadUrl(config: TenantConfigResponse): string | null {
  const value = firstConfigValue(config, ['appDownloadUrl', 'app_download_url']);
  return value && value.startsWith('https://') ? value : null;
}

export function tenantSocialLinks(config: TenantConfigResponse) {
  return [
    { label: 'Instagram', href: firstConfigValue(config, ['instagramUrl', 'instagram_url']) },
    { label: 'Facebook', href: firstConfigValue(config, ['facebookUrl', 'facebook_url']) },
    { label: 'YouTube', href: firstConfigValue(config, ['youtubeUrl', 'youtube_url']) },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href?.startsWith('https://')));
}

export function tenantShippingPolicy(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, ['shippingPolicyText', 'shipping_policy_text']);
}

export function tenantCancellationPolicy(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, ['cancellationPolicyText', 'cancellation_policy_text']);
}

export function tenantFaqMarkdown(config: TenantConfigResponse): string | null {
  return firstConfigValue(config, ['faqMarkdown', 'faq_markdown']);
}

export function buildWhatsAppUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildTelUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export function baseUrlFromHeaders(headersList: { get(name: string): string | null }): string {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured?.startsWith('https://') || configured?.startsWith('http://')) {
    return configured.replace(/\/$/, '');
  }

  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000';
  const proto =
    headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function productDisplayName(product: CatalogProduct): string {
  const purity = purityLabel(product.purity, product.metal);
  return product.categoryName ? `${purity} ${product.categoryName}` : purity;
}

export function productMaterial(product: CatalogProduct): string {
  return `${metalLabel(product.metal)} ${purityLabel(product.purity, product.metal)}`;
}

export function productTotalPaise(product: CatalogProduct): number | null {
  const raw = product.estimatedPrice?.totalPaise;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('hi-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function applyCatalogFilters(
  products: CatalogProduct[],
  filters: { metal?: string; purity?: string; price?: string; inStockOnly?: boolean },
): CatalogProduct[] {
  return products.filter((product) => {
    if (filters.metal && product.metal !== filters.metal) return false;
    if (filters.purity && product.purity !== filters.purity) return false;
    if (filters.inStockOnly && product.quantity <= 0) return false;

    if (filters.price) {
      const band = PRICE_BANDS.find((item) => item.value === filters.price);
      const totalPaise = productTotalPaise(product);
      if (!band || totalPaise === null) return false;
      if (totalPaise < band.minPaise) return false;
      if (band.maxPaise !== null && totalPaise >= band.maxPaise) return false;
    }

    return true;
  });
}

export function recommendedProducts(
  current: CatalogProduct,
  candidates: CatalogProduct[],
): CatalogProduct[] {
  const currentWeightMg = gramsToMilligrams(current.netWeightG);
  const hasWeight = currentWeightMg !== null && currentWeightMg > 0;
  const minWeightMg = currentWeightMg === null ? null : (currentWeightMg * 8) / 10;
  const maxWeightMg = currentWeightMg === null ? null : (currentWeightMg * 12) / 10;

  return candidates
    .filter((product) => {
      if (product.id === current.id || product.quantity <= 0) return false;
      if (current.categoryId && product.categoryId !== current.categoryId) return false;
      if (!hasWeight) return true;
      const weightMg = gramsToMilligrams(product.netWeightG);
      return weightMg !== null && weightMg >= minWeightMg! && weightMg <= maxWeightMg!;
    })
    .sort((left, right) => {
      if (!hasWeight) return 0;
      const leftWeightMg = gramsToMilligrams(left.netWeightG) ?? 0;
      const rightWeightMg = gramsToMilligrams(right.netWeightG) ?? 0;
      return (
        Math.abs(leftWeightMg - currentWeightMg!) -
        Math.abs(rightWeightMg - currentWeightMg!)
      );
    })
    .slice(0, 6);
}

function gramsToMilligrams(value: string): number | null {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  const wholeMg = Number.parseInt(whole, 10) * 1000;
  const fractionMg = Number.parseInt(fraction.padEnd(3, '0').slice(0, 3), 10);
  const total = wholeMg + fractionMg;
  return Number.isFinite(total) ? total : null;
}

export function emiRows(totalPaise: number): Array<{ months: number; monthlyPaise: number }> {
  return [3, 6, 9, 12].map((months) => ({
    months,
    monthlyPaise: Math.ceil(totalPaise / months),
  }));
}
