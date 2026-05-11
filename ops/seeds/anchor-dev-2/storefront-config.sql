-- ops/seeds/anchor-dev-2/storefront-config.sql
--
-- Manually upsert the storefront_config_json for the anchor-dev-2 tenant.
-- Run this AFTER scripts/seed-anchor-dev-2.ts has created the shop row.
--
-- Usage (psql):
--   psql "$DATABASE_URL" -f ops/seeds/anchor-dev-2/storefront-config.sql
--
-- The shop_settings row already exists after the seed script. This file
-- exists as a pure-SQL fallback for ops engineers who want to re-tune the
-- storefront config without re-running the full TypeScript seeder
-- (e.g. swap accentMode, edit trust pillars, point hero banners at new
-- uploaded images post-image-pipeline).

UPDATE shop_settings
SET
  storefront_config_json = '{
    "heroBanners":           [],
    "featuredCollectionIds": [],
    "premiumCollectionIds":  [],
    "giftPersonaOverrides":  [],
    "brandPalette":          { "accentMode": "warm", "heroPattern": "devanagari-numerals" },
    "trustPillarsOverride": [
      { "titleHi": "BIS हॉलमार्क",     "titleEn": "BIS Hallmark",   "descriptionHi": "शुद्धता की पूरी गारंटी" },
      { "titleHi": "HUID ट्रैकिंग",    "titleEn": "HUID Tracking",  "descriptionHi": "हर आभूषण का सरकारी ID" },
      { "titleHi": "पारिवारिक विश्वास", "titleEn": "Family Trust",   "descriptionHi": "तीन पीढ़ियों का अनुभव" },
      { "titleHi": "एक्सचेंज",          "titleEn": "Exchange",       "descriptionHi": "पुराने सोने पर उचित मूल्य" },
      { "titleHi": "बायबैक",            "titleEn": "Buyback",        "descriptionHi": "खरीदी कीमत की गारंटी" }
    ]
  }'::jsonb,
  updated_at = now()
WHERE shop_id = (SELECT id FROM shops WHERE slug = 'anchor-dev-2');

-- Also update the shops.config brand colours so the customer-web header
-- and the customer-mobile drawer pick up the warm-brown palette.
UPDATE shops
SET
  config = jsonb_build_object(
    'primary_color',    '#8B4513',
    'secondary_color',  '#D4745A',
    'logo_url',         '/assets/brand/placeholder-logo.svg',
    'app_name',         'श्री गणेश ज्वेलर्स',
    'default_language', 'hi-IN'
  ),
  updated_at = now()
WHERE slug = 'anchor-dev-2';

-- Verify (run separately):
--   SELECT slug, display_name, config->>'primary_color' AS color
--   FROM shops WHERE slug = 'anchor-dev-2';
--   SELECT shop_id, storefront_config_json->'brandPalette' AS palette
--   FROM shop_settings ss
--   JOIN shops s ON s.id = ss.shop_id
--   WHERE s.slug = 'anchor-dev-2';
