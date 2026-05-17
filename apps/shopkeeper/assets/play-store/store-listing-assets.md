# Google Play Store Listing Assets

## Created

- `app-icon-512.png`: 512x512 PNG with alpha, under 1024 KB.
- `feature-graphic-1024x500.png`: 1024x500 PNG with no alpha.

## Pending From Release Build

Capture real phone screenshots after installing a release APK. Google Play requires
at least two screenshots across supported device types. For better app discovery,
prepare four phone screenshots at 1080x1920 portrait.

Suggested capture flow:

```powershell
adb shell screencap -p /sdcard/shopkeeper-dashboard.png
adb pull /sdcard/shopkeeper-dashboard.png apps/shopkeeper/assets/play-store/screenshots/
```

Recommended first screenshots:

- Dashboard with live billing, inventory, and rate cards.
- New invoice or estimate flow.
- Inventory detail with item history.
- Customer profile or outstanding balances.
