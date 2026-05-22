# Customer Mobile Visual QA with Maestro

Use Maestro, not Paparazzi, for customer-mobile screen review. Paparazzi is useful for native Android layout snapshots, but this app is Expo/React Native and needs the real dev client, Metro bundle, API, navigation, and images running on an emulator.

## Installed tool

- Maestro CLI is installed at `C:\maestro\bin\maestro.bat`.
- `C:\maestro\bin` has been added to the User PATH. In the current PowerShell session, use:
  ```
  $env:Path='C:\maestro\bin;'+$env:Path
  maestro --version
  ```
- Java 17+ is required; this machine uses JDK 21 via `JAVA_HOME`.
- The Windows Maestro batch file echoes its internal commands. This is noisy but harmless.

## Runtime services for customer-mobile

1. Start Docker Desktop if the Docker API is down:
   ```
   Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
   ```
2. Start local dependencies:
   ```
   docker compose -f docker-compose.dev.yml up -d postgres redis
   ```
   The API `.env.local` points Postgres at `localhost:5433`; Redis is `localhost:6379`.
3. Start the API on `3001`, not `3000`. Port `3000` is customer-web.
   ```
   # Load apps/api/.env.local into the process, then:
   $env:PORT='3001'
   pnpm --filter @goldsmith/api exec tsx src/main.ts
   ```
   Verify:
   ```
   Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3001/api/v1/tenant/boot?slug=anchor-dev'
   ```
4. Start Metro for the customer dev client:
   ```
   $env:EXPO_PUBLIC_API_BASE_URL='http://10.0.2.2:3001'
   $env:EXPO_PUBLIC_DEV_AUTH='1'
   pnpm --filter @goldsmith/customer-mobile exec expo start --dev-client --clear --port 8081 --host localhost
   ```
   Wait for `http://127.0.0.1:8081/status` to return `packager-status:running`.
5. Use the `Pixel_6_Pravesh` AVD when available:
   ```
   adb devices
   adb -s emulator-5554 reverse tcp:8081 tcp:8081
   adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "goldsmithcustomer://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" com.goldsmith.customer.dev
   ```
   This launch URL is more reliable than `exp+goldsmith-customer://...` for this local smoke.
6. If the Expo developer menu appears, tap `Continue`, then close it with the `X`. If cached JS is stale, open the dev menu with:
   ```
   adb -s emulator-5554 shell input keyevent 82
   ```
   and tap `Reload`.

## Maestro flow and screenshots

- Customer tab/link smoke flow:
  ```
  maestro test artifacts/maestro/customer-tabs-smoke.yaml
  ```
- Home screenshot:
  ```
  adb -s emulator-5554 shell screencap -p /sdcard/customer-home.png
  adb -s emulator-5554 pull /sdcard/customer-home.png artifacts/maestro/customer-home.png
  ```
- PowerShell `adb exec-out screencap -p > file.png` can create unreadable PNGs. Prefer `adb shell screencap` + `adb pull`.

## Visual review bar

- Customer home must look image-led and premium enough to sit near Tanishq/CaratLane expectations: visible jewellery, polished category imagery, strong product discovery, wishlist/profile affordances, and no dark abstract crops or muted blank-looking tiles.
- The home hero and category tiles are first-screen proof. If a screenshot shows a dark/blurred hero, beige placeholder blocks, missing product photos, or text-only category tiles, do not call the visual pass complete.
- In the Android dev client, Metro-served local storefront images rendered as blank/dark placeholders. The customer-mobile home now uses compact data-URI sources generated in `apps/customer-mobile/src/assets/storefrontImageData.ts`, consumed through `storefrontImages.ts`. If replacing the visuals, regenerate that data file from aspirational jewellery photos or verify the emulator screenshot before switching back to `require(...)` assets.
- The anchor-dev catalog currently has sparse product data (`ANCHOR-SMOKE-001` may have no `primaryImage`), so product-card fallbacks must still look intentional. Use contained local jewellery imagery for no-image products rather than stretched cover crops.
- Keep customer-facing white-label rules intact: only the jeweller brand appears; no Goldsmith platform branding.

## Known Windows gotchas

- If `expo run:android --no-bundler` fails in this long workspace with CMake/Ninja `Filename longer than 260 characters`, rebuild from a short physical path such as `C:\gs`. Junctions are not reliable because native build tools resolve the real path.
- Keep the customer mobile direct dependency on `react-native-css-interop@0.0.36`; NativeWind/Metro needs it here.
- Do not add direct React Navigation v7 packages to `apps/customer-mobile`; Expo Router 3.5 expects React Navigation v6.
- `apps/customer-mobile/metro.config.js` uses a Windows-safe NativeWind `cliCommand` because paths with spaces break the default Tailwind CLI spawn.
