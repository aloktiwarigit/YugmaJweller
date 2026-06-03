# Google Play Listing - Shopkeeper App

Prepared: 2026-05-24

This file is the paste-ready listing package for the shopkeeper Android app. It is scoped to
the production Google Play listing, not internal testing.

## Recommended App Details

App name:

```text
Ayodhya Swarnkar Manager
```

Fallback if you want the Play title to exactly match the current Expo app label:

```text
Ayodhya Swarnkar
```

Short description:

```text
Billing, inventory, CRM, and jewellery reports for shop teams
```

Full description:

```text
Ayodhya Swarnkar Manager helps jewellery shop owners and staff run daily store operations from one mobile app.

Use the app to prepare estimates and invoices, search inventory, track customer records, review outstanding balances, and keep shop reports close at hand. The app is built for Indian jewellery workflows, including gold and jewellery billing, product inventory, rate-lock bookings, custom orders, try-at-home operations, loyalty records, and GSTR export support.

Key features:

- Create bills, estimates, and old-gold purchase entries
- Search jewellery inventory and manage product records
- Track customers, purchase history, notes, occasions, and balances
- Review rate-lock, try-at-home, custom order, and review workflows
- View daily sales, outstanding payments, loyalty, customer LTV, and GSTR reports
- Use role-based access for owners, managers, and staff

This app is for authorised Ayodhya Swarnkar shop users only. A valid shop account is required. It is not a public jewellery shopping app.
```

Suggested category:

```text
Business
```

Suggested tags to consider in Play Console:

```text
Inventory management
Invoicing
CRM
Business management
```

Default language:

```text
English (United States)
```

Recommended localization after the English listing is approved:

```text
Hindi (India)
```

## Graphics To Upload

Upload these first:

```text
apps/shopkeeper/assets/play-store/app-icon-512.png
apps/shopkeeper/assets/play-store/feature-graphic-1024x500.png
```

Asset audit:

- `app-icon-512.png`: 512x512, about 97 KB. Meets Play icon dimensions and size.
- `feature-graphic-1024x500.png`: 1024x500, about 44 KB. Meets Play feature graphic dimensions.

Current screenshots need one correction before production upload:

- Existing `final-*.png` screenshots are 1080x2400.
- Google Play's screenshot rule says the long side cannot be more than twice the short side.
- 2400 is more than 2 x 1080, so prepare cropped/exported 1080x1920 screenshots before upload.

Recommended screenshot set after re-exporting/cropping to 1080x1920:

```text
final-home.png
final-billing.png
final-inventory.png
final-reports.png
final-more.png
```

Suggested alt text:

```text
Home dashboard with billing, inventory, customer, rate-lock, and reports shortcuts.
Billing screen with bill, estimate, old-gold purchase, and barcode scan actions.
Inventory screen showing jewellery item search and product management.
Reports screen with daily sales, outstanding payments, loyalty, and GSTR options.
More screen with customer, custom order, try-at-home, reviews, and settings links.
```

## Store Settings

App type:

```text
App
```

Free or paid:

```text
Free
```

Distribution:

```text
India only for first production release, unless the business has a reason to support more countries.
```

Audience:

```text
Business users / shop staff. Not designed for children.
```

Ads declaration:

```text
No ads
```

External marketing:

```text
Turn off for the first release if this is meant for authorised shop users only.
```

App access:

```text
All core functionality requires login. Provide Google Play reviewers with a test account,
test phone/OTP path, or reviewer instructions for the configured production tenant.
```

Suggested reviewer note:

```text
This is a shop operations app for authorised jewellery store staff. Most screens require a provisioned shop user. Please use the provided reviewer account to access billing, inventory, customer, reports, and settings screens.
```

## URLs Needed Before Submission

Required:

```text
Privacy policy URL
Account deletion URL, if in-app account creation remains enabled
Support email
```

Recommended:

```text
Website URL
Support phone
Support website/contact form
```

Important policy note:

- The app currently exposes email sign-up in `apps/shopkeeper/app/(auth)/email.tsx`.
- Google Play requires an in-app and web path to request account deletion when an app allows users to create accounts.
- Either add a shopkeeper account deletion/request flow before production, or remove/disable in-app account creation and rely only on provisioned staff accounts.

## Data Safety Draft

Treat this as a draft for legal/product review, not a final certification.

Likely collected data:

- Personal info: name, phone number, email address, user IDs, staff role.
- Financial info: invoices, estimates, payments, outstanding balances, loyalty balances, old-gold purchase records.
- Photos and videos: product images uploaded through inventory workflows.
- Files and docs: CSV imports and report exports if selected through document workflows.
- App activity: screens viewed, feature usage, product/customer analytics.
- App info and performance: crash diagnostics, device/app version, logs needed for security and reliability.

Likely purposes:

- App functionality
- Account management
- Analytics
- Fraud prevention, security, and compliance
- Developer communications and support

Likely sharing / processors to review:

- Firebase Authentication / Google Sign-In
- Backend API and hosting providers
- PostHog, if `EXPO_PUBLIC_POSTHOG_API_KEY` is enabled in production
- Image/file storage providers
- SMS/OTP provider, if used for production authentication

Security answers to confirm:

- Data is encrypted in transit.
- Account deletion/request process is available.
- Privacy policy explains retention for invoices, audit logs, tax records, PMLA/GST records, and other legally retained data.

## Production Release Blockers Found Locally

Target SDK:

- Android config is set to `compileSdkVersion 35` / `targetSdkVersion 35`.
- Keep this at API 35+ for Play upload.

16 KB page size:

- New apps and updates targeting Android 15+ must support 16 KB page sizes on 64-bit devices.
- This React Native app includes native libraries, so the production AAB should be checked with Android Studio APK Analyzer or Google's 16 KB alignment checks before upload.

Screenshot ratio:

- Existing phone screenshots are 1080x2400 and should be re-exported/cropped to 1080x1920 or another allowed ratio.

Account deletion:

- In-app email sign-up exists.
- A shopkeeper account deletion/request path is not visible in `apps/shopkeeper/app/settings/account.tsx`; only logout-all is present.
- Add deletion support or remove in-app account creation before production.

Production package/app identity:

- Production builds use `EXPO_PUBLIC_ANDROID_PACKAGE=com.goldsmith.shopkeeper`.
- The local Gradle release path is documented in `apps/shopkeeper/README.md`.

## Play Console Path

1. Create app in Play Console.
2. Set app type to App, pricing to Free, and default language to English (United States).
3. Fill App details with the app name, short description, and full description above.
4. Upload app icon and feature graphic.
5. Upload corrected phone screenshots.
6. Complete Store settings, App access, Ads, Content rating, Target audience, News apps declaration, Data safety, and Privacy policy.
7. Add account deletion URL if account creation remains available.
8. Upload the production AAB only after package ID, signing, Firebase, and 16 KB checks pass.

## Official References

- Store listing text limits: https://support.google.com/googleplay/android-developer/answer/9859152
- Preview asset requirements: https://support.google.com/googleplay/android-developer/answer/9866151
- User Data, privacy policy, and account deletion policy: https://support.google.com/googleplay/android-developer/answer/16933379
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Target API level requirement: https://developer.android.com/google/play/requirements/target-sdk
- 16 KB page size requirement: https://developer.android.com/guide/practices/page-sizes
