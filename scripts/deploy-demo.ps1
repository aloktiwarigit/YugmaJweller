# deploy-demo.ps1 — One-shot Goldsmith demo deployment script
#
# Does everything:
#   1. Checks prerequisites (gcloud, eas, adb)
#   2. Deploys API to Cloud Run via Cloud Build
#   3. Seeds anchor-dev demo tenant data
#   4. Builds customer-mobile + shopkeeper APKs via EAS preview
#   5. Installs both APKs on connected Android device
#   6. Verifies API health
#
# Usage:
#   .\scripts\deploy-demo.ps1               # full deploy (API + apps)
#   .\scripts\deploy-demo.ps1 -SkipApi      # skip Cloud Build, only build/install apps
#   .\scripts\deploy-demo.ps1 -SkipApps     # skip EAS builds, only deploy API
#   .\scripts\deploy-demo.ps1 -InstallOnly  # just install already-built APKs (reuse last EAS build)
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - eas CLI installed + logged in (eas login)
#   - adb in PATH (via Android SDK platform-tools)
#   - Samsung device connected with USB debugging on
#
# Run from repo root: cd "C:\Alok\Business Projects\Goldsmith"

param(
    [switch]$SkipApi,
    [switch]$SkipApps,
    [switch]$InstallOnly,
    [string]$DeviceSerial = ""   # optional: specify adb serial if multiple devices
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$API_URL    = "https://goldsmith-api-528920018833.asia-south1.run.app"
$GCP_PROJECT = "goldsmith-dev"
$SHOP_SLUG  = "anchor-dev"

# ── Colours ─────────────────────────────────────────────────────────────────
function Write-Step($msg)  { Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
Write-Step "Checking prerequisites"

# gcloud
try { $null = gcloud version 2>&1 | Out-Null; Write-Ok "gcloud CLI found" }
catch { Write-Fail "gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install" }

# eas
try { $null = eas --version 2>&1 | Out-Null; Write-Ok "eas CLI found" }
catch { Write-Fail "eas CLI not found. Run: npm install -g eas-cli" }

$easUser = (eas whoami 2>&1) | Select-String "@" | Select-Object -First 1
if (-not $easUser) {
    Write-Fail "Not logged into EAS. Run: eas login"
}
Write-Ok "EAS logged in as $easUser"

# adb
try { $null = adb version 2>&1 | Out-Null; Write-Ok "adb found" }
catch { Write-Fail "adb not found. Add Android SDK platform-tools to PATH" }

# device
$devices = (adb devices 2>&1) -match "\tdevice$"
if ($devices.Count -eq 0) {
    Write-Warn "No Android device connected. APK install step will be skipped."
    Write-Warn "Connect a device with USB debugging and re-run, or use -InstallOnly later."
    $deviceSerial = $null
} else {
    if ($DeviceSerial -eq "") {
        $DeviceSerial = ($devices[0] -split "\t")[0]
    }
    Write-Ok "Device: $DeviceSerial"
}

# ── 2. Deploy API via Cloud Build ────────────────────────────────────────────
if (-not $SkipApi -and -not $InstallOnly) {
    Write-Step "Deploying API to Cloud Run (this takes ~8 min)"
    Write-Host "  Submitting Cloud Build job to project=$GCP_PROJECT..."
    gcloud builds submit --config cloudbuild.yaml --ignore-file=.gcloudignore-api --project $GCP_PROJECT .
    Write-Ok "Cloud Build completed — API deployed"
} else {
    Write-Warn "Skipping API deploy"
}

# ── 3. Seed demo data ─────────────────────────────────────────────────────────
if (-not $InstallOnly) {
    Write-Step "Verifying API health + seeding anchor-dev demo data"
    $healthResp = $null
    try {
        $healthResp = Invoke-WebRequest -UseBasicParsing -Uri "$API_URL/api/v1/catalog/rates" -TimeoutSec 15
    } catch {
        Write-Warn "API health check failed — it may still be starting up. Try again in 30s."
    }
    if ($healthResp -and $healthResp.StatusCode -eq 200) {
        Write-Ok "API is live: $API_URL"
    }

    try {
        Write-Host "  Running demo-tenant seed..."
        $env:API_URL = $API_URL
        pnpm tsx scripts/seed/demo-tenant.ts 2>&1 | Select-Object -Last 5
        Write-Ok "anchor-dev tenant seeded"
    } catch {
        Write-Warn "Seed script failed or tenant already exists — continuing"
    }
}

# ── 4. EAS builds ────────────────────────────────────────────────────────────
if (-not $SkipApps -and -not $InstallOnly) {
    Write-Step "Submitting EAS preview builds (both apps in parallel)"

    # Submit both without waiting
    Write-Host "  Queuing customer-mobile build..."
    $custBuild = (eas build --profile preview --platform android --non-interactive --no-wait --json 2>&1 | ConvertFrom-Json)
    $custBuildId = $custBuild.id
    Write-Ok "customer-mobile queued: $custBuildId"

    Write-Host "  Queuing shopkeeper build..."
    Push-Location apps/shopkeeper
    $shopBuild = (eas build --profile preview --platform android --non-interactive --no-wait --json 2>&1 | ConvertFrom-Json)
    $shopBuildId = $shopBuild.id
    Pop-Location
    Write-Ok "shopkeeper queued: $shopBuildId"

    # Poll both until complete
    Write-Host ""
    Write-Host "  Waiting for EAS builds to complete (typically 10-15 min)..."
    $apks = @{}
    $pending = @{ customer = $custBuildId; shopkeeper = $shopBuildId }

    while ($pending.Count -gt 0) {
        Start-Sleep -Seconds 30
        foreach ($appName in @($pending.Keys)) {
            $buildId = $pending[$appName]
            $info = (eas build:view $buildId --json 2>&1 | ConvertFrom-Json)
            $status = $info.status
            Write-Host "    $appName : $status"
            if ($status -eq "FINISHED") {
                $apkUrl = $info.artifacts.buildUrl
                Write-Ok "$appName build done — downloading APK..."
                $apkPath = "$env:TEMP\goldsmith-$appName.apk"
                Invoke-WebRequest -UseBasicParsing -Uri $apkUrl -OutFile $apkPath
                $apks[$appName] = $apkPath
                $pending.Remove($appName)
            } elseif ($status -eq "ERRORED" -or $status -eq "CANCELED") {
                Write-Fail "$appName EAS build failed ($status). Check https://expo.dev"
            }
        }
    }
    Write-Ok "Both APKs downloaded"
} elseif ($InstallOnly) {
    # Look for previously downloaded APKs
    $apks = @{}
    if (Test-Path "$env:TEMP\goldsmith-customer.apk")    { $apks["customer"]    = "$env:TEMP\goldsmith-customer.apk" }
    if (Test-Path "$env:TEMP\goldsmith-shopkeeper.apk") { $apks["shopkeeper"] = "$env:TEMP\goldsmith-shopkeeper.apk" }
    if ($apks.Count -eq 0) {
        Write-Fail "No cached APKs found. Run without -InstallOnly to build first."
    }
}

# ── 5. Install APKs ───────────────────────────────────────────────────────────
if ($DeviceSerial -and (-not $SkipApps)) {
    Write-Step "Installing APKs on device $DeviceSerial"
    foreach ($appName in $apks.Keys) {
        $apkPath = $apks[$appName]
        Write-Host "  Installing $appName..."
        $result = adb -s $DeviceSerial install -r $apkPath 2>&1
        if ($result -match "Success") {
            Write-Ok "$appName installed"
        } else {
            Write-Warn "Install result: $result"
        }
    }

    # Set up reverse tunnel if Metro is needed
    adb -s $DeviceSerial reverse tcp:8081 tcp:8081 | Out-Null
    Write-Ok "ADB reverse tunnel set (port 8081)"
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  DEPLOY COMPLETE" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API:          $API_URL" -ForegroundColor White
Write-Host "  Tenant:       $SHOP_SLUG" -ForegroundColor White
if ($DeviceSerial) {
    Write-Host "  Device:       $DeviceSerial" -ForegroundColor White
    Write-Host "  Apps:         customer-mobile + shopkeeper installed" -ForegroundColor White
}
Write-Host ""
Write-Host "  Open the Goldsmith Customer app on your device to start the demo." -ForegroundColor Yellow
Write-Host ""
