// Catalog response types — shared between customer-web and customer-mobile.
// Types prefixed Catalog* are the current API contract.
// CatalogProductCard / CatalogProductDetail / CatalogImage are Phase-B-ready
// shapes that add primaryImage once B3 ships the join in catalog list responses.

export interface TenantConfigResponse {
  shopId:          string;
  primaryColor:    string;
  logoUrl:         string | null;
  appName:         string;
  defaultLanguage: string;
}

export interface EstimatedPrice {
  totalFormatted: string;
  totalPaise:     string;
  breakdown: {
    goldValuePaise:    string;
    makingChargePaise: string;
    gstMetalPaise:     string;
    gstMakingPaise:    string;
  };
}

// Phase 1 product shape (no primaryImage — added in Phase B B3)
export interface CatalogProduct {
  id:                    string;
  sku:                   string;
  metal:                 string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  grossWeightG:          string;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string | null;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR:  string;
  fetchedAt:     string;
}

export interface PublicRatesResponse {
  GOLD_24K:   PublicRateEntry;
  GOLD_22K:   PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale:      boolean;
  source:     string;
  refreshedAt: string;
}

export interface ReviewItem {
  id:                string;
  rating:            number;
  reviewText:        string | null;
  customerFirstName: string | null;
  createdAt:         string;
}

export interface ReviewsResponse {
  reviews:       ReviewItem[];
  averageRating: number | null;
  total:         number;
}

export interface PublicImageItem {
  id:              string;
  alt_text:        string | null;
  width:           number;
  height:          number;
  srcset:          string;
  default_url:     string;
  placeholder_url: string;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
}

// ─── Phase B ready types ───────────────────────────────────────────────────────
// These shapes match what B3 will return once primaryImage join lands in catalog.

export interface CatalogImage {
  url:            string;
  placeholderUrl: string;
  srcset:         string;
  width:          number;
  height:         number;
  alt:            string | null;
}

// Card-level shape (homepage, listing). No grossWeightG (detail-only).
export interface CatalogProductCard {
  id:                    string;
  sku:                   string;
  metal:                 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string | null;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
  primaryImage:          CatalogImage | null;
}

export interface CatalogProductDetail extends CatalogProductCard {
  grossWeightG:   string;
  occasion:       string[];
  giftPersona:    string[];
  collectionId:   string | null;
  images:         CatalogImage[];
}

export interface CategoryNode {
  id:           string;
  name:         string;
  slug:         string;
  productCount: number;
}

export interface Collection {
  id:           string;
  slug:         string;
  titleHi:      string;
  titleEn?:     string;
  subtitleHi?:  string;
  heroImage:    CatalogImage | null;
  productCount: number;
  isPremium:    boolean;
}
