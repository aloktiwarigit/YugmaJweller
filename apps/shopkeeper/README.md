# Goldsmith Shopkeeper - Expo

Dev Client app for the anchor jeweller shopkeeper. See `docs/runbook.md` for first-run setup.

## Quick Start

1. Place required fonts per `assets/fonts/FONTS-TODO.md`.
2. Download `google-services.json` from Firebase console (`goldsmith-dev`) and place it in this directory.
3. Copy `.env.example` to `.env.local` when you need to override local defaults.
4. Run `pnpm install` at repo root.
5. Run `pnpm --filter @goldsmith/shopkeeper start`.

## Local Production Android Builds

Shopkeeper production builds do not use EAS. They follow the same local Gradle
release path as customer-mobile.

Production build inputs:

- `apps/shopkeeper/.env.production`: local, gitignored production values.
- `apps/shopkeeper/android/app/google-services.json`: Firebase Android config,
  generated with Firebase CLI and gitignored.
- Azure Key Vault signing secrets referenced by `.env.production`.

Build an Android App Bundle for Play Console:

```powershell
pnpm deploy:shopkeeper-release -- -Aab -BuildOnly
```

Build and install a release APK on a connected device:

```powershell
pnpm deploy:shopkeeper-release
```

Production builds fail fast when `APP_ENV=production` and required values are
missing. Required values are documented in `.env.production.example`.

The current release mirrors customer-mobile's Firebase/API setup:

- Android package: `com.goldsmith.shopkeeper`
- Firebase project: `goldsmith-dev`
- Firebase Android app: `1:528920018833:android:12db8e62cd0877dce3e430`
- API: `https://goldsmith-api-528920018833.asia-south1.run.app`

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
