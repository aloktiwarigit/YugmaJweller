# Production Storefront Content Seed

Use this when the production customer app points at a shop slug that needs the curated storefront catalogue, image-backed collections, and storefront settings.

Do not run the local demo seed directly against production. The production path is guarded and dry-runs by default.

## Current Target

The customer mobile production env currently points at:

```text
EXPO_PUBLIC_SHOP_SLUG=anchor-dev
```

Local device testing used `anchor-dev-2`. Do not seed `anchor-dev-2` into production unless that slug is intentionally promoted.

## Dry Run

Set the production database URL and an existing active shop user for the target shop. The uploader can be provided by id or phone.

```powershell
$env:DATABASE_URL_ADMIN = "<production database url>"
$env:STOREFRONT_SHOP_SLUG = "anchor-dev"
$env:STOREFRONT_UPLOADER_PHONE_E164 = "+91..."
$env:STOREFRONT_PROD_SEED_CONFIRM = "seed-prod-storefront:anchor-dev"

pnpm run seed:storefront-prod-content
```

Expected result: the script prints products, images, collections, and `transaction: rolled back (dry run)`.

## Apply

Only after the dry run succeeds with the expected target shop:

```powershell
pnpm run seed:storefront-prod-content -- --apply
```

The same environment variables from the dry run must still be set.

## Guardrails

- Production mode requires `STOREFRONT_SHOP_SLUG`.
- Production mode requires `STOREFRONT_PROD_SEED_CONFIRM=seed-prod-storefront:<slug>`.
- Production mode requires `DATABASE_URL_ADMIN` or `DATABASE_URL`.
- If the database URL points at localhost, production mode requires `STOREFRONT_ALLOW_LOCAL_DB=1`. Use this only for local validation dry-runs.
- Production mode requires an existing active `shop_users` record via `STOREFRONT_UPLOADER_USER_ID` or `STOREFRONT_UPLOADER_PHONE_E164`.
- The script does not create the demo curator in production mode.
- The script does not generate synthetic HUID values in production mode unless `STOREFRONT_ALLOW_SYNTHETIC_HUIDS=1` or `--allow-synthetic-huids` is provided. Do not enable this for a real production catalogue.
- The script does not hide image-less non-demo products in production mode unless `STOREFRONT_HIDE_IMAGELESS_PLACEHOLDERS=1` or `--hide-imageless-placeholders` is provided. Review the target shop before enabling this.

## After Apply

Verify the production API and app against the seeded slug:

```powershell
Invoke-RestMethod "https://goldsmith-api-528920018833.asia-south1.run.app/v1/customer/catalog/products?shopSlug=anchor-dev&limit=8" | ConvertTo-Json -Depth 6
Invoke-RestMethod "https://goldsmith-api-528920018833.asia-south1.run.app/v1/customer/catalog/collections?shopSlug=anchor-dev" | ConvertTo-Json -Depth 6
```

Then rebuild/install the production customer mobile app if the installed build still points at an older environment.
