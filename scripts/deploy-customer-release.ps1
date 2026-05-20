<#
.SYNOPSIS
Build the customer Android app locally and optionally install it on a device.

.DESCRIPTION
Runs a Gradle release build from a short workspace path (required because
pnpm + Android toolchain fail on paths containing spaces).

Signing credentials are fetched from Azure Key Vault (kv-writ-prod) at build
time and written to a temp keystore that is deleted when the script exits.
Requires: az login done once, AZURE_KEYVAULT_NAME set in .env.production.

Default action: build a release APK and install it on a connected Android device.
Use -Aab to build an Android App Bundle (AAB) instead.
Use -BuildOnly to skip device installation.

.EXAMPLE
# Release APK — build + install on connected device
.\scripts\deploy-customer-release.ps1

.EXAMPLE
# AAB for Play Store internal testing — build only
.\scripts\deploy-customer-release.ps1 -Aab -BuildOnly

.EXAMPLE
# Reuse an existing short-path workspace copy (skip the xcopy step)
.\scripts\deploy-customer-release.ps1 -SkipCopy

.PARAMETER Aab
Build an Android App Bundle (.aab) instead of an APK (.apk).

.PARAMETER BuildOnly
Skip device installation after a successful build.

.PARAMETER SkipCopy
Skip copying the repo to the short workspace path. Use when it already exists
and is up to date.

.PARAMETER DeviceSerial
Specific ADB device serial to install on. Required when multiple devices are
connected; optional when exactly one device is connected.

.PARAMETER WorkspacePath
Short filesystem path used for the build (default: C:\gs-release). Must have
no spaces. The repo is xcopy'd here so Gradle/CMake succeed.
#>

param(
    [switch]$Aab,
    [switch]$BuildOnly,
    [switch]$SkipCopy,
    [string]$DeviceSerial = "",
    [string]$WorkspacePath = "C:\gs-release"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Fail([string]$Message) {
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    exit 1
}

function Import-DotEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $t = $line.Trim()
        if ($t.Length -eq 0 -or $t.StartsWith("#")) { continue }
        $sep = $t.IndexOf("=")
        if ($sep -le 0) { continue }
        $key = $t.Substring(0, $sep).Trim()
        $val = $t.Substring($sep + 1).Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or
            ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $val
    }
    Write-Ok "Loaded $Path"
}

function Assert-EnvValue([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Fail "$Name is required. Set it in apps/customer-mobile/.env.production."
    }
    if ($value -like "*REPLACE_WITH_*" -or $value -like "SET-*") {
        Fail "$Name still contains a placeholder value."
    }
    return $value
}

function Get-KvSecret([string]$VaultName, [string]$SecretName) {
    $val = az keyvault secret show --vault-name $VaultName --name $SecretName --query "value" -o tsv 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Could not read secret '$SecretName' from Key Vault '$VaultName'.`nRun 'az login' if not authenticated."
    }
    return $val.Trim()
}

# ── Paths ──────────────────────────────────────────────────────────────────────
$scriptDir  = Split-Path -Parent $PSCommandPath
$repoRoot   = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$appDir     = Join-Path $repoRoot "apps\customer-mobile"
$wsAppDir   = Join-Path $WorkspacePath "apps\customer-mobile"
$androidDir = Join-Path $wsAppDir "android"

if ($WorkspacePath -match "\s") {
    Fail "WorkspacePath '$WorkspacePath' must not contain spaces."
}

# ── Load production env ────────────────────────────────────────────────────────
$env:APP_ENV = "production"
Import-DotEnv -Path (Join-Path $appDir ".env.production")

$androidPackage = Assert-EnvValue "EXPO_PUBLIC_ANDROID_PACKAGE"
$null           = Assert-EnvValue "EXPO_PUBLIC_API_BASE_URL"
$null           = Assert-EnvValue "EXPO_PUBLIC_SHOP_SLUG"
$null           = Assert-EnvValue "EXPO_PUBLIC_FIREBASE_PROJECT_ID"

if ($env:EXPO_PUBLIC_DEV_AUTH -eq "1") {
    Fail "EXPO_PUBLIC_DEV_AUTH must not be 1 for release builds."
}

# ── Signing credentials from Azure Key Vault ───────────────────────────────────
$tempKeystore = $null
try {
    $kvName = $env:AZURE_KEYVAULT_NAME
    if ([string]::IsNullOrWhiteSpace($kvName)) {
        Fail "AZURE_KEYVAULT_NAME is not set in .env.production."
    }

    Write-Step "Fetching signing credentials from Key Vault '$kvName'"

    $keystoreB64  = Get-KvSecret -VaultName $kvName -SecretName "goldsmith-customer-keystore-b64"
    $storePass    = Get-KvSecret -VaultName $kvName -SecretName "goldsmith-customer-store-password"
    $keyAlias     = Get-KvSecret -VaultName $kvName -SecretName "goldsmith-customer-key-alias"
    $keyPass      = Get-KvSecret -VaultName $kvName -SecretName "goldsmith-customer-key-password"

    # Write keystore to a temp file — deleted in the finally block below
    $tempKeystore = Join-Path $env:TEMP "gs-customer-release-$([System.IO.Path]::GetRandomFileName()).keystore"
    [IO.File]::WriteAllBytes($tempKeystore, [Convert]::FromBase64String($keystoreB64))
    Write-Ok "Keystore written to temp path"

    $env:ANDROID_RELEASE_STORE_FILE     = $tempKeystore
    $env:ANDROID_RELEASE_STORE_PASSWORD = $storePass
    $env:ANDROID_RELEASE_KEY_ALIAS      = $keyAlias
    $env:ANDROID_RELEASE_KEY_PASSWORD   = $keyPass

    # ── Copy repo to short path ────────────────────────────────────────────────
    if (-not $SkipCopy) {
        Write-Step "Copying repo to $WorkspacePath (avoids Gradle path-length failures)"
        if (Test-Path -LiteralPath $WorkspacePath) {
            Remove-Item -LiteralPath $WorkspacePath -Recurse -Force
        }
        New-Item -ItemType Directory -Path $WorkspacePath -Force | Out-Null
        & xcopy /E /I /Q /Y "$repoRoot" "$WorkspacePath" | Out-Null
        Write-Ok "Copied"

        $npmrc = Join-Path $WorkspacePath ".npmrc"
        if (-not (Get-Content -LiteralPath $npmrc -ErrorAction SilentlyContinue | Select-String "public-hoist-pattern")) {
            Add-Content -LiteralPath $npmrc -Value "`npublic-hoist-pattern[]=*"
            Write-Ok "Added public-hoist-pattern to $npmrc"
        }

        Write-Step "Installing dependencies in $WorkspacePath"
        Push-Location $WorkspacePath
        try {
            pnpm install --frozen-lockfile 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }
            if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed" }
        } finally {
            Pop-Location
        }
        Write-Ok "Dependencies installed"
    }

    if (-not (Test-Path -LiteralPath $androidDir)) {
        Fail "Android project not found at $androidDir."
    }

    # ── Copy google-services.json ──────────────────────────────────────────────
    $srcGs = Join-Path $appDir "android\app\google-services.json"
    $dstGs = Join-Path $wsAppDir "android\app\google-services.json"
    if (Test-Path -LiteralPath $srcGs) {
        Copy-Item -LiteralPath $srcGs -Destination $dstGs -Force
        Write-Ok "google-services.json copied"
    } else {
        Write-Warn "android/app/google-services.json not found. Firebase auth will not work."
    }

    # ── Gradle build ──────────────────────────────────────────────────────────
    $gradleTask = if ($Aab) { ":app:bundleRelease" } else { ":app:assembleRelease" }
    Write-Step "Running Gradle $gradleTask"

    Push-Location $androidDir
    try {
        $env:EXPO_PUBLIC_ANDROID_PACKAGE = $androidPackage
        .\gradlew.bat $gradleTask
        if ($LASTEXITCODE -ne 0) { Fail "Gradle build failed" }
    } finally {
        Pop-Location
    }

    # ── Locate artifact ────────────────────────────────────────────────────────
    if ($Aab) {
        $artifact     = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
        $artifactType = "AAB"
    } else {
        $artifact     = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
        $artifactType = "APK"
    }

    if (-not (Test-Path -LiteralPath $artifact)) {
        Fail "$artifactType not found at $artifact"
    }

    $item = Get-Item -LiteralPath $artifact
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $artifact
    Write-Step "$artifactType ready"
    Write-Ok "Path:   $artifact"
    Write-Ok "Size:   $($item.Length) bytes"
    Write-Ok "SHA256: $($hash.Hash)"

    # ── Install (APK only) ────────────────────────────────────────────────────
    if ($Aab) {
        Write-Warn "AAB cannot be sideloaded. Upload it to Play Console → Internal testing."
    } elseif (-not $BuildOnly) {
        Write-Step "Installing APK on device"
        $devices = @(adb devices | Where-Object { $_ -match "\tdevice$" } | ForEach-Object { ($_ -split "\t")[0] })
        if ($devices.Count -eq 0) {
            Fail "No ADB device found. Enable USB debugging and reconnect."
        }
        if ($DeviceSerial -eq "") {
            if ($devices.Count -gt 1) {
                Fail "Multiple devices: $($devices -join ', '). Rerun with -DeviceSerial <serial>."
            }
            $DeviceSerial = $devices[0]
        }
        $out = adb -s $DeviceSerial install -r $artifact 2>&1
        if (($out -join "") -notmatch "Success") {
            Fail "ADB install failed:`n$($out -join "`n")"
        }
        Write-Ok "Installed on $DeviceSerial"
        adb -s $DeviceSerial shell monkey -p $androidPackage -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
        Write-Ok "Launched $androidPackage"
    }

} finally {
    # Always wipe the temp keystore — it must not persist on disk after the build
    if ($null -ne $tempKeystore -and (Test-Path -LiteralPath $tempKeystore)) {
        Remove-Item -LiteralPath $tempKeystore -Force
        Write-Ok "Temp keystore deleted"
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
