/**
 * storefront-demo.ts
 *
 * Adds an aspirational, image-backed customer storefront catalogue to an
 * existing demo tenant. Defaults to the tenant used by apps/customer-web/.env.local.
 *
 * Usage:
 *   pnpm seed:storefront-demo
 *   DEMO_SHOP_SLUG=shri-ram-jewellers pnpm seed:storefront-demo
 */

import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';

loadEnv({ path: 'apps/api/.env.local' });
loadEnv({ path: 'apps/customer-web/.env.local', override: false });
loadEnv({ override: false });

const DB_URL = process.env['DATABASE_URL'];
const TARGET_SLUG = process.env['DEMO_SHOP_SLUG'] ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev-2';
const SEED_PHONE = '+919999000001';
const GOLD_24K_PAISE_PER_G = 740_000;

type Metal = 'GOLD' | 'SILVER';

interface DemoImageMeta {
  alt: string;
}

interface DemoProduct {
  sku: string;
  category: string;
  metal: Metal;
  purity: string;
  grossWeightG: number;
  makingPct: number;
  style: string;
  occasion: string[];
  giftPersona: string[];
  image: string;
  featuredScore: number;
  salesCount30d: number;
  viewCount30d: number;
}

const CATEGORIES = [
  'Gold Rings',
  'Diamond Rings',
  'Gold Bangles',
  'Bridal Sets',
  'Gold Chains',
  'Mangalsutra',
  'Gold Earrings',
  'Pendants',
  'Silver Anklets',
  'Silver Chains',
  'Gold Bracelets',
  'Diamond Earrings',
  'Mens Rings',
  'Kids Jewellery',
] as const;

const IMAGE_META: Record<string, DemoImageMeta> = {
  'ring-wedding.jpg':              { alt: 'Gold wedding rings on ivory fabric' },
  'ring-diamond.jpg':              { alt: 'Diamond ring in a polished gold band' },
  'ring-statement.jpg':            { alt: 'Statement gemstone gold ring' },
  'bangle-red.jpg':                { alt: 'Gold bangles with stones on red silk' },
  'bangle-stack.jpg':              { alt: 'Stacked festive gold bangles' },
  'bangle-color.jpg':              { alt: 'Color enamel bangle stack' },
  'necklace-bridal.jpg':           { alt: 'Bridal gold necklace and earrings set' },
  'necklace-minimal.jpg':          { alt: 'Minimal gold pendant necklace' },
  'earring-gold.jpg':              { alt: 'Gold dangle earrings on velvet' },
  'earring-hoop.jpg':              { alt: 'Gold hoop earrings and chain' },
  'display-tray.jpg':              { alt: 'Jewellery display tray with gold pieces' },
  'pendant-teal-set.jpg':          { alt: 'Two-tone pendant and earrings set on a teal surface' },
  'diamond-teal-set.jpg':          { alt: 'Diamond pendant and earrings set on a teal display' },
  'rose-flower-set.jpg':           { alt: 'Rose-gold floral pendant, ring, and earrings set' },
  'teardrop-teal-set.jpg':         { alt: 'Teardrop pendant and earrings on teal display stands' },
  'black-leaf-set.jpg':            { alt: 'Gold and diamond jewellery set on a black leaf tray' },
  'blue-pendant.jpg':              { alt: 'Rose-gold pendant with geometric diamond detail' },
  'rose-drop-earrings.jpg':        { alt: 'Rose-gold diamond drop earrings on pale blue display' },
  'black-necklace-set.jpg':        { alt: 'Statement necklace and earrings set on a black plate' },
  'black-pendant-set.jpg':         { alt: 'Gold pendant and earrings set on a black leaf tray' },
  'gold-flatlay-set.jpg':          { alt: 'Gold necklace, bangle, ring, and earrings flat lay' },
  'gold-flatlay-alt.jpg':          { alt: 'Gold pendant set with bracelet and ring flat lay' },
  'gold-pendant-ring.jpg':         { alt: 'Gold pendant necklaces and ring on a white background' },
  'gold-pendant-ring-alt.jpg':     { alt: 'Gold pendant chains and ring arranged on white' },
  'gold-pendant-ring-minimal.jpg': { alt: 'Minimal gold pendant and ring set on white' },
  'gold-gemstone-set.jpg':         { alt: 'Gold jewellery set with red gemstones' },
  'gold-butterfly-set.jpg':        { alt: 'Gold butterfly necklace, bracelets, ring, and earrings set' },
  'gold-ginkgo-set.jpg':           { alt: 'Gold ginkgo pendant, bangle, and earrings set' },
  'gold-geometric-set.jpg':        { alt: 'Geometric gold bracelet, ring, and earrings set' },
  'gold-ginkgo-wide.jpg':          { alt: 'Wide gold ginkgo jewellery set on white' },
  'gold-leaf-set.jpg':             { alt: 'Gold leaf bracelet, ring, and earrings set' },
  'gold-geometric-wide.jpg':       { alt: 'Wide geometric gold bracelet and earring set' },
};

const PRODUCTS: DemoProduct[] = [
  { sku: 'DMO-RG-001', category: 'Gold Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 5.6,  makingPct: 12, style: 'ENGAGEMENT', occasion: ['ENGAGEMENT', 'GIFT'], giftPersona: ['WIFE', 'BRIDE'], image: 'ring-diamond.jpg', featuredScore: 96, salesCount30d: 18, viewCount30d: 420 },
  { sku: 'DMO-RG-002', category: 'Gold Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 4.8,  makingPct: 12, style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['SELF', 'SISTER'], image: 'ring-wedding.jpg', featuredScore: 82, salesCount30d: 14, viewCount30d: 310 },
  { sku: 'DMO-RG-003', category: 'Diamond Rings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 3.9,  makingPct: 15, style: 'STATEMENT', occasion: ['ENGAGEMENT', 'ANNIVERSARY'], giftPersona: ['WIFE', 'BRIDE'], image: 'ring-statement.jpg', featuredScore: 94, salesCount30d: 11, viewCount30d: 360 },
  { sku: 'DMO-RG-004', category: 'Diamond Rings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.2,  makingPct: 15, style: 'ENGAGEMENT', occasion: ['ENGAGEMENT'], giftPersona: ['BRIDE'], image: 'ring-diamond.jpg', featuredScore: 91, salesCount30d: 9,  viewCount30d: 280 },
  { sku: 'DMO-BG-001', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 23.5, makingPct: 8,  style: 'BRIDAL', occasion: ['WEDDING', 'FESTIVAL'], giftPersona: ['BRIDE', 'MOTHER'], image: 'bangle-red.jpg', featuredScore: 98, salesCount30d: 16, viewCount30d: 390 },
  { sku: 'DMO-BG-002', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 19.2, makingPct: 8,  style: 'TEMPLE', occasion: ['FESTIVAL', 'WEDDING'], giftPersona: ['MOTHER'], image: 'bangle-stack.jpg', featuredScore: 92, salesCount30d: 15, viewCount30d: 350 },
  { sku: 'DMO-BG-003', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 17.8, makingPct: 8,  style: 'STATEMENT', occasion: ['PARTY', 'FESTIVAL'], giftPersona: ['SISTER', 'SELF'], image: 'bangle-color.jpg', featuredScore: 78, salesCount30d: 10, viewCount30d: 240 },
  { sku: 'DMO-BG-004', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 21.4, makingPct: 8,  style: 'BRIDAL', occasion: ['WEDDING'], giftPersona: ['BRIDE'], image: 'bangle-red.jpg', featuredScore: 88, salesCount30d: 8,  viewCount30d: 260 },
  { sku: 'DMO-BD-001', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 58.0, makingPct: 14, style: 'BRIDAL', occasion: ['WEDDING'], giftPersona: ['BRIDE'], image: 'necklace-bridal.jpg', featuredScore: 100, salesCount30d: 7, viewCount30d: 510 },
  { sku: 'DMO-BD-002', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 46.5, makingPct: 14, style: 'TEMPLE', occasion: ['WEDDING', 'FESTIVAL'], giftPersona: ['BRIDE', 'MOTHER'], image: 'necklace-bridal.jpg', featuredScore: 95, salesCount30d: 6, viewCount30d: 430 },
  { sku: 'DMO-NK-001', category: 'Gold Chains',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 12.6, makingPct: 9,  style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['SELF', 'FRIEND'], image: 'necklace-minimal.jpg', featuredScore: 74, salesCount30d: 13, viewCount30d: 250 },
  { sku: 'DMO-NK-002', category: 'Mangalsutra',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 18.4, makingPct: 10, style: 'DAILY_WEAR', occasion: ['ANNIVERSARY', 'DAILY'], giftPersona: ['WIFE'], image: 'necklace-minimal.jpg', featuredScore: 86, salesCount30d: 12, viewCount30d: 300 },
  { sku: 'DMO-ER-001', category: 'Gold Earrings', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 6.1,  makingPct: 12, style: 'JHUMKA', occasion: ['FESTIVAL', 'WEDDING'], giftPersona: ['SISTER', 'MOTHER'], image: 'earring-gold.jpg', featuredScore: 89, salesCount30d: 17, viewCount30d: 370 },
  { sku: 'DMO-ER-002', category: 'Gold Earrings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.4,  makingPct: 12, style: 'HOOPS', occasion: ['DAILY', 'OFFICE'], giftPersona: ['SELF', 'FRIEND'], image: 'earring-hoop.jpg', featuredScore: 79, salesCount30d: 15, viewCount30d: 290 },
  { sku: 'DMO-ER-003', category: 'Pendants',      metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 3.8,  makingPct: 13, style: 'DROP', occasion: ['GIFT', 'ANNIVERSARY'], giftPersona: ['WIFE', 'SISTER'], image: 'earring-gold.jpg', featuredScore: 76, salesCount30d: 9,  viewCount30d: 220 },
  { sku: 'DMO-SV-001', category: 'Silver Anklets', metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 31.0, makingPct: 10, style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['SISTER', 'FRIEND'], image: 'bangle-color.jpg', featuredScore: 70, salesCount30d: 20, viewCount30d: 330 },
  { sku: 'DMO-SV-002', category: 'Silver Anklets', metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 35.0, makingPct: 10, style: 'KIDS', occasion: ['GIFT', 'FESTIVAL'], giftPersona: ['SISTER'], image: 'bangle-stack.jpg', featuredScore: 72, salesCount30d: 18, viewCount30d: 310 },
  { sku: 'DMO-SV-003', category: 'Silver Chains',  metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 22.0, makingPct: 10, style: 'DAILY_WEAR', occasion: ['DAILY'], giftPersona: ['SELF', 'FRIEND'], image: 'necklace-minimal.jpg', featuredScore: 66, salesCount30d: 16, viewCount30d: 260 },
  { sku: 'DMO-SV-004', category: 'Silver Chains',  metal: 'SILVER', purity: 'SILVER_999', grossWeightG: 28.0, makingPct: 10, style: 'TEMPLE', occasion: ['FESTIVAL'], giftPersona: ['MOTHER'], image: 'display-tray.jpg', featuredScore: 64, salesCount30d: 11, viewCount30d: 210 },
  { sku: 'DMO-RG-005', category: 'Gold Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 6.2,  makingPct: 12, style: 'STATEMENT', occasion: ['PARTY', 'GIFT'], giftPersona: ['SELF', 'WIFE'], image: 'gold-flatlay-set.jpg', featuredScore: 83, salesCount30d: 12, viewCount30d: 275 },
  { sku: 'DMO-RG-006', category: 'Gold Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 5.1,  makingPct: 12, style: 'DAILY_WEAR', occasion: ['DAILY', 'OFFICE'], giftPersona: ['SELF'], image: 'gold-pendant-ring.jpg', featuredScore: 77, salesCount30d: 10, viewCount30d: 220 },
  { sku: 'DMO-RG-007', category: 'Mens Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 8.4,  makingPct: 11, style: 'STATEMENT', occasion: ['GIFT', 'ANNIVERSARY'], giftPersona: ['FRIEND'], image: 'gold-pendant-ring-alt.jpg', featuredScore: 69, salesCount30d: 8,  viewCount30d: 185 },
  { sku: 'DMO-RG-008', category: 'Mens Rings',    metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 7.6,  makingPct: 11, style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['FRIEND'], image: 'gold-flatlay-alt.jpg', featuredScore: 67, salesCount30d: 7,  viewCount30d: 174 },
  { sku: 'DMO-RG-009', category: 'Diamond Rings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.8,  makingPct: 15, style: 'STATEMENT', occasion: ['ANNIVERSARY', 'PARTY'], giftPersona: ['WIFE'], image: 'rose-flower-set.jpg', featuredScore: 90, salesCount30d: 10, viewCount30d: 355 },
  { sku: 'DMO-RG-010', category: 'Diamond Rings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 5.0,  makingPct: 15, style: 'BRIDAL', occasion: ['WEDDING', 'ENGAGEMENT'], giftPersona: ['BRIDE'], image: 'black-leaf-set.jpg', featuredScore: 93, salesCount30d: 9,  viewCount30d: 342 },
  { sku: 'DMO-RG-011', category: 'Diamond Rings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.6,  makingPct: 15, style: 'STATEMENT', occasion: ['PARTY'], giftPersona: ['SELF'], image: 'gold-gemstone-set.jpg', featuredScore: 84, salesCount30d: 8,  viewCount30d: 244 },
  { sku: 'DMO-BG-005', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 18.8, makingPct: 8,  style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['SELF', 'MOTHER'], image: 'gold-ginkgo-set.jpg', featuredScore: 81, salesCount30d: 13, viewCount30d: 286 },
  { sku: 'DMO-BG-006', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 20.6, makingPct: 8,  style: 'TEMPLE', occasion: ['FESTIVAL'], giftPersona: ['MOTHER'], image: 'gold-leaf-set.jpg', featuredScore: 79, salesCount30d: 11, viewCount30d: 241 },
  { sku: 'DMO-BG-007', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 16.9, makingPct: 8,  style: 'STATEMENT', occasion: ['PARTY', 'GIFT'], giftPersona: ['SISTER'], image: 'gold-geometric-wide.jpg', featuredScore: 73, salesCount30d: 9,  viewCount30d: 205 },
  { sku: 'DMO-BG-008', category: 'Gold Bangles',  metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 19.7, makingPct: 8,  style: 'STATEMENT', occasion: ['FESTIVAL', 'PARTY'], giftPersona: ['SELF'], image: 'gold-ginkgo-wide.jpg', featuredScore: 75, salesCount30d: 10, viewCount30d: 218 },
  { sku: 'DMO-BD-003', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 52.5, makingPct: 14, style: 'BRIDAL', occasion: ['WEDDING'], giftPersona: ['BRIDE'], image: 'black-necklace-set.jpg', featuredScore: 97, salesCount30d: 6,  viewCount30d: 475 },
  { sku: 'DMO-BD-004', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 41.8, makingPct: 15, style: 'BRIDAL', occasion: ['WEDDING', 'PARTY'], giftPersona: ['BRIDE'], image: 'pendant-teal-set.jpg', featuredScore: 87, salesCount30d: 5,  viewCount30d: 392 },
  { sku: 'DMO-BD-005', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 44.2, makingPct: 15, style: 'STATEMENT', occasion: ['WEDDING', 'PARTY'], giftPersona: ['BRIDE'], image: 'diamond-teal-set.jpg', featuredScore: 85, salesCount30d: 5,  viewCount30d: 368 },
  { sku: 'DMO-BD-006', category: 'Bridal Sets',   metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 49.0, makingPct: 15, style: 'BRIDAL', occasion: ['WEDDING'], giftPersona: ['BRIDE'], image: 'black-leaf-set.jpg', featuredScore: 86, salesCount30d: 4,  viewCount30d: 350 },
  { sku: 'DMO-NK-003', category: 'Gold Chains',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 10.2, makingPct: 9,  style: 'DAILY_WEAR', occasion: ['DAILY', 'OFFICE'], giftPersona: ['SELF'], image: 'gold-flatlay-alt.jpg', featuredScore: 71, salesCount30d: 11, viewCount30d: 215 },
  { sku: 'DMO-NK-004', category: 'Gold Chains',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 13.8, makingPct: 9,  style: 'STATEMENT', occasion: ['PARTY', 'GIFT'], giftPersona: ['WIFE', 'SISTER'], image: 'gold-pendant-ring-alt.jpg', featuredScore: 72, salesCount30d: 10, viewCount30d: 222 },
  { sku: 'DMO-NK-005', category: 'Gold Chains',   metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 8.6,  makingPct: 10, style: 'OFFICE', occasion: ['OFFICE', 'DAILY'], giftPersona: ['SELF'], image: 'blue-pendant.jpg', featuredScore: 68, salesCount30d: 8,  viewCount30d: 190 },
  { sku: 'DMO-NK-006', category: 'Mangalsutra',   metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 22.2, makingPct: 10, style: 'TEMPLE', occasion: ['ANNIVERSARY', 'FESTIVAL'], giftPersona: ['WIFE'], image: 'gold-gemstone-set.jpg', featuredScore: 80, salesCount30d: 9,  viewCount30d: 255 },
  { sku: 'DMO-ER-004', category: 'Gold Earrings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 5.2,  makingPct: 12, style: 'DROP', occasion: ['PARTY', 'ANNIVERSARY'], giftPersona: ['WIFE', 'SELF'], image: 'rose-drop-earrings.jpg', featuredScore: 87, salesCount30d: 14, viewCount30d: 305 },
  { sku: 'DMO-ER-005', category: 'Diamond Earrings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 5.8, makingPct: 14, style: 'STATEMENT', occasion: ['PARTY', 'WEDDING'], giftPersona: ['BRIDE', 'WIFE'], image: 'diamond-teal-set.jpg', featuredScore: 86, salesCount30d: 12, viewCount30d: 290 },
  { sku: 'DMO-ER-006', category: 'Diamond Earrings', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.9, makingPct: 14, style: 'DROP', occasion: ['ANNIVERSARY', 'GIFT'], giftPersona: ['WIFE', 'SISTER'], image: 'teardrop-teal-set.jpg', featuredScore: 78, salesCount30d: 10, viewCount30d: 230 },
  { sku: 'DMO-ER-007', category: 'Gold Earrings', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 4.7,  makingPct: 12, style: 'STUDS', occasion: ['DAILY', 'OFFICE'], giftPersona: ['SELF'], image: 'gold-geometric-set.jpg', featuredScore: 65, salesCount30d: 9,  viewCount30d: 178 },
  { sku: 'DMO-ER-008', category: 'Kids Jewellery', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 3.6, makingPct: 12, style: 'KIDS', occasion: ['GIFT', 'FESTIVAL'], giftPersona: ['SISTER'], image: 'gold-butterfly-set.jpg', featuredScore: 62, salesCount30d: 8,  viewCount30d: 166 },
  { sku: 'DMO-PD-001', category: 'Pendants',      metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 3.5,  makingPct: 13, style: 'DROP', occasion: ['GIFT', 'ANNIVERSARY'], giftPersona: ['WIFE'], image: 'blue-pendant.jpg', featuredScore: 82, salesCount30d: 11, viewCount30d: 276 },
  { sku: 'DMO-PD-002', category: 'Pendants',      metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.1,  makingPct: 13, style: 'STATEMENT', occasion: ['PARTY'], giftPersona: ['SELF'], image: 'black-pendant-set.jpg', featuredScore: 76, salesCount30d: 8,  viewCount30d: 214 },
  { sku: 'DMO-PD-003', category: 'Pendants',      metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 3.9,  makingPct: 12, style: 'DAILY_WEAR', occasion: ['DAILY', 'GIFT'], giftPersona: ['SISTER', 'SELF'], image: 'gold-pendant-ring-minimal.jpg', featuredScore: 70, salesCount30d: 9,  viewCount30d: 190 },
  { sku: 'DMO-PD-004', category: 'Pendants',      metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 4.5,  makingPct: 13, style: 'STATEMENT', occasion: ['PARTY', 'GIFT'], giftPersona: ['WIFE'], image: 'rose-flower-set.jpg', featuredScore: 73, salesCount30d: 8,  viewCount30d: 206 },
  { sku: 'DMO-BR-001', category: 'Gold Bracelets', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 14.6, makingPct: 9, style: 'DAILY_WEAR', occasion: ['DAILY', 'OFFICE'], giftPersona: ['SELF'], image: 'gold-ginkgo-wide.jpg', featuredScore: 74, salesCount30d: 12, viewCount30d: 228 },
  { sku: 'DMO-BR-002', category: 'Gold Bracelets', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 16.8, makingPct: 9, style: 'STATEMENT', occasion: ['PARTY'], giftPersona: ['SISTER'], image: 'gold-leaf-set.jpg', featuredScore: 72, salesCount30d: 10, viewCount30d: 212 },
  { sku: 'DMO-BR-003', category: 'Gold Bracelets', metal: 'GOLD', purity: 'GOLD_18K', grossWeightG: 12.4, makingPct: 10, style: 'OFFICE', occasion: ['OFFICE', 'DAILY'], giftPersona: ['SELF'], image: 'gold-geometric-wide.jpg', featuredScore: 66, salesCount30d: 8,  viewCount30d: 172 },
  { sku: 'DMO-BR-004', category: 'Gold Bracelets', metal: 'GOLD', purity: 'GOLD_22K', grossWeightG: 15.7, makingPct: 9, style: 'STATEMENT', occasion: ['GIFT', 'PARTY'], giftPersona: ['WIFE'], image: 'gold-butterfly-set.jpg', featuredScore: 68, salesCount30d: 9,  viewCount30d: 184 },
  { sku: 'DMO-SV-005', category: 'Silver Anklets', metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 26.0, makingPct: 10, style: 'DAILY_WEAR', occasion: ['DAILY'], giftPersona: ['SELF'], image: 'pendant-teal-set.jpg', featuredScore: 60, salesCount30d: 14, viewCount30d: 205 },
  { sku: 'DMO-SV-006', category: 'Silver Chains',  metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 24.0, makingPct: 10, style: 'DROP', occasion: ['GIFT', 'PARTY'], giftPersona: ['FRIEND'], image: 'diamond-teal-set.jpg', featuredScore: 61, salesCount30d: 13, viewCount30d: 198 },
  { sku: 'DMO-SV-007', category: 'Silver Chains',  metal: 'SILVER', purity: 'SILVER_999', grossWeightG: 20.5, makingPct: 10, style: 'STATEMENT', occasion: ['GIFT'], giftPersona: ['SISTER'], image: 'rose-flower-set.jpg', featuredScore: 59, salesCount30d: 11, viewCount30d: 176 },
  { sku: 'DMO-SV-008', category: 'Silver Anklets', metal: 'SILVER', purity: 'SILVER_925', grossWeightG: 29.2, makingPct: 10, style: 'KIDS', occasion: ['GIFT', 'FESTIVAL'], giftPersona: ['SISTER'], image: 'blue-pendant.jpg', featuredScore: 58, salesCount30d: 10, viewCount30d: 160 },
];

const COLLECTIONS = [
  { slug: 'bridal-edit', titleHi: 'Bridal Edit', titleEn: 'Bridal Edit', subtitleHi: 'Statement sets for the wedding season', isPremium: true, productSkus: ['DMO-BD-001', 'DMO-BD-002', 'DMO-BD-003', 'DMO-BD-004', 'DMO-BD-005', 'DMO-BD-006', 'DMO-BG-001', 'DMO-RG-004'] },
  { slug: 'daily-gold', titleHi: 'Daily Gold', titleEn: 'Daily Gold', subtitleHi: 'Lightweight pieces for everyday wear', isPremium: false, productSkus: ['DMO-RG-002', 'DMO-RG-006', 'DMO-NK-001', 'DMO-NK-003', 'DMO-NK-005', 'DMO-ER-002', 'DMO-PD-003', 'DMO-BR-001'] },
  { slug: 'festival-bangles', titleHi: 'Festival Bangles', titleEn: 'Festival Bangles', subtitleHi: 'Bangles with colour, stonework, and shine', isPremium: true, productSkus: ['DMO-BG-001', 'DMO-BG-002', 'DMO-BG-003', 'DMO-BG-004', 'DMO-BG-005', 'DMO-BG-006', 'DMO-BG-007', 'DMO-BG-008'] },
  { slug: 'gift-ready', titleHi: 'Gift Ready', titleEn: 'Gift Ready', subtitleHi: 'Polished gifts across gold and silver', isPremium: false, productSkus: ['DMO-RG-002', 'DMO-ER-003', 'DMO-ER-004', 'DMO-PD-001', 'DMO-SV-002', 'DMO-SV-005', 'DMO-BR-003', 'DMO-ER-008'] },
  { slug: 'diamond-glow', titleHi: 'Diamond Glow', titleEn: 'Diamond Glow', subtitleHi: 'Diamond looks for engagement, party, and evening wear', isPremium: true, productSkus: ['DMO-RG-003', 'DMO-RG-004', 'DMO-RG-009', 'DMO-RG-010', 'DMO-RG-011', 'DMO-ER-005', 'DMO-ER-006', 'DMO-PD-001'] },
  { slug: 'mens-edit', titleHi: 'Mens Edit', titleEn: 'Mens Edit', subtitleHi: 'Rings, chains, and bracelets with a cleaner profile', isPremium: false, productSkus: ['DMO-RG-007', 'DMO-RG-008', 'DMO-NK-004', 'DMO-BR-002', 'DMO-BR-003', 'DMO-BR-004'] },
  { slug: 'silver-style', titleHi: 'Silver Style', titleEn: 'Silver Style', subtitleHi: '925 and 999 silver pieces for gifting and daily wear', isPremium: false, productSkus: ['DMO-SV-001', 'DMO-SV-002', 'DMO-SV-003', 'DMO-SV-004', 'DMO-SV-005', 'DMO-SV-006', 'DMO-SV-007', 'DMO-SV-008'] },
  { slug: 'minimal-edit', titleHi: 'Minimal Edit', titleEn: 'Minimal Edit', subtitleHi: 'Subtle chains, pendants, earrings, and bracelets', isPremium: false, productSkus: ['DMO-NK-001', 'DMO-NK-003', 'DMO-NK-005', 'DMO-ER-002', 'DMO-ER-007', 'DMO-PD-003', 'DMO-BR-001', 'DMO-RG-006'] },
];

const CAMPAIGN_ASSETS = [
  'campaign-showroom-display.jpg',
  'campaign-necklace-showcase.jpg',
  'campaign-luxe-window.jpg',
  'campaign-rings-showcase.jpg',
  'campaign-gift-table.jpg',
  'campaign-lifestyle-necklace.jpg',
  'campaign-minimal-necklace.jpg',
  'campaign-layered-necklace.jpg',
  'campaign-black-gold.jpg',
] as const;

function minutesAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d;
}

function huid(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function rateFor(purity: string): number {
  switch (purity) {
    case 'GOLD_24K': return GOLD_24K_PAISE_PER_G;
    case 'GOLD_22K': return Math.round(GOLD_24K_PAISE_PER_G * 22 / 24);
    case 'GOLD_20K': return Math.round(GOLD_24K_PAISE_PER_G * 20 / 24);
    case 'GOLD_18K': return Math.round(GOLD_24K_PAISE_PER_G * 18 / 24);
    case 'GOLD_14K': return Math.round(GOLD_24K_PAISE_PER_G * 14 / 24);
    case 'SILVER_999': return 9_500;
    case 'SILVER_925': return 8_788;
    default: return GOLD_24K_PAISE_PER_G;
  }
}

function priceSnapshotPaise(product: DemoProduct): bigint {
  const netWeightG = product.grossWeightG * 0.95;
  const metalValue = netWeightG * rateFor(product.purity);
  const making = metalValue * (product.makingPct / 100);
  const gst = metalValue * 0.03 + making * 0.05;
  return BigInt(Math.round(metalValue + making + gst));
}

function assetPath(fileName: string): string {
  return join(process.cwd(), 'apps', 'customer-web', 'public', 'demo-shop', fileName);
}

function assetByteSize(fileName: string): number {
  const path = assetPath(fileName);
  if (!existsSync(path)) {
    throw new Error(`Missing demo asset: ${path}`);
  }
  return statSync(path).size;
}

function assetDimensions(fileName: string): { width: number; height: number } {
  const path = assetPath(fileName);
  const buffer = readFileSync(path);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`Demo asset is not a JPEG: ${path}`);
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    const length = buffer.readUInt16BE(offset);
    offset += 2;
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3,
      0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb,
      0xcd, 0xce, 0xcf,
    ].includes(marker);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 1),
        width:  buffer.readUInt16BE(offset + 3),
      };
    }

    offset += length - 2;
  }

  throw new Error(`Could not read JPEG dimensions for demo asset: ${path}`);
}

function validateCampaignAssets(): void {
  for (const asset of CAMPAIGN_ASSETS) {
    assetDimensions(asset);
    assetByteSize(asset);
  }
}

async function getOrCreateCategory(client: PoolClient, shopId: string, name: string): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM product_categories WHERE shop_id = $1 AND name = $2 LIMIT 1`,
    [shopId, name],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO product_categories (shop_id, name, name_hi)
     VALUES ($1, $2, $2)
     RETURNING id`,
    [shopId, name],
  );
  return inserted.rows[0].id;
}

async function upsertProductImage(
  client: PoolClient,
  params: {
    shopId: string;
    productId: string;
    sku: string;
    image: string;
    uploadedByUserId: string;
  },
): Promise<string> {
  const meta = IMAGE_META[params.image];
  if (!meta) throw new Error(`No image metadata configured for ${params.image}`);

  const storageKey = `public/demo-shop/${params.image}`;
  const dimensions = assetDimensions(params.image);
  const byteSize = assetByteSize(params.image);
  const idempotencyKey = `storefront-demo-primary-${params.sku}`;
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM product_images WHERE product_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [params.productId, idempotencyKey],
  );

  if (existing.rows[0]) {
    const updated = await client.query<{ id: string }>(
      `UPDATE product_images
          SET storage_key = $1,
              alt_text = $2,
              mime_type = 'image/jpeg',
              byte_size = $3,
              width = $4,
              height = $5,
              exif_stripped_at = NOW(),
              uploaded_by_user_id = $6,
              scan_status = 'clean',
              sort_order = 0,
              updated_at = NOW()
        WHERE id = $7
        RETURNING id`,
      [
        storageKey,
        meta.alt,
        byteSize,
        dimensions.width,
        dimensions.height,
        params.uploadedByUserId,
        existing.rows[0].id,
      ],
    );
    return updated.rows[0].id;
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO product_images
       (shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
        width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
        sort_order, idempotency_key)
     VALUES ($1, $2, $3, $4, 'image/jpeg', $5, $6, $7, NOW(), $8, 'clean', 0, $9)
     RETURNING id`,
    [
      params.shopId,
      params.productId,
      storageKey,
      meta.alt,
      byteSize,
      dimensions.width,
      dimensions.height,
      params.uploadedByUserId,
      idempotencyKey,
    ],
  );
  return inserted.rows[0].id;
}

async function seed(client: PoolClient): Promise<void> {
  const shop = await client.query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM shops WHERE slug = $1 AND status = 'ACTIVE'`,
    [TARGET_SLUG],
  );
  if (!shop.rows[0]) {
    throw new Error(`Active shop not found for slug "${TARGET_SLUG}"`);
  }
  const shopId = shop.rows[0].id;
  validateCampaignAssets();

  const hiddenPlaceholderProducts = await client.query(
    `UPDATE products
        SET published_at = NULL,
            quantity = 0,
            updated_at = NOW()
      WHERE shop_id = $1
        AND sku NOT LIKE 'DMO-%'
        AND primary_image_id IS NULL`,
    [shopId],
  );

  await client.query(
    `UPDATE shops
        SET config = config || $2::jsonb,
            years_in_business = COALESCE(years_in_business, 25),
            updated_at = NOW()
      WHERE id = $1`,
    [
      shopId,
      JSON.stringify({
        primaryColor: '#B58A3C',
        primary_color: '#B58A3C',
        secondaryColor: '#D4745A',
        defaultLanguage: 'hi-IN',
      }),
    ],
  );

  const user = await client.query<{ id: string }>(
    `INSERT INTO shop_users (shop_id, phone, display_name, role, status, activated_at)
     VALUES ($1, $2, 'Demo curator', 'shop_admin', 'ACTIVE', NOW())
     ON CONFLICT (shop_id, phone) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING id`,
    [shopId, SEED_PHONE],
  );
  const seedUserId = user.rows[0].id;

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    categoryIds.set(category, await getOrCreateCategory(client, shopId, category));
  }

  const productIds = new Map<string, string>();
  const imageIds = new Map<string, string>();

  for (let i = 0; i < PRODUCTS.length; i++) {
    const product = PRODUCTS[i];
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Missing category id for ${product.category}`);

    const netWeightG = (product.grossWeightG * 0.95).toFixed(4);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO products
         (shop_id, category_id, sku, metal, purity,
          gross_weight_g, net_weight_g, stone_weight_g,
          huid, huid_exemption_category, status, quantity, cost_paise,
          created_by_user_id, published_at,
          style, occasion, gift_persona, featured_score, sales_count_30d,
          view_count_30d, price_snapshot_paise, price_snapshot_at, published_search_idx_at)
       VALUES
         ($1, $2, $3, $4, $5,
          $6, $7, '0.0000',
          $8, 'none', 'IN_STOCK', 1, $9,
          $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, NOW(), NOW())
       ON CONFLICT (shop_id, sku) DO UPDATE SET
          category_id = EXCLUDED.category_id,
          metal = EXCLUDED.metal,
          purity = EXCLUDED.purity,
          gross_weight_g = EXCLUDED.gross_weight_g,
          net_weight_g = EXCLUDED.net_weight_g,
          huid = COALESCE(products.huid, EXCLUDED.huid),
          huid_exemption_category = EXCLUDED.huid_exemption_category,
          status = 'IN_STOCK',
          quantity = 1,
          cost_paise = EXCLUDED.cost_paise,
          published_at = EXCLUDED.published_at,
          style = EXCLUDED.style,
          occasion = EXCLUDED.occasion,
          gift_persona = EXCLUDED.gift_persona,
          featured_score = EXCLUDED.featured_score,
          sales_count_30d = EXCLUDED.sales_count_30d,
          view_count_30d = EXCLUDED.view_count_30d,
          price_snapshot_paise = EXCLUDED.price_snapshot_paise,
          price_snapshot_at = NOW(),
          published_search_idx_at = NOW(),
          updated_at = NOW()
       RETURNING id`,
      [
        shopId,
        categoryId,
        product.sku,
        product.metal,
        product.purity,
        product.grossWeightG.toFixed(4),
        netWeightG,
        product.metal === 'GOLD' ? huid() : null,
        Math.round(Number(priceSnapshotPaise(product)) * 0.62),
        seedUserId,
        minutesAgo(i + 1),
        product.style,
        product.occasion,
        product.giftPersona,
        product.featuredScore,
        product.salesCount30d,
        product.viewCount30d,
        priceSnapshotPaise(product).toString(),
      ],
    );

    const productId = inserted.rows[0].id;
    productIds.set(product.sku, productId);
    imageIds.set(
      product.sku,
      await upsertProductImage(client, {
        shopId,
        productId,
        sku: product.sku,
        image: product.image,
        uploadedByUserId: seedUserId,
      }),
    );
  }

  await client.query(
    `UPDATE products p
        SET primary_image_id = (
          SELECT pi.id
            FROM product_images pi
           WHERE pi.product_id = p.id
             AND pi.scan_status = 'clean'
           ORDER BY pi.sort_order ASC, pi.created_at ASC
           LIMIT 1
        )
      WHERE p.shop_id = $1
        AND p.sku = ANY($2::text[])`,
    [shopId, PRODUCTS.map((product) => product.sku)],
  );

  const collectionIds = new Map<string, string>();
  for (let i = 0; i < COLLECTIONS.length; i++) {
    const collection = COLLECTIONS[i];
    const heroImageId = imageIds.get(collection.productSkus[0]);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO collections
         (shop_id, slug, title_hi, title_en, subtitle_hi, hero_image_id,
          sort_order, is_premium, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (shop_id, slug) DO UPDATE SET
          title_hi = EXCLUDED.title_hi,
          title_en = EXCLUDED.title_en,
          subtitle_hi = EXCLUDED.subtitle_hi,
          hero_image_id = EXCLUDED.hero_image_id,
          sort_order = EXCLUDED.sort_order,
          is_premium = EXCLUDED.is_premium,
          published_at = NOW(),
          updated_at = NOW()
       RETURNING id`,
      [
        shopId,
        collection.slug,
        collection.titleHi,
        collection.titleEn,
        collection.subtitleHi,
        heroImageId,
        i,
        collection.isPremium,
      ],
    );
    const collectionId = inserted.rows[0].id;
    collectionIds.set(collection.slug, collectionId);

    for (let sortOrder = 0; sortOrder < collection.productSkus.length; sortOrder++) {
      const productId = productIds.get(collection.productSkus[sortOrder]);
      if (!productId) continue;
      await client.query(
        `INSERT INTO collection_products (shop_id, collection_id, product_id, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (shop_id, collection_id, product_id) DO UPDATE SET
           sort_order = EXCLUDED.sort_order`,
        [shopId, collectionId, productId, sortOrder],
      );
    }
  }

  const featuredCollectionIds = ['bridal-edit', 'diamond-glow', 'festival-bangles', 'gift-ready']
    .map((slug) => collectionIds.get(slug))
    .filter((id): id is string => Boolean(id));
  const premiumCollectionIds = COLLECTIONS
    .filter((collection) => collection.isPremium)
    .map((collection) => collectionIds.get(collection.slug))
    .filter((id): id is string => Boolean(id));

  const storefrontConfig = {
    heroBanners: [
      {
        imageUrl: '/demo-shop/campaign-showroom-display.jpg',
        headlineHi: 'Wedding-ready gold, curated for every occasion',
        headlineEn: 'Wedding-ready gold',
        ctaUrl: '/products?collection=bridal-edit',
      },
      {
        imageUrl: '/demo-shop/campaign-lifestyle-necklace.jpg',
        headlineHi: 'Lightweight daily-wear pieces for modern gifting',
        headlineEn: 'Everyday shine',
        ctaUrl: '/products?collection=daily-gold',
      },
      {
        imageUrl: '/demo-shop/campaign-rings-showcase.jpg',
        headlineHi: 'Rings, engagement styles, and polished essentials',
        headlineEn: 'Rings and essentials',
        ctaUrl: '/products?search=ring',
      },
      {
        imageUrl: '/demo-shop/campaign-luxe-window.jpg',
        headlineHi: 'Festive bangles with real-time gold pricing',
        headlineEn: 'Festive bangles',
        ctaUrl: '/products?collection=festival-bangles',
      },
    ],
    featuredCollectionIds,
    premiumCollectionIds,
    giftPersonaOverrides: [
      { persona: 'Mother', href: '/products?giftPersona=MOTHER', label: 'For Mother' },
      { persona: 'Bride', href: '/products?collection=bridal-edit', label: 'For Bride' },
      { persona: 'Self', href: '/products?collection=daily-gold', label: 'For Self' },
      { persona: 'Sister', href: '/products?collection=gift-ready', label: 'For Sister' },
      { persona: 'Friend', href: '/products?collection=silver-style', label: 'For Friend' },
    ],
    brandPalette: { accentMode: 'luxe', heroPattern: 'none' },
    trustPillarsOverride: [
      { titleHi: 'BIS Hallmark', titleEn: 'BIS Hallmark', descriptionHi: 'Certified purity on every eligible piece' },
      { titleHi: 'HUID Ready', titleEn: 'HUID Ready', descriptionHi: 'Traceable jewellery IDs for customer confidence' },
      { titleHi: 'Live Pricing', titleEn: 'Live Pricing', descriptionHi: 'Estimates follow the current gold and silver rate' },
      { titleHi: 'Try at Home', titleEn: 'Try at Home', descriptionHi: 'Shortlist pieces and view them at home' },
      { titleHi: 'WhatsApp Support', titleEn: 'WhatsApp Support', descriptionHi: 'Fast answers before customers visit the store' },
    ],
  };

  await client.query(
    `INSERT INTO shop_settings (shop_id, storefront_config_json, try_at_home_enabled, try_at_home_max_pieces, rate_lock_days)
     VALUES ($1, $2::jsonb, true, 5, 7)
     ON CONFLICT (shop_id) DO UPDATE SET
       storefront_config_json = EXCLUDED.storefront_config_json,
       try_at_home_enabled = true,
       try_at_home_max_pieces = COALESCE(shop_settings.try_at_home_max_pieces, 5),
       rate_lock_days = COALESCE(shop_settings.rate_lock_days, 7),
       updated_at = NOW()`,
    [shopId, JSON.stringify(storefrontConfig)],
  );

  console.log(`Seeded storefront demo for "${TARGET_SLUG}" (${shop.rows[0].display_name})`);
  console.log(`  products:    ${PRODUCTS.length}`);
  console.log(`  images:      ${imageIds.size}`);
  console.log(`  collections: ${COLLECTIONS.length}`);
  console.log(`  hidden placeholders without images: ${hiddenPlaceholderProducts.rowCount ?? 0}`);
}

async function main(): Promise<void> {
  const pool = DB_URL
    ? new Pool({ connectionString: DB_URL })
    : new Pool({
        host: process.env['PGHOST'] ?? 'localhost',
        port: parseInt(process.env['PGPORT'] ?? '5433', 10),
        database: process.env['PGDATABASE'] ?? 'goldsmith_dev',
        user: process.env['PGUSER'] ?? 'postgres',
        password: process.env['PGPASSWORD'] ?? 'postgres',
      });

  const client = await pool.connect();
  try {
    // Cloud SQL `postgres` is NOT a true superuser and cannot bypass FORCE RLS.
    // Switch to platform_admin (rolbypassrls=true). No-op locally when
    // already connected as a real superuser.
    await client.query('SET ROLE platform_admin').catch(() => undefined);
    await client.query('BEGIN');
    await seed(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Storefront demo seed failed:', err);
  process.exit(1);
});
