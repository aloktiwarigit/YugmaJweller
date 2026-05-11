/**
 * seed-anchor-dev-2.ts
 *
 * Second-tenant seed for white-label proof. Mirrors scripts/seed-anchor.ts
 * (shop row + Firebase invite shape) but uses a warm-brown brand palette
 * and a small 10-product catalogue — just enough to walk a demo viewer
 * through "the same backend serves two visibly-different storefronts".
 *
 * Usage:
 *   SEED_2_PHONE_E164=+919xxxxxxxxx \
 *   DATABASE_URL=postgres://... \
 *   tsx scripts/seed-anchor-dev-2.ts
 *
 * Optional:
 *   SEED_2_SLUG="anchor-dev-2"                # override default slug
 *   SEED_2_DISPLAY_NAME="श्री गणेश ज्वेलर्स"  # override display name
 *   FIREBASE_SERVICE_ACCOUNT_JSON_B64=...     # if Firebase invite is wired
 *
 * Companion manual SQL: ops/seeds/anchor-dev-2/storefront-config.sql
 */

import 'dotenv/config';
import { Pool } from 'pg';
import admin from 'firebase-admin';

const SEED_USER_ID = '00000000-0000-0000-0000-000000000002';
const GOLD_RATE_PAISE_PER_G = 740_000; // ₹7,400/g — see scripts/seed/demo-tenant.ts

interface ProductDef {
  sku:         string;
  name:        string;
  categoryKey: string;
  metal:       'GOLD' | 'SILVER';
  purity:      string;
  grossWeightG: number;
  makingPct:   number;
  withHuid:    boolean;
}

const CATEGORIES = [
  { name: 'Gold Rings',    name_hi: 'सोने की अंगूठी' },
  { name: 'Gold Bangles',  name_hi: 'सोने की चूड़ियाँ' },
  { name: 'Gold Chains',   name_hi: 'सोने की चेन' },
  { name: 'Silver Items',  name_hi: 'चाँदी के आभूषण' },
];

// Just 10 products — enough to populate a Browse grid for demo, not enough
// to swamp the dev DB. Same column shape as scripts/seed/demo-tenant.ts.
const PRODUCTS: ProductDef[] = [
  { sku: 'SG-RG-001', name: 'गणेश ज्वेलर्स अंगूठी 1', categoryKey: 'Gold Rings',   metal: 'GOLD', purity: '22K', grossWeightG: 5,  makingPct: 0.12, withHuid: true  },
  { sku: 'SG-RG-002', name: 'गणेश ज्वेलर्स अंगूठी 2', categoryKey: 'Gold Rings',   metal: 'GOLD', purity: '22K', grossWeightG: 6,  makingPct: 0.12, withHuid: true  },
  { sku: 'SG-RG-003', name: 'गणेश ज्वेलर्स अंगूठी 3', categoryKey: 'Gold Rings',   metal: 'GOLD', purity: '18K', grossWeightG: 4,  makingPct: 0.14, withHuid: true  },
  { sku: 'SG-BG-001', name: 'गणेश ज्वेलर्स चूड़ी 1',  categoryKey: 'Gold Bangles', metal: 'GOLD', purity: '22K', grossWeightG: 18, makingPct: 0.08, withHuid: true  },
  { sku: 'SG-BG-002', name: 'गणेश ज्वेलर्स चूड़ी 2',  categoryKey: 'Gold Bangles', metal: 'GOLD', purity: '22K', grossWeightG: 22, makingPct: 0.08, withHuid: true  },
  { sku: 'SG-CH-001', name: 'गणेश ज्वेलर्स चेन 1',    categoryKey: 'Gold Chains',  metal: 'GOLD', purity: '22K', grossWeightG: 10, makingPct: 0.09, withHuid: true  },
  { sku: 'SG-CH-002', name: 'गणेश ज्वेलर्स चेन 2',    categoryKey: 'Gold Chains',  metal: 'GOLD', purity: '22K', grossWeightG: 14, makingPct: 0.09, withHuid: true  },
  { sku: 'SG-SV-001', name: 'गणेश ज्वेलर्स चाँदी चेन', categoryKey: 'Silver Items', metal: 'SILVER', purity: '925', grossWeightG: 20, makingPct: 0.10, withHuid: false },
  { sku: 'SG-SV-002', name: 'गणेश ज्वेलर्स चाँदी पायल', categoryKey: 'Silver Items', metal: 'SILVER', purity: '925', grossWeightG: 35, makingPct: 0.10, withHuid: false },
  { sku: 'SG-SV-003', name: 'गणेश ज्वेलर्स चाँदी कंगन', categoryKey: 'Silver Items', metal: 'SILVER', purity: '925', grossWeightG: 28, makingPct: 0.10, withHuid: false },
];

function huid(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let h = '';
  for (let i = 0; i < 6; i++) h += chars[Math.floor(Math.random() * chars.length)];
  return h;
}

// Warm-brown storefront override — visibly distinct from anchor-dev's aged-gold.
const STOREFRONT_CONFIG = {
  heroBanners:           [],
  featuredCollectionIds: [],
  premiumCollectionIds:  [],
  giftPersonaOverrides:  [],
  brandPalette:          { accentMode: 'warm', heroPattern: 'devanagari-numerals' },
  trustPillarsOverride: [
    { titleHi: 'BIS हॉलमार्क',    titleEn: 'BIS Hallmark',    descriptionHi: 'शुद्धता की पूरी गारंटी' },
    { titleHi: 'HUID ट्रैकिंग',   titleEn: 'HUID Tracking',   descriptionHi: 'हर आभूषण का सरकारी ID' },
    { titleHi: 'पारिवारिक विश्वास', titleEn: 'Family Trust',    descriptionHi: 'तीन पीढ़ियों का अनुभव' },
    { titleHi: 'एक्सचेंज',         titleEn: 'Exchange',        descriptionHi: 'पुराने सोने पर उचित मूल्य' },
    { titleHi: 'बायबैक',           titleEn: 'Buyback',         descriptionHi: 'खरीदी कीमत की गारंटी' },
  ],
};

async function main(): Promise<void> {
  const slug         = process.env['SEED_2_SLUG']         ?? 'anchor-dev-2';
  const displayName  = process.env['SEED_2_DISPLAY_NAME'] ?? 'श्री गणेश ज्वेलर्स';
  const phone        = process.env['SEED_2_PHONE_E164'];
  if (!phone) throw new Error('SEED_2_PHONE_E164 required (e.g. +919xxxxxxxxx)');

  // Firebase admin init — gated on env var, identical to seed-anchor.ts pattern.
  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_JSON_B64'];
  if (b64 && admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(Buffer.from(b64, 'base64').toString('utf8')),
      ),
    });
  }

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

  // ── 1. Shop row ────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO shops (slug, display_name, status, config)
     VALUES ($1, $2, 'ACTIVE', $3)
     ON CONFLICT (slug) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       config       = EXCLUDED.config,
       updated_at   = now()`,
    [
      slug,
      displayName,
      JSON.stringify({
        primary_color:    '#8B4513', // warm brown — distinct from anchor-dev's #B58A3C
        secondary_color:  '#D4745A',
        logo_url:         '/assets/brand/placeholder-logo.svg',
        app_name:         displayName,
        default_language: 'hi-IN',
      }),
    ],
  );
  const shop = await pool.query<{ id: string }>(
    'SELECT id FROM shops WHERE slug = $1',
    [slug],
  );
  const shopId = shop.rows[0].id;

  // ── 2. Shop settings (includes storefront_config_json — migration 0069) ──
  await pool.query(
    `INSERT INTO shop_settings
       (shop_id, making_charges_json, wastage_json, loyalty_json,
        rate_lock_days, try_at_home_enabled, try_at_home_max_pieces,
        return_policy_text, custom_order_policy_text, dead_stock_threshold_days,
        storefront_config_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (shop_id) DO UPDATE SET
       storefront_config_json = EXCLUDED.storefront_config_json,
       updated_at = now()`,
    [
      shopId,
      JSON.stringify({ gold_rings: 12, gold_bangles: 8, silver: 10, default: 10 }),
      JSON.stringify({ default_pct: 2 }),
      JSON.stringify({
        tiers: [
          { name: 'bronze', name_hi: 'ब्रॉन्ज़', min_points: 0,    discount_pct: 0 },
          { name: 'silver', name_hi: 'सिल्वर',   min_points: 1000, discount_pct: 1 },
          { name: 'gold',   name_hi: 'गोल्ड',    min_points: 5000, discount_pct: 2 },
        ],
        accrual_rate: 1,
      }),
      7,
      true,
      5,
      'खरीदारी की तारीख से 7 दिन के अंदर वापसी स्वीकार की जाएगी।',
      'कस्टम ऑर्डर के लिए 30% अग्रिम भुगतान आवश्यक है। डिलीवरी 30-45 दिनों में।',
      180,
      JSON.stringify(STOREFRONT_CONFIG),
    ],
  );

  // ── 3. Owner invite (shop_users) ───────────────────────────────────────
  await pool.query(
    `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
     VALUES ($1, $2, $3, 'shop_admin', 'INVITED')
     ON CONFLICT (shop_id, phone) DO NOTHING`,
    [shopId, phone, 'Owner'],
  );

  // ── 4. Categories ──────────────────────────────────────────────────────
  const catIdMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM product_categories WHERE shop_id = $1 AND name = $2`,
      [shopId, cat.name],
    );
    if (existing.rows.length > 0) {
      catIdMap[cat.name] = existing.rows[0].id;
      continue;
    }
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO product_categories (shop_id, name, name_hi)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [shopId, cat.name, cat.name_hi],
    );
    catIdMap[cat.name] = inserted.rows[0].id;
  }

  // ── 5. Products (10) ──────────────────────────────────────────────────
  for (const p of PRODUCTS) {
    const netWeightG    = parseFloat((p.grossWeightG * 0.95).toFixed(4));
    const ratePaisePerG = p.metal === 'GOLD'
      ? GOLD_RATE_PAISE_PER_G
      : Math.round(GOLD_RATE_PAISE_PER_G * 0.07);
    const costPaise     = Math.round(netWeightG * ratePaisePerG * 0.60);

    await pool.query(
      `INSERT INTO products
         (shop_id, category_id, sku, metal, purity,
          gross_weight_g, net_weight_g, stone_weight_g,
          huid, huid_exemption_category,
          status, quantity, cost_paise,
          created_by_user_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       ON CONFLICT (shop_id, sku) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = now()`,
      [
        shopId,
        catIdMap[p.categoryKey],
        p.sku,
        p.metal,
        p.purity,
        p.grossWeightG.toFixed(4),
        netWeightG.toFixed(4),
        '0.0000',
        p.withHuid ? huid() : null,
        'none',
        'IN_STOCK',
        1,
        costPaise,
        SEED_USER_ID,
      ],
    );
  }

  const masked = phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  console.log(`✓ Seeded second-tenant shop "${slug}" (${shopId})`);
  console.log(`  display name: ${displayName}`);
  console.log(`  owner phone:  ${masked}`);
  console.log(`  products:     ${PRODUCTS.length}  (gold + silver mix)`);
  console.log(`  brand:        warm-brown (#8B4513)  — distinct from anchor-dev`);
  console.log('');
  console.log(`  Demo: rebuild customer-web with NEXT_PUBLIC_SHOP_SLUG=${slug}`);
  console.log(`        and verify trust pillars + accent palette diverge from anchor-dev.`);

  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
