<!--
PR body for branch feat/try-on-plan3 → main.
Title: feat(try-on): shopkeeper admin + mobile — Virtual Try-On Plan 3 of 3
Push:  git push -u origin feat/try-on-plan3
Open:  gh pr create --title "feat(try-on): shopkeeper admin + mobile — Virtual Try-On Plan 3 of 3" --body-file docs/try-on-plan3-pr-body.md --base main
NOTE:  do NOT merge until the runtime smoke (Class A floor) below passes.
-->

## Summary

Final plan (3 of 3) of the CaratLane-style Virtual Try-On feature. Plans 1
(foundation: migration 0077, `@goldsmith/try-on-core`, rembg cutout worker,
`GET /catalog/products/:id/try-on`) and 2 (web try-on UI) are already on `main`.
This PR closes the loop so products render **true-to-size** instead of always
falling back to the approximate path, and brings try-on to customer-mobile.

## What's included

**WS-A — Shopkeeper admin (makes true-to-size work)**
- New tenant-isolated API `GET/PATCH /api/v1/inventory/products/:id/try-on-asset`
  (anchor + enabled). RLS-scoped via `withTenantTx`, `@Roles('shop_admin','shop_manager')`,
  and an `enabled = ($3 AND status='ready')` guard so an overlay can't be published
  without a ready cutout.
- `TryOnDimensionsField` (Hindi body-part picker + mm presets) on the create/edit
  screens; dedicated `inventory/[id]/try-on.tsx` anchor-nudge screen (tap-to-place +
  large arrow buttons, 48dp targets, senior-friendly). mm dimensions now surfaced in
  `ProductResponse` for a full create→edit round-trip.

**WS-F — Mobile try-on (WebView reusing the web build)**
- Fullscreen chrome-less customer-web route `/products/[id]/try-on-wv`.
- `react-native-webview` + `webBaseUrl` config; `app/browse/try-on/[id].tsx` screen
  with OS camera-permission handling and a PDP CTA.

**WS-G — Privacy & gates**
- Privacy-policy try-on section + `docs/app-store-privacy.md` data-safety labels.

## Security

The customer-mobile WebView is **origin-locked** to the configured `webBaseUrl`
(`onShouldStartLoadWithRequest` compares scheme+host+port via `new URL`, not a string
prefix) so the auto-granted camera can't reach a foreign origin. Two HIGH findings from
automated review were fixed in-branch; an independent security review found 0 remaining
issues. `.security-review-passed` marker committed.

## Testing

- Package typechecks green: shared, api, shopkeeper, customer-web, customer-mobile.
- Unit/contract tests green: shared (UpdateTryOnAssetSchema), api `inventory.service`
  (getTryOnAsset/updateTryOnAsset incl. ready-guard), shopkeeper (`tryOnPresets`,
  `TryOnDimensionsField`), customer-web (`try-on-wv-client`).
- `try-on-admin.tenant-isolation.spec.ts` added (cross-tenant denial + ready-guard);
  runs under testcontainers in CI (Docker unavailable on dev host).
- Semgrep no-egress invariant holds for try-on files.

## Documented deviations

- Anchor editor is a dedicated `inventory/[id]/try-on.tsx` (not folded into the
  image-reorder `images.tsx`).
- Mobile screen is `browse/try-on/[id].tsx` (not `browse/[id]/try-on.tsx`) to avoid
  expo-router collision with the existing PDP file.
- `InventoryService` gains an `IMAGEKIT_URL_BUILDER` constructor arg (already provided
  in `InventoryModule`); all instantiation sites updated.

## Not in this PR (tracked / pre-merge)

- **Runtime smoke (Class A floor — required before merge):** browser tracking of all
  four categories, on-device WebView, and the zero-camera-frame egress devtools check.
  `getUserMedia` needs a secure context — HTTPS host or `adb reverse` + `localhost`.
- Lighthouse/axe on the PDP; `pnpm docs:context` regen on a clean tree.
- Codex cross-model review.
- 5 minor polish items in already-merged Plan 1/2 code, filed in `docs/try-on-followups.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
