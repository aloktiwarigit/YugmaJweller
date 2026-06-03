# Production Release Build — Both Apps

The deploy script `scripts/deploy-customer-release.ps1` handles the full customer-mobile release build pipeline. The shopkeeper uses a simpler local Gradle path.

## Customer mobile — one command

```powershell
.\scripts\deploy-customer-release.ps1 -DeviceSerial <serial> -WorkspacePath C:\g
```

What it does: fetches signing keystore from Azure Key Vault (`kv-writ-prod`), copies the repo to `C:\g`, runs pnpm install with hoisting, builds the release APK, installs via ADB.

- `-SkipCopy` — reuse existing `C:\g` workspace (skips 90-second robocopy + pnpm install when code hasn't changed)
- `-Aab` — build Android App Bundle instead of APK (for Play Store upload; does not install on device)

**Prerequisites (all gitignored, must exist locally):**
- `apps/customer-mobile/.env.production`
- `apps/customer-mobile/android/app/google-services.json`
- Azure CLI logged in (`az login` once per machine)

**Required `.env.production` vars for the anchor-dev build:**
```
APP_ENV=production
BUILD_TARGET_PLATFORM=android
EXPO_PUBLIC_DEV_AUTH=0
EXPO_PUBLIC_API_BASE_URL=https://goldsmith-api-528920018833.asia-south1.run.app
EXPO_PUBLIC_SHOP_SLUG=anchor-dev
EXPO_PUBLIC_APP_NAME=श्री राम ज्वैलर्स
EXPO_PUBLIC_ANDROID_PACKAGE=com.goldsmith.customer
EXPO_PUBLIC_FIREBASE_PROJECT_ID=goldsmith-dev
GOOGLE_SERVICES_JSON=./android/app/google-services.json
EXPO_PUBLIC_EAS_PROJECT_ID=1ad93907-29f0-47c1-b014-bf0d7a5ae770
AZURE_KEYVAULT_NAME=kv-writ-prod
```
`BUILD_TARGET_PLATFORM=android` is required — without it `app.config.ts` demands `GOOGLE_SERVICES_PLIST` for iOS too and fails the build.
`EXPO_PUBLIC_EAS_PROJECT_ID` is a stable placeholder UUID; `app.config.ts` validates it exists in production mode even though no EAS builds are used.

## Critical: workspace must be C:\g (4 chars exactly)

The pnpm virtual store path for `react-native` is:
`.pnpm/react-native@0.74.0_@babel+core@7.29.0_@babel+preset-env@7.29.2_@babel+core@7.29.0__@types+react@18.2.79_react@18.2.0/node_modules/react-native/ReactAndroid/src/main/jni/react/turbomodule/ReactCommon/NativeMethodCallInvokerHolder.h`

At `C:\gs-release` (11 chars) this path is 261 characters — 1 over the Windows limit. At `C:\g` (4 chars) it's 252 — within the limit. CMake/ninja resolve symlinks to real paths, so hoisting does not help.

**Never use `C:\gs-release` or any workspace path longer than 4-5 characters for release builds.**

## Use robocopy, not xcopy

`xcopy /EXCLUDE:file` reads the exclude file and the BOM written by PowerShell 5.1's `Set-Content -Encoding UTF8` causes it to silently misread all patterns. Result: nothing is excluded, the `.claude/worktrees/` deep paths cause xcopy to fail or skip the entire `android/` directory.

`robocopy /XD .claude node_modules .git` excludes by directory name, works correctly with PS 5.1, and is already in the deploy script.

## Run pnpm via cmd, not PowerShell

PowerShell 5.1 wraps every stderr line from a native executable as an `ErrorRecord`. The pnpm.ps1 wrapper writes a Node deprecation warning to stderr. With `$ErrorActionPreference = "Stop"`, this kills the script even though pnpm succeeded.

**Fix already in deploy script:** `cmd /c "pnpm install --frozen-lockfile"`.

## compileSdk / targetSdk

- **Customer-mobile:** `compileSdk=35` / `targetSdk=35` with `android.suppressUnsupportedCompileSdk=35` in `gradle.properties` and `patches/expo-modules-core@1.12.26.patch` for the Kotlin nullable-receiver case. JVM heap `-Xmx4096m` / `MaxMetaspaceSize=1024m`.
- **Shopkeeper:** `compileSdk=35` / `targetSdk=35` with the same local Gradle release posture.

## Shopkeeper: JVM target mismatch with JDK 21

JDK 21 defaults Kotlin to JVM 21; Expo 51 targets JVM 17. Causes `Inconsistent JVM-target compatibility` → `expo-document-picker:compileReleaseKotlin FAILED`.

**Fix already in `apps/shopkeeper/android/build.gradle`:**
```groovy
subprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions.jvmTarget = "17"
    }
}
```
Do not remove this block. Do not install JDK 17 as a workaround — the fix is in the repo.

## Shopkeeper release build

```powershell
# AAB for Play Console internal testing
pnpm deploy:shopkeeper-release -- -Aab -BuildOnly

# APK build + install on connected device
pnpm deploy:shopkeeper-release
```

Shopkeeper production values live in `apps/shopkeeper/.env.production`
(gitignored). The example is `apps/shopkeeper/.env.production.example`.
The Firebase config is generated with Firebase CLI into
`apps/shopkeeper/android/app/google-services.json`.

Both `android/` directories are git-tracked (bare workflow). Do not run `expo prebuild` without re-committing the generated output.

## Signing and secrets

| Secret | Where |
|--------|-------|
| Android keystore | Azure Key Vault `kv-writ-prod` → `goldsmith-customer-keystore-b64` (base64) |
| Keystore password | Azure Key Vault `kv-writ-prod` → `goldsmith-customer-store-password` |
| Key alias | `goldsmith-customer` |
| Package name | `com.goldsmith.customer` |
| Firebase app | `goldsmith-dev` project, app ID `1:528920018833:android:b7c84d45075149fde3e430` |
| Signing SHA-1 | `6C:4C:45:39:76:73:EE:1B:97:67:07:7E:D2:28:FA:95:E3:40:0A:13` |

The deploy script fetches the keystore at build time, writes a temp file, and deletes it after Gradle exits. No keystore file is ever committed or persisted on disk.
