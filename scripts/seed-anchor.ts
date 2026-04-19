import 'dotenv/config';
import { Pool } from 'pg';
import admin from 'firebase-admin';

async function main() {
  const slug = process.env['SEED_ANCHOR_SLUG'] ?? 'anchor-dev';
  const displayName = process.env['SEED_ANCHOR_DISPLAY_NAME'] ?? 'अयोध्या स्वर्णकार';
  const phone = process.env['SEED_ANCHOR_PHONE_E164'];
  if (!phone) throw new Error('SEED_ANCHOR_PHONE_E164 required');

  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_JSON_B64'];
  if (b64) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
  }

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  await pool.query(
    `INSERT INTO shops (slug, display_name, status, config)
     VALUES ($1, $2, 'ACTIVE', $3)
     ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
    [slug, displayName, JSON.stringify({
      primary_color: '#B58A3C', secondary_color: '#D4745A',
      logo_url: '/assets/brand/placeholder-logo.svg',
      app_name: displayName, default_language: 'hi-IN',
    })],
  );
  const shop = await pool.query<{ id: string }>('SELECT id FROM shops WHERE slug = $1', [slug]);
  const shopId = shop.rows[0].id;
  await pool.query(
    `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
     VALUES ($1, $2, $3, 'shop_admin', 'INVITED')
     ON CONFLICT (shop_id, phone) DO NOTHING`,
    [shopId, phone, 'Owner'],
  );

  const masked = phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  console.log(`✓ Seeded anchor shop "${slug}" (${shopId}) with owner phone ${masked}`);
  console.log(`  Open Expo Dev Client, enter <your phone>, receive OTP, verify — you should land on the dashboard.`);
  console.log(`  Firebase emulator console: http://localhost:4000`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
