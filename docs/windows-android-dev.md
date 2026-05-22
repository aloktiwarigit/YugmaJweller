# Windows Android Dev — Known Landmines

Running `expo run:android` or `npx expo start --dev-client` on Windows with pnpm has several gotchas. Read this before any shopkeeper smoke test.

## 1. Windows MAX_PATH (260-char) breaks CMake/Gradle

pnpm's virtual store puts packages at `.pnpm/<pkg>@<ver>_<hash>/node_modules/...`. The hash encodes peer-dep combinations and can be 30-60 chars. Combined with `C:\Alok\Business Projects\Goldsmith\.worktrees\<branch>\`, paths routinely exceed 260 chars.

**Symptom:** `java.io.IOException: The filename, directory name, or volume label syntax is incorrect` during `app:compileDebugJavaWithJavac`.

**Fix:** Build from a short root. Copy the repo to `C:\gs\` (5-char root) and build from there:
```
xcopy /E /I "C:\Alok\Business Projects\Goldsmith" C:\gs
cd C:\gs\apps\shopkeeper
npx expo run:android --device
```
The Windows long-path registry key (`HKLM\...\LongPathsEnabled=1`) is NOT sufficient — CMake/ninja are not compiled with `longPathAware` and ignore it.

## 2. Junctions don't help

Windows junctions (`mklink /J C:\wt "C:\Alok\Business Projects\..."`) are resolved to their real target by CMake's `stat()` calls. No path shortening benefit.

## 3. `node-linker=hoisted` causes duplicate Gradle plugin

Adding `node-linker=hoisted` to `.npmrc` creates two copies of `@react-native/gradle-plugin` — one from pnpm's virtual store, one hoisted — both registered as Gradle included builds with the same build path `:gradle-plugin`. Build fails immediately.

**Don't do this.** Keep pnpm's default virtual store layout.

## 4. Metro must run from the same root as the APK build

The dev-client APK bakes in relative pnpm hash paths for the JS bundle entry. If Metro runs from a different root (e.g., worktree) those paths don't resolve.

**Rule:** Always start Metro from `C:\gs\apps\shopkeeper` when the APK was built from `C:\gs`.

## 5. pnpm virtual store isolation breaks Metro — hoist everything

After a fresh pnpm install, packages like `@babel/runtime`, `@react-native/assets-registry`, `@tanstack/react-query` etc. exist only in the virtual store (`.pnpm/<pkg>@<ver>/node_modules/`). Metro cannot find them via its resolver — it whack-a-moles with a new "Unable to resolve" error for each missing package.

**The only reliable fix for the C:\gs dev copy:** set `public-hoist-pattern[]=*` in `.npmrc` and re-run `pnpm install`. This hoists all packages to the root `node_modules/`, which Metro can traverse normally:

```
# C:\gs\.npmrc — add this line
public-hoist-pattern[]=*
```
```bash
cd C:/gs && echo y | pnpm install
```

**Do NOT try:** adding packages one by one, symlinking manually, or adding specific patterns (`@babel/*`, `@tanstack/*`) — you will whack-a-mole through 10+ packages.

**Important:** Do NOT add `public-hoist-pattern[]=*` to the real repo's `.npmrc` (at `C:\Alok\Business Projects\Goldsmith\.npmrc`) or any worktree. That change lives only in `C:\gs` which is the throw-away build copy.

## 6. expo-linking version split

`expo-linking@55.0.13` calls `requireNativeModule('ExpoLinking')` — it's a native module. `expo-linking@6.3.1` is pure JS (re-exports `Linking` from react-native). The APK's native shell only contains the modules autolinking registered at build time.

If the Metro bundle resolves to `expo-linking@55.0.13` but the APK was built without `ExpoLinking` native module → crash at boot.

**Fix:** Pin `expo-linking@~6.3.1` as a direct dep in `apps/shopkeeper/package.json`. Check pnpm lock to confirm `expo-router` resolves to the `p3emlajxqafsfmn5fyfb4xm6ji` hash (which depends on 6.3.1), not the `zbxarhgj6iufaeqwbgpssqow3a` hash (which depends on 55.0.13).

## 7. Stale Metro cache re-introduces resolved native modules

Even after fixing `expo-linking` version, a cached Metro bundle can serve the old 55.x resolution.

**Always restart Metro with `--clear`** after any dependency changes:
```
npx expo start --dev-client --clear --port 8081
```

## 8. ADB reverse tunnel must be re-armed each session

```bash
adb -s <DEVICE_SERIAL> reverse tcp:8081 tcp:8081
```
Run this after every Metro restart. Verify with `adb reverse --list`.
