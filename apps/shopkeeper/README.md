# Goldsmith Shopkeeper - Expo

Dev Client app for the anchor jeweller shopkeeper. See `docs/runbook.md` for first-run setup.

## Quick Start

1. Place required fonts per `assets/fonts/FONTS-TODO.md`.
2. Download `google-services.json` from Firebase console (`goldsmith-dev`) and place it in this directory.
3. Copy `.env.example` to `.env.local` when you need to override local defaults.
4. Run `pnpm install` at repo root.
5. Run `pnpm --filter @goldsmith/shopkeeper start`.

## EAS Builds

Checked-in profiles live in `eas.json`:

- `development`: internal dev-client builds.
- `preview`: internal preview builds.
- `production`: store-ready production builds.

Development and preview builds keep local ergonomics: when env vars are omitted, `app.config.ts` falls back to dev package IDs, `goldsmith-dev`, `http://10.0.2.2:3000`, `anchor-dev`, and the placeholder EAS project ID.

Production builds fail fast when `EAS_BUILD_PROFILE=production` and any required production value is missing or still points at a dev default. Configure these as EAS environment variables before running `eas build --profile production`:

- `EXPO_PUBLIC_API_BASE_URL`: production API URL. Must not be `localhost` or `10.0.2.2`.
- `EXPO_PUBLIC_TENANT_SLUG`: production tenant slug. Must not be `anchor-dev` or end in `-dev`.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: must be `goldsmith-prod`.
- `EXPO_PUBLIC_FIREBASE_API_KEY`: Firebase web/native API key used by app runtime config.
- `EXPO_PUBLIC_FIREBASE_APP_ID`: Firebase app ID used by app runtime config.
- `EXPO_PUBLIC_ANDROID_PACKAGE`: production Android package, for example `com.goldsmith.shopkeeper`.
- `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`: production iOS bundle identifier, for example `com.goldsmith.shopkeeper`.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: real EAS project UUID.

Production native Firebase files must also match the production Firebase project:

- `google-services.json` for Android.
- `GoogleService-Info.plist` for iOS builds.

## App and Store Assets

Expo launcher, adaptive icon, splash, and favicon assets live in `assets/app/`.
Google Play listing graphics live in `assets/play-store/`.

Created Play Store assets:

- `assets/play-store/app-icon-512.png`: 512x512 high-resolution app icon.
- `assets/play-store/feature-graphic-1024x500.png`: 1024x500 feature graphic.

Play Store screenshots must be captured from the real release build before upload. Use
at least two phone screenshots, and prefer four 1080x1920 portrait screenshots for
better Play Store eligibility.

## Screens

- `(auth)/phone`: phone entry.
- `(auth)/otp`: OTP verification.
- `(tabs)/`: post-auth dashboard and modules.
