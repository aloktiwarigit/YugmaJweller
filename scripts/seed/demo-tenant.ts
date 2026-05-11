/**
 * demo-tenant.ts — one-shot demo seed for Goldsmith dev DB.
 *
 * Populates: 1 shop, categories, 50 products, 20 customers, 30 invoices
 * (with line items + payments), shop settings, loyalty, 3 custom orders,
 * 2 rate-lock bookings, 2 try-at-home bookings.
 *
 * Usage:
 *   tsx scripts/seed/demo-tenant.ts
 *   FORCE_RESEED=1 tsx scripts/seed/demo-tenant.ts
 *
 * Connects directly to localhost dev DB — never touches production.
 */

import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DB = {
  host: process.env['PGHOST'] ?? 'localhost',
  port: parseInt(process.env['PGPORT'] ?? '55432', 10),
  database: process.env['PGDATABASE'] ?? 'goldsmith_dev',
  user: process.env['PGUSER'] ?? 'postgres',
  password: process.env['PGPASSWORD'] ?? 'postgres',
};

const DEMO_SHOP_NAME = 'श्री राम ज्वैलर्स';
const FORCE_RESEED = process.env['FORCE_RESEED'] === '1';

// A fake UUID to use as created_by_user_id (seed data, no real user required).
const SEED_USER_ID = '00000000-0000-0000-0000-000000000001';

// Gold rate for pricing calculations: ~₹7,400/g (24K, typical mid-2025 Ayodhya rate)
const GOLD_RATE_PAISE_PER_G = 740_000; // paise per gram

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a 6-char alphanumeric HUID (matches DB constraint ^[A-Z0-9]{6}$) */
function huid(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let h = '';
  for (let i = 0; i < 6; i++) h += chars[Math.floor(Math.random() * chars.length)];
  return h;
}

/** Compute a realistic B2C invoice breakdown from line items */
interface LineCalc {
  goldValuePaise: bigint;
  makingChargePaise: bigint;
  gstMetalPaise: bigint;
  gstMakingPaise: bigint;
  lineTotalPaise: bigint;
}

function calcLine(
  netWeightG: number,
  ratePaisePerG: number,
  makingPct: number, // e.g. 0.12
): LineCalc {
  const goldValuePaise = BigInt(Math.round(netWeightG * ratePaisePerG));
  const makingChargePaise = BigInt(Math.round(Number(goldValuePaise) * makingPct));
  // GST: 3% on metal, 5% on making
  const gstMetalPaise = BigInt(Math.round(Number(goldValuePaise) * 0.03));
  const gstMakingPaise = BigInt(Math.round(Number(makingChargePaise) * 0.05));
  const lineTotalPaise =
    goldValuePaise + makingChargePaise + gstMetalPaise + gstMakingPaise;
  return { goldValuePaise, makingChargePaise, gstMetalPaise, gstMakingPaise, lineTotalPaise };
}

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Gold Rings', name_hi: 'सोने की अंगूठी' },
  { name: 'Gold Bangles', name_hi: 'सोने की चूड़ियाँ' },
  { name: 'Silver Items', name_hi: 'चाँदी के आभूषण' },
  { name: 'Diamond Jewellery', name_hi: 'हीरे के गहने' },
  { name: 'Bridal Sets', name_hi: 'ब्राइडल सेट' },
];

interface ProductDef {
  sku: string;
  name: string; // used as description on invoice line
  metal: 'GOLD' | 'SILVER';
  purity: string;
  grossWeightG: number;
  categoryKey: string;
  withHuid: boolean;
  status: 'IN_STOCK' | 'SOLD';
  makingPct: number;
  soldDaysAgo?: number;
}

const PRODUCTS: ProductDef[] = [
  // 15 gold rings
  ...Array.from({ length: 15 }, (_, i) => ({
    sku: `GS-RG-${String(i + 1).padStart(3, '0')}`,
    name: `सोने की अंगूठी - डिज़ाइन ${i + 1}`,
    metal: 'GOLD' as const,
    purity: i < 8 ? '22K' : '18K',
    grossWeightG: randInt(3, 8),
    categoryKey: 'Gold Rings',
    withHuid: true,
    status: i < 12 ? ('IN_STOCK' as const) : ('SOLD' as const),
    makingPct: 0.12,
    soldDaysAgo: i >= 12 ? randInt(20, 60) : undefined,
  })),
  // 10 gold bangles
  ...Array.from({ length: 10 }, (_, i) => ({
    sku: `GS-BG-${String(i + 1).padStart(3, '0')}`,
    name: `सोने की चूड़ी - डिज़ाइन ${i + 1}`,
    metal: 'GOLD' as const,
    purity: '22K',
    grossWeightG: randInt(15, 30),
    categoryKey: 'Gold Bangles',
    withHuid: true,
    status: i < 8 ? ('IN_STOCK' as const) : ('SOLD' as const),
    makingPct: 0.08,
    soldDaysAgo: i >= 8 ? randInt(30, 55) : undefined,
  })),
  // 8 silver items
  ...Array.from({ length: 8 }, (_, i) => ({
    sku: `GS-SV-${String(i + 1).padStart(3, '0')}`,
    name: i < 4
      ? `चाँदी की चेन - डिज़ाइन ${i + 1}`
      : `चाँदी की पायल - डिज़ाइन ${i - 3}`,
    metal: 'SILVER' as const,
    purity: '925',
    grossWeightG: randInt(10, 50),
    categoryKey: 'Silver Items',
    withHuid: false, // silver typically not hallmarked with HUID
    status: 'IN_STOCK' as const,
    makingPct: 0.10,
  })),
  // 7 diamond pieces
  ...Array.from({ length: 7 }, (_, i) => ({
    sku: `GS-DM-${String(i + 1).padStart(3, '0')}`,
    name: i < 4
      ? `हीरे के बाली - डिज़ाइन ${i + 1}`
      : `हीरे का पेंडेंट - डिज़ाइन ${i - 3}`,
    metal: 'GOLD' as const,
    purity: '18K',
    grossWeightG: randInt(2, 5),
    categoryKey: 'Diamond Jewellery',
    withHuid: true,
    status: 'IN_STOCK' as const,
    makingPct: 0.15,
  })),
  // 5 bridal sets
  ...Array.from({ length: 5 }, (_, i) => ({
    sku: `GS-BD-${String(i + 1).padStart(3, '0')}`,
    name: `ब्राइडल ज्वैलरी सेट - ${['रुबी', 'एमरल्ड', 'पर्ल', 'क्लासिक', 'डायमंड'][i]}`,
    metal: 'GOLD' as const,
    purity: '22K',
    grossWeightG: randInt(40, 80),
    categoryKey: 'Bridal Sets',
    withHuid: true,
    status: 'IN_STOCK' as const,
    makingPct: 0.14,
  })),
  // 5 gold chains (misc — brings total to 50)
  ...Array.from({ length: 5 }, (_, i) => ({
    sku: `GS-GC-${String(i + 1).padStart(3, '0')}`,
    name: `सोने की चेन - डिज़ाइन ${i + 1}`,
    metal: 'GOLD' as const,
    purity: '22K',
    grossWeightG: randInt(8, 20),
    categoryKey: 'Gold Bangles', // re-use category; no separate "chains" category
    withHuid: true,
    status: 'IN_STOCK' as const,
    makingPct: 0.09,
  })),
];

const CUSTOMER_DATA = [
  { name: 'राम प्रसाद सिंह',    phone: '9415234567', city: 'Ayodhya' },
  { name: 'सुनीता देवी',         phone: '9839112233', city: 'Ayodhya' },
  { name: 'अनिल कुमार गुप्ता',  phone: '9721456789', city: 'Faizabad' },
  { name: 'शांति श्रीवास्तव',   phone: '9454321098', city: 'Lucknow' },
  { name: 'विजय शर्मा',          phone: '9336678901', city: 'Ayodhya' },
  { name: 'कमला देवी',           phone: '9956234501', city: 'Ayodhya' },
  { name: 'रमेश यादव',           phone: '9839900123', city: 'Faizabad' },
  { name: 'ममता पांडे',          phone: '9415567890', city: 'Lucknow' },
  { name: 'सुरेश कुमार तिवारी', phone: '9936112456', city: 'Ayodhya' },
  { name: 'रेखा मिश्रा',         phone: '9451098765', city: 'Ayodhya' },
  { name: 'हरी प्रसाद',          phone: '9721345678', city: 'Faizabad' },
  { name: 'साधना अग्रवाल',       phone: '9839456321', city: 'Lucknow' },
  { name: 'दिनेश चौरसिया',       phone: '9415876543', city: 'Ayodhya' },
  { name: 'उषा रानी',             phone: '9956109876', city: 'Ayodhya' },
  { name: 'महेश कुमार जायसवाल',  phone: '9454987654', city: 'Faizabad' },
  { name: 'प्रेमलता वर्मा',      phone: '9936543210', city: 'Lucknow' },
  { name: 'भोला नाथ',             phone: '9721876543', city: 'Ayodhya' },
  { name: 'निर्मला देवी',         phone: '9839567890', city: 'Ayodhya' },
  { name: 'शिव कुमार',            phone: '9415543210', city: 'Faizabad' },
  { name: 'गीता पाठक',            phone: '9451234567', city: 'Lucknow' },
];

// ---------------------------------------------------------------------------
// Main seed logic
// ---------------------------------------------------------------------------
async function seed(client: PoolClient): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Shop
  // -------------------------------------------------------------------------
  console.log('  [1/9] Seeding shop...');
  const shopRes = await client.query<{ id: string }>(
    `INSERT INTO shops (slug, display_name, status, config, gstin, contact_phone,
        address_json, logo_url, years_in_business)
     VALUES ('shri-ram-jewellers', $1, 'ACTIVE', $2, $3, $4, $5, NULL, 25)
     ON CONFLICT (slug) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       gstin = EXCLUDED.gstin,
       contact_phone = EXCLUDED.contact_phone,
       address_json = EXCLUDED.address_json,
       years_in_business = EXCLUDED.years_in_business,
       updated_at = now()
     RETURNING id`,
    [
      DEMO_SHOP_NAME,
      JSON.stringify({
        primary_color: '#B58A3C',
        secondary_color: '#D4745A',
        logo_url: null,
        app_name: DEMO_SHOP_NAME,
        default_language: 'hi-IN',
      }),
      '09AAACR5055K1Z5',
      '+919415000001',
      JSON.stringify({
        line1: 'राम घाट मार्ग, सरयू तट',
        line2: 'नया घाट',
        city: 'Ayodhya',
        state: 'Uttar Pradesh',
        pincode: '224123',
        country: 'IN',
      }),
    ],
  );
  const shopId = shopRes.rows[0].id;
  console.log(`     shop_id = ${shopId}`);

  // -------------------------------------------------------------------------
  // 2. Shop settings
  // -------------------------------------------------------------------------
  console.log('  [2/9] Seeding shop settings...');
  await client.query(
    `INSERT INTO shop_settings
       (shop_id, making_charges_json, wastage_json, loyalty_json, rate_lock_days,
        try_at_home_enabled, try_at_home_max_pieces, return_policy_text,
        custom_order_policy_text, dead_stock_threshold_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (shop_id) DO UPDATE SET
       making_charges_json = EXCLUDED.making_charges_json,
       wastage_json = EXCLUDED.wastage_json,
       loyalty_json = EXCLUDED.loyalty_json,
       rate_lock_days = EXCLUDED.rate_lock_days,
       try_at_home_enabled = EXCLUDED.try_at_home_enabled,
       try_at_home_max_pieces = EXCLUDED.try_at_home_max_pieces,
       return_policy_text = EXCLUDED.return_policy_text,
       custom_order_policy_text = EXCLUDED.custom_order_policy_text,
       updated_at = now()`,
    [
      shopId,
      JSON.stringify({
        gold_rings: 12,
        gold_bangles: 8,
        silver: 10,
        diamond: 15,
        bridal: 14,
        default: 10,
      }),
      JSON.stringify({ default_pct: 2 }),
      JSON.stringify({
        tiers: [
          { name: 'bronze', name_hi: 'ब्रॉन्ज़', min_points: 0,    discount_pct: 0 },
          { name: 'silver', name_hi: 'सिल्वर',   min_points: 1000,  discount_pct: 1 },
          { name: 'gold',   name_hi: 'गोल्ड',    min_points: 5000,  discount_pct: 2 },
        ],
        accrual_rate: 1, // 1 point per ₹100 spent
      }),
      7,
      true,
      5,
      'खरीदारी की तारीख से 7 दिन के अंदर वापसी स्वीकार की जाएगी। ' +
        'सोने और हीरे के गहनों पर बिल ज़रूरी है। ' +
        'कस्टम ऑर्डर वापस नहीं होंगे।',
      'कस्टम ऑर्डर के लिए 30% अग्रिम भुगतान आवश्यक है। ' +
        'डिलीवरी 30-45 दिनों में। ' +
        'कस्टम डिज़ाइन में बदलाव पहले 3 दिन में ही संभव।',
      180,
    ],
  );

  // -------------------------------------------------------------------------
  // 3. Product categories
  // -------------------------------------------------------------------------
  console.log('  [3/9] Seeding product categories...');
  const catIdMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO product_categories (shop_id, name, name_hi)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [shopId, cat.name, cat.name_hi],
    );
    if (r.rows.length === 0) {
      // already existed — fetch
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM product_categories WHERE shop_id = $1 AND name = $2`,
        [shopId, cat.name],
      );
      catIdMap[cat.name] = existing.rows[0].id;
    } else {
      catIdMap[cat.name] = r.rows[0].id;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Products (50 items)
  // -------------------------------------------------------------------------
  console.log('  [4/9] Seeding 50 products...');
  const productIds: string[] = [];
  const productMeta: Array<{
    id: string;
    netWeightG: number;
    makingPct: number;
    metal: string;
    purity: string;
    status: string;
    name: string;
  }> = [];

  for (const p of PRODUCTS) {
    const netWeightG = parseFloat((p.grossWeightG * 0.95).toFixed(4));
    const ratePaisePerG =
      p.metal === 'GOLD' ? GOLD_RATE_PAISE_PER_G : Math.round(GOLD_RATE_PAISE_PER_G * 0.07);
    const costPaise = Math.round(netWeightG * ratePaisePerG * 0.60); // ~60% of market value

    const r = await client.query<{ id: string }>(
      `INSERT INTO products
         (shop_id, category_id, sku, metal, purity,
          gross_weight_g, net_weight_g, stone_weight_g,
          huid, huid_exemption_category,
          status, quantity, cost_paise,
          created_by_user_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (shop_id, sku) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id`,
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
        p.status,
        p.status === 'IN_STOCK' ? 1 : 0,
        costPaise,
        SEED_USER_ID,
        daysAgo(randInt(3, 90)),
      ],
    );
    const id = r.rows[0].id;
    productIds.push(id);
    productMeta.push({ id, netWeightG, makingPct: p.makingPct, metal: p.metal, purity: p.purity, status: p.status, name: p.name });
  }
  console.log(`     inserted/updated ${productIds.length} products`);

  // -------------------------------------------------------------------------
  // 5. Customers (20)
  // -------------------------------------------------------------------------
  console.log('  [5/9] Seeding 20 customers...');
  const customerIds: string[] = [];
  for (const c of CUSTOMER_DATA) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO customers
         (shop_id, phone, name, city, state, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (shop_id, phone) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [shopId, c.phone, c.name, c.city, 'Uttar Pradesh', SEED_USER_ID],
    );
    customerIds.push(r.rows[0].id);
  }
  console.log(`     inserted/updated ${customerIds.length} customers`);

  // -------------------------------------------------------------------------
  // 6. Invoices (30) + line items + payments
  // -------------------------------------------------------------------------
  console.log('  [6/9] Seeding 30 invoices with line items and payments...');

  // Stock of IN_STOCK product metas to draw from for invoice lines
  const inStockProducts = productMeta.filter(p => p.status === 'IN_STOCK');

  let invoiceCount = 0;
  let invoiceItemCount = 0;
  let paymentCount = 0;

  for (let i = 0; i < 30; i++) {
    const issuedDaysAgo = randInt(1, 60);
    const issuedAt = daysAgo(issuedDaysAgo);
    const customerId = customerIds[i % customerIds.length];
    const customerData = CUSTOMER_DATA[i % CUSTOMER_DATA.length];
    const invoiceNumber = `INV-${String(i + 1).padStart(4, '0')}`;
    const idempotencyKey = `seed-${invoiceNumber}`;

    // 1–3 line items per invoice
    const lineCount = randInt(1, 3);
    const lines: LineCalc[] = [];
    const lineProducts: typeof productMeta[0][] = [];

    for (let l = 0; l < lineCount; l++) {
      const prod = inStockProducts[(i * 3 + l) % inStockProducts.length];
      const rate =
        prod.metal === 'GOLD' ? GOLD_RATE_PAISE_PER_G : Math.round(GOLD_RATE_PAISE_PER_G * 0.07);
      lines.push(calcLine(prod.netWeightG, rate, prod.makingPct));
      lineProducts.push(prod);
    }

    const subtotalPaise = lines.reduce(
      (s, l) => s + l.goldValuePaise + l.makingChargePaise,
      0n,
    );
    const gstMetalPaise = lines.reduce((s, l) => s + l.gstMetalPaise, 0n);
    const gstMakingPaise = lines.reduce((s, l) => s + l.gstMakingPaise, 0n);
    const totalPaise = subtotalPaise + gstMetalPaise + gstMakingPaise;

    // Insert invoice
    const invRes = await client.query<{ id: string }>(
      `INSERT INTO invoices
         (shop_id, invoice_number, invoice_type, customer_id, customer_name,
          customer_phone, status, subtotal_paise, gst_metal_paise, gst_making_paise,
          total_paise, idempotency_key, issued_at, created_by_user_id,
          seller_state_code, gst_treatment,
          cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
          igst_metal_paise, igst_making_paise, tcs_collected_paise)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        shopId,
        invoiceNumber,
        'B2C',
        customerId,
        customerData.name,
        customerData.phone,
        'ISSUED',
        subtotalPaise,
        gstMetalPaise,
        gstMakingPaise,
        totalPaise,
        idempotencyKey,
        issuedAt,
        SEED_USER_ID,
        '09',
        'CGST_SGST',
        gstMetalPaise / 2n,
        gstMetalPaise / 2n,
        gstMakingPaise / 2n,
        gstMakingPaise / 2n,
        0n,
        0n,
        0n,
      ],
    );

    if (invRes.rows.length === 0) {
      // Already exists (re-seed without FORCE), skip
      continue;
    }

    const invoiceId = invRes.rows[0].id;
    invoiceCount++;

    // Insert line items
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const prod = lineProducts[l];
      const rate =
        prod.metal === 'GOLD' ? GOLD_RATE_PAISE_PER_G : Math.round(GOLD_RATE_PAISE_PER_G * 0.07);

      await client.query(
        `INSERT INTO invoice_items
           (shop_id, invoice_id, product_id, description, hsn_code,
            metal_type, purity, net_weight_g, rate_per_gram_paise, making_charge_pct,
            gold_value_paise, making_charge_paise, gst_metal_paise, gst_making_paise,
            line_total_paise, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          shopId,
          invoiceId,
          prod.id,
          prod.name,
          '7113',
          prod.metal,
          prod.purity,
          prod.netWeightG.toFixed(4),
          BigInt(rate),
          (prod.makingPct * 100).toFixed(2),
          line.goldValuePaise,
          line.makingChargePaise,
          line.gstMetalPaise,
          line.gstMakingPaise,
          line.lineTotalPaise,
          l,
        ],
      );
      invoiceItemCount++;
    }

    // Payments: first 25 fully paid; last 5 partially or not paid
    const isFullyPaid = i < 25;
    if (isFullyPaid) {
      await client.query(
        `INSERT INTO payments
           (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
         VALUES ($1,$2,$3,$4,'CONFIRMED',$5,$6)`,
        [
          shopId,
          invoiceId,
          pick(['CASH', 'UPI', 'UPI', 'CARD']),
          totalPaise,
          SEED_USER_ID,
          `seed-pay-${invoiceNumber}`,
        ],
      );
      paymentCount++;
    } else if (i < 28) {
      // Partial payment (50%)
      const partialPaise = totalPaise / 2n;
      await client.query(
        `INSERT INTO payments
           (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
         VALUES ($1,$2,$3,$4,'CONFIRMED',$5,$6)`,
        [
          shopId,
          invoiceId,
          pick(['CASH', 'UPI']),
          partialPaise,
          SEED_USER_ID,
          `seed-pay-${invoiceNumber}`,
        ],
      );
      paymentCount++;
    }
    // Last 2 invoices: no payment (outstanding)
  }
  console.log(
    `     ${invoiceCount} invoices, ${invoiceItemCount} line items, ${paymentCount} payments`,
  );

  // -------------------------------------------------------------------------
  // 7. Loyalty transactions + customer_loyalty aggregate (8 customers)
  // -------------------------------------------------------------------------
  console.log('  [7/9] Seeding loyalty data for 8 customers...');
  const loyaltyCustomers = customerIds.slice(0, 8);
  let loyaltyTxCount = 0;

  for (let i = 0; i < loyaltyCustomers.length; i++) {
    const custId = loyaltyCustomers[i];
    // Determine tier by index: 0–2 bronze, 3–5 silver, 6–7 gold
    const lifetimePoints = i < 3 ? randInt(100, 900) : i < 6 ? randInt(1000, 4500) : randInt(5000, 9000);
    const pointsBalance = Math.round(lifetimePoints * 0.6); // some already redeemed
    const tier = lifetimePoints >= 5000 ? 'gold' : lifetimePoints >= 1000 ? 'silver' : 'bronze';

    // Insert loyalty_transactions — ACCRUAL row
    await client.query(
      `INSERT INTO loyalty_transactions
         (shop_id, customer_id, invoice_id, type, points_delta,
          balance_before, balance_after, reason, created_at)
       VALUES ($1,$2,NULL,'ACCRUAL',$3,0,$3,'Purchase accrual (seed)',now())`,
      [shopId, custId, pointsBalance],
    );
    loyaltyTxCount++;

    // Insert/update customer_loyalty aggregate
    await client.query(
      `INSERT INTO customer_loyalty
         (shop_id, customer_id, points_balance, lifetime_points, current_tier, tier_since)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (shop_id, customer_id) DO UPDATE SET
         points_balance = EXCLUDED.points_balance,
         lifetime_points = EXCLUDED.lifetime_points,
         current_tier = EXCLUDED.current_tier,
         tier_since = EXCLUDED.tier_since,
         last_updated_at = now()`,
      [shopId, custId, pointsBalance, lifetimePoints, tier],
    );
  }
  console.log(`     ${loyaltyTxCount} loyalty transactions, ${loyaltyCustomers.length} loyalty aggregates`);

  // -------------------------------------------------------------------------
  // 8. Custom orders (3)
  // -------------------------------------------------------------------------
  console.log('  [8/9] Seeding 3 custom orders...');
  const customOrderDefs = [
    {
      customerId: customerIds[0],
      description: 'सोने का ब्राइडल नेकलेस सेट — दुल्हन के लिए, 22K, बड़ा डिज़ाइन',
      quotedAmount: 850_000_00n, // ₹85,000 in paise
      depositAmount: 255_000_00n, // 30% deposit
      depositPaid: 255_000_00n,
      status: 'IN_PROGRESS',
      deliveryDaysFromNow: 25,
    },
    {
      customerId: customerIds[2],
      description: 'चाँदी की पूजा थाली और कलश — मंदिर के लिए',
      quotedAmount: 120_000_00n, // ₹12,000 in paise
      depositAmount: 36_000_00n,
      depositPaid: 36_000_00n,
      status: 'IN_PROGRESS',
      deliveryDaysFromNow: 10,
    },
    {
      customerId: customerIds[5],
      description: 'हीरे की अंगूठी — सगाई के लिए, 18K, VS1 clarity',
      quotedAmount: 1_800_000_00n, // ₹1,80,000 in paise
      depositAmount: 540_000_00n,
      depositPaid: 540_000_00n,
      status: 'IN_PROGRESS',
      deliveryDaysFromNow: 18,
    },
  ];

  for (const co of customOrderDefs) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + co.deliveryDaysFromNow);
    await client.query(
      `INSERT INTO custom_orders
         (shop_id, customer_id, description, quoted_amount_paise,
          deposit_amount_paise, deposit_paid_paise, status, estimated_delivery_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        shopId,
        co.customerId,
        co.description,
        co.quotedAmount,
        co.depositAmount,
        co.depositPaid,
        co.status,
        deliveryDate.toISOString().slice(0, 10),
      ],
    );
  }
  console.log('     3 custom orders seeded');

  // -------------------------------------------------------------------------
  // 9. Rate-lock bookings (2) + try-at-home bookings (2)
  // -------------------------------------------------------------------------
  console.log('  [9/9] Seeding rate-lock and try-at-home bookings...');

  const lockedAt = daysAgo(3);
  const expiresAt = new Date(lockedAt);
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Rate-lock 1: ACTIVE
  await client.query(
    `INSERT INTO rate_lock_bookings
       (shop_id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
        deposit_amount_paise, deposit_paid_paise, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')`,
    [shopId, customerIds[1], BigInt(GOLD_RATE_PAISE_PER_G), lockedAt, expiresAt, 50000n, 50000n],
  );

  // Rate-lock 2: USED
  const usedLockedAt = daysAgo(14);
  const usedExpiresAt = new Date(usedLockedAt);
  usedExpiresAt.setDate(usedExpiresAt.getDate() + 7);
  await client.query(
    `INSERT INTO rate_lock_bookings
       (shop_id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
        deposit_amount_paise, deposit_paid_paise, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'USED')`,
    [shopId, customerIds[3], BigInt(GOLD_RATE_PAISE_PER_G - 2000), usedLockedAt, usedExpiresAt, 50000n, 50000n],
  );

  // Try-at-home 1: DISPATCHED (products are RESERVED/ON_APPROVAL in real flow — using
  // RESERVED status products; pick first 2 IN_STOCK product IDs for this booking)
  const tahProductIds = productIds.slice(0, 2);
  const dispatchAt = daysAgo(2);
  const returnDueAt = new Date();
  returnDueAt.setDate(returnDueAt.getDate() + 3);
  await client.query(
    `INSERT INTO try_at_home_bookings
       (shop_id, customer_id, product_ids, status, requested_at, dispatch_at, return_due_at, notes)
     VALUES ($1,$2,$3,'DISPATCHED',$4,$4,$5,$6)`,
    [shopId, customerIds[4], tahProductIds, dispatchAt, returnDueAt, 'ग्राहक को 2 अंगूठी परीक्षण हेतु भेजी गई'],
  );

  // Try-at-home 2: RETURNED
  const returnedRequestedAt = daysAgo(15);
  const returnedReturnDue = new Date(returnedRequestedAt);
  returnedReturnDue.setDate(returnedReturnDue.getDate() + 5);
  await client.query(
    `INSERT INTO try_at_home_bookings
       (shop_id, customer_id, product_ids, status, requested_at, dispatch_at, return_due_at)
     VALUES ($1,$2,$3,'RETURNED',$4,$4,$5)`,
    [shopId, customerIds[7], [productIds[5]], returnedRequestedAt, returnedReturnDue],
  );

  console.log('     2 rate-lock bookings, 2 try-at-home bookings seeded');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const pool = new Pool({ ...DB });

  // Probe connection
  await pool.query('SELECT 1');
  console.log(`Connected to ${DB.host}:${DB.port}/${DB.database}`);

  // Check if demo shop already exists
  const existing = await pool.query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM shops WHERE display_name = $1 LIMIT 1`,
    [DEMO_SHOP_NAME],
  );

  if (existing.rows.length > 0 && !FORCE_RESEED) {
    console.log(
      `\nDemo shop "${DEMO_SHOP_NAME}" already exists (id=${existing.rows[0].id}).`,
    );
    console.log('Set FORCE_RESEED=1 to re-seed over existing data.\n');
    await pool.end();
    return;
  }

  if (FORCE_RESEED && existing.rows.length > 0) {
    console.log(`FORCE_RESEED=1: wiping existing demo data for shop ${existing.rows[0].id}...`);
    const shopId = existing.rows[0].id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete in reverse dependency order (FK-safe: children before parents).
      //
      // Intentionally NOT deleted (rows accumulate across reseeds — see notes below):
      //   - audit_events         : SECURITY DEFINER immutability trigger + ON DELETE RESTRICT
      //                            on shops(id). Seed upserts the shop row via ON CONFLICT.
      //   - stock_movements      : SECURITY DEFINER immutability trigger (PMLA 5-yr retention).
      //   - loyalty_transactions : SECURITY DEFINER immutability trigger.
      //   - customers            : loyalty_transactions.customer_id is NOT NULL FK pointing here;
      //                            since loyalty_transactions is immutable, customers cannot be
      //                            deleted either. Seed upserts via ON CONFLICT (shop_id, phone).
      //   - shops (row itself)   : blocked by audit_events ON DELETE RESTRICT (see above).

      // ── Leaf tables (no FK children) ──────────────────────────────────────
      await client.query(`DELETE FROM try_at_home_bookings    WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM rate_lock_bookings      WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM wishlists               WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM product_reviews         WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM product_views           WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM viewing_consent         WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM customer_occasions      WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM customer_notes          WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM customer_balances       WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM family_members          WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM pmla_aggregates         WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM urd_purchases           WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM credit_notes            WHERE shop_id = $1`, [shopId]);

      // ── Custom orders (milestones are children) ───────────────────────────
      await client.query(`DELETE FROM custom_order_milestones WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM custom_orders           WHERE shop_id = $1`, [shopId]);

      // ── Loyalty (only the mutable aggregate; loyalty_transactions is immutable) ──
      await client.query(`DELETE FROM customer_loyalty        WHERE shop_id = $1`, [shopId]);
      // NOTE: loyalty_transactions rows accumulate across reseeds (immutable).
      // The seed inserts them with invoice_id=NULL so the unique-accrual index
      // (shop_id, invoice_id WHERE type='ACCRUAL') does not block re-insertion.

      // ── Billing stack (payments + items depend on invoices) ───────────────
      await client.query(`DELETE FROM payments                WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM invoice_items           WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM invoices                WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM estimates               WHERE shop_id = $1`, [shopId]);

      // ── Inventory (product_images depend on products; categories on shop) ─
      await client.query(`DELETE FROM product_images          WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM products                WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM product_categories      WHERE shop_id = $1`, [shopId]);
      // NOTE: customers rows are intentionally NOT deleted here.
      // loyalty_transactions.customer_id is NOT NULL and loyalty_transactions is immutable,
      // so deleting customers would violate the FK. The seed upserts customers via
      // ON CONFLICT (shop_id, phone) DO UPDATE, preserving IDs for immutable-table references.

      // ── Sync infra ────────────────────────────────────────────────────────
      await client.query(`DELETE FROM sync_change_log         WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM tenant_sync_cursors     WHERE shop_id = $1`, [shopId]);

      // ── Rate overrides ────────────────────────────────────────────────────
      await client.query(`DELETE FROM shop_rate_overrides     WHERE shop_id = $1`, [shopId]);

      // ── Staff + permissions ───────────────────────────────────────────────
      await client.query(`DELETE FROM role_permissions        WHERE shop_id = $1`, [shopId]);
      await client.query(`DELETE FROM shop_users              WHERE shop_id = $1`, [shopId]);

      // ── Shop-level settings (RESTRICT FK; must come after all children) ───
      await client.query(`DELETE FROM shop_settings           WHERE shop_id = $1`, [shopId]);

      // NOTE: shops row is intentionally NOT deleted here.
      // audit_events has an immutable SECURITY DEFINER trigger and ON DELETE RESTRICT
      // on shops(id), so deleting the shop row would fail if any audit rows exist.
      // The main seed block uses ON CONFLICT DO UPDATE to upsert over the existing row.

      await client.query('COMMIT');
      console.log('  Wipe complete.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Run seed in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\nSeeding demo tenant...\n');
    await seed(client);
    await client.query('COMMIT');
    console.log('\nSeed complete. Summary:');
    console.log('  Shop:              1  (श्री राम ज्वैलर्स)');
    console.log('  Categories:        5');
    console.log('  Products:          50  (gold rings, bangles, silver, diamond, bridal, chains)');
    console.log('  Customers:         20  (Ayodhya + Faizabad + Lucknow)');
    console.log('  Invoices:          30  (25 fully paid, 3 partial, 2 outstanding)');
    console.log('  Loyalty customers: 8   (bronze/silver/gold mix)');
    console.log('  Custom orders:     3   (IN_PROGRESS)');
    console.log('  Rate-lock:         2   (1 ACTIVE, 1 USED)');
    console.log('  Try-at-home:       2   (1 DISPATCHED, 1 RETURNED)');
    console.log('\nReady for demo. Launch the shopkeeper app and log in.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
