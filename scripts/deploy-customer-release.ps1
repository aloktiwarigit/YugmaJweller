<#
.SYNOPSIS
Build and deploy the customer Android app for QA or Play internal testing.

.DESCRIPTION
Default mode builds an EAS preview APK and installs it on a connected Android
device. That is the safest release-style device QA path on Windows because the
local Gradle/CMake build can fail when the repo path or pnpm store path contains
spaces.

Use -Mode play-internal for the Google Play internal-testing AAB flow. That mode
does not install to a phone; it builds the production app bundle for upload or
submission to the Play internal track.

.EXAMPLE
.\scripts\deploy-customer-release.ps1

.EXAMPLE
.\scripts\deploy-customer-release.ps1 -Mode eas-preview -DeviceSerial R9XXXXXX

.EXAMPLE
.\scripts\deploy-customer-release.ps1 -Mode eas-preview -SkipBuild

.EXAMPLE
.\scripts\deploy-customer-release.ps1 -Mode play-internal

.EXAMPLE
.\scripts\deploy-customer-release.ps1 -Mode local-gradle -BuildOnly
#>

param(
    [ValidateSet("eas-preview", "local-gradle", "play-internal")]
    [string]$Mode = "eas-preview",

    [switch]$SkipBuild,
    [switch]$BuildOnly,
    [switch]$Submit,
    [switch]$NoLaunch,

    [string]$DeviceSerial = "",
    [string]$WorkspaceAlias = ""
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

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "$Name was not found. $InstallHint"
    }
}

function Import-DotEnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        if ($separator -le 0) {
            continue
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $value
    }
    Write-Ok "Loaded $Path"
}

function Normalize-Path([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
}

function ConvertFrom-EasJsonOutput([string[]]$Output) {
    $text = ($Output -join "`n").Trim()
    $objectIndex = $text.IndexOf("{")
    $arrayIndex = $text.IndexOf("[")

    if ($objectIndex -lt 0 -and $arrayIndex -lt 0) {
        Fail "EAS did not return JSON output:`n$text"
    }

    if ($objectIndex -lt 0) {
        $start = $arrayIndex
    } elseif ($arrayIndex -lt 0) {
        $start = $objectIndex
    } else {
        $start = [Math]::Min($objectIndex, $arrayIndex)
    }

    try {
        return ($text.Substring($start) | ConvertFrom-Json)
    } catch {
        Fail "Could not parse EAS JSON output:`n$text"
    }
}

function Get-EasProfile([string]$AppDir, [string]$ProfileName) {
    $easPath = Join-Path $AppDir "eas.json"
    if (-not (Test-Path -LiteralPath $easPath)) {
        Fail "Missing $easPath"
    }

    $eas = Get-Content -Raw -LiteralPath $easPath | ConvertFrom-Json
    $profileConfig = $eas.build.$ProfileName
    if (-not $profileConfig) {
        Fail "Build profile '$ProfileName' was not found in $easPath"
    }

    return $profileConfig
}

function Get-EasSubmitProfile([string]$AppDir, [string]$ProfileName) {
    $easPath = Join-Path $AppDir "eas.json"
    if (-not (Test-Path -LiteralPath $easPath)) {
        Fail "Missing $easPath"
    }

    $eas = Get-Content -Raw -LiteralPath $easPath | ConvertFrom-Json
    return $eas.submit.$ProfileName
}

function Assert-NoPlaceholders([object]$Value, [string]$Path) {
    if ($null -eq $Value) {
        return
    }

    if ($Value -is [string]) {
        if ($Value -like "REPLACE_WITH_*") {
            Fail "$Path still contains placeholder value '$Value'. Populate apps/customer-mobile/eas.json first."
        }
        return
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $index = 0
        foreach ($item in $Value) {
            Assert-NoPlaceholders -Value $item -Path "$Path[$index]"
            $index += 1
        }
        return
    }

    if ($Value.PSObject -and $Value.PSObject.Properties) {
        foreach ($property in $Value.PSObject.Properties) {
            Assert-NoPlaceholders -Value $property.Value -Path "$Path.$($property.Name)"
        }
    }
}

function Assert-EnvValue([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Fail "$Name is required. Set it in the current shell or apps/customer-mobile/.env.production; also store it in the EAS production environment before building."
    }
    if ($value -like "*REPLACE_WITH_*" -or $value -like "SET-*") {
        Fail "$Name still contains a placeholder value."
    }
    return $value
}

function Assert-ReverseDns([string]$Name, [string]$Value) {
    if ($Value -notmatch '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,}$') {
        Fail "$Name must be a valid reverse-DNS identifier with at least three segments. Got: $Value"
    }
}

function Set-ProfileEnv([string]$AppDir, [string]$ProfileName) {
    $profileConfig = Get-EasProfile -AppDir $AppDir -ProfileName $ProfileName
    $profileEnv = $profileConfig.env

    if ($profileEnv) {
        foreach ($property in $profileEnv.PSObject.Properties) {
            $value = [string]$property.Value
            if ($value -like "REPLACE_WITH_*") {
                Fail "Profile '$ProfileName' still contains placeholder $($property.Name)=$value"
            }
            Set-Item -Path "Env:$($property.Name)" -Value $value
        }
    }

    $env:NODE_ENV = "production"
    Write-Ok "Loaded customer-mobile '$ProfileName' environment from eas.json"
}

function Get-ConnectedDevices {
    $lines = @(adb devices | Where-Object { $_ -match "\tdevice$" })
    return @($lines | ForEach-Object { ($_ -split "\t")[0] })
}

function Install-Apk([string]$ApkPath, [string]$PackageName) {
    if ($BuildOnly) {
        Write-Warn "BuildOnly was set; install step skipped."
        return
    }

    Require-Command "adb" "Install Android SDK platform-tools and add them to PATH."

    Write-Step "Finding Android device"
    $devices = Get-ConnectedDevices
    if ($devices.Count -eq 0) {
        Fail "No ADB device found. Enable USB debugging on the Moto G, reconnect it, accept the RSA prompt, then rerun this script."
    }

    if ($DeviceSerial -eq "") {
        if ($devices.Count -gt 1) {
            Fail "Multiple ADB devices found: $($devices -join ', '). Rerun with -DeviceSerial <serial>."
        }
        $script:DeviceSerial = $devices[0]
    }

    if ($devices -notcontains $DeviceSerial) {
        Fail "Device serial $DeviceSerial is not connected. Connected devices: $($devices -join ', ')"
    }

    Write-Ok "Device: $DeviceSerial"

    Write-Step "Installing APK"
    $installOutput = adb -s $DeviceSerial install -r $ApkPath 2>&1
    $installText = $installOutput -join "`n"
    if ($installText -notmatch "Success") {
        Fail "ADB install failed:`n$installText"
    }
    Write-Ok "Installed customer app"

    if (-not $NoLaunch -and $PackageName) {
        Write-Step "Launching app"
        $launchOutput = adb -s $DeviceSerial shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 2>&1
        Write-Host ($launchOutput -join "`n")
    }
}

function Write-ApkDetails([string]$ApkPath, [string]$PackageName) {
    if (-not (Test-Path -LiteralPath $ApkPath)) {
        Fail "APK was not found at $ApkPath"
    }

    Write-Step "APK ready"
    $apk = Get-Item -LiteralPath $ApkPath
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $ApkPath
    Write-Ok "Path: $ApkPath"
    Write-Ok "Size: $($apk.Length) bytes"
    Write-Ok "SHA256: $($hash.Hash)"
    if ($PackageName) {
        Write-Ok "Application ID: $PackageName"
    }
}

function Invoke-EasPreview([string]$AppDir) {
    Require-Command "eas" "Install with: npm install -g eas-cli"
    Require-Command "adb" "Install Android SDK platform-tools and add them to PATH."
    Set-ProfileEnv -AppDir $AppDir -ProfileName "preview"

    $apkPath = Join-Path $env:TEMP "goldsmith-customer-preview.apk"
    $packageName = $env:EXPO_PUBLIC_ANDROID_PACKAGE

    if (-not $SkipBuild) {
        Write-Step "Checking EAS login"
        Push-Location $AppDir
        try {
            $whoami = eas whoami 2>&1
            if ($LASTEXITCODE -ne 0) {
                Fail "Not logged in to EAS. Run 'eas login' and rerun this script.`n$($whoami -join "`n")"
            }
            Write-Ok "EAS user: $($whoami[-1])"

            Write-Step "Building EAS preview APK"
            $rawBuild = eas build --profile preview --platform android --wait --non-interactive --json 2>&1
            if ($LASTEXITCODE -ne 0) {
                Fail "EAS preview build failed:`n$($rawBuild -join "`n")"
            }

            $build = ConvertFrom-EasJsonOutput -Output $rawBuild
            if ($build -is [array]) {
                $build = $build[0]
            }

            $artifactUrl = $build.artifacts.buildUrl
            if (-not $artifactUrl) {
                Fail "EAS build finished but no APK artifact URL was returned."
            }

            Write-Step "Downloading preview APK"
            Invoke-WebRequest -UseBasicParsing -Uri $artifactUrl -OutFile $apkPath
        } finally {
            Pop-Location
        }
    } else {
        Write-Warn "Skipping EAS build; reusing $apkPath"
    }

    Write-ApkDetails -ApkPath $apkPath -PackageName $packageName
    Install-Apk -ApkPath $apkPath -PackageName $packageName
}

function Get-LocalBuildRoot([string]$RepoRoot, [string]$AliasPath) {
    if ($RepoRoot -notmatch "\s") {
        return $RepoRoot
    }

    if ([string]::IsNullOrWhiteSpace($AliasPath)) {
        $AliasPath = Join-Path $env:TEMP "goldsmith-workspace"
    }

    $existing = Get-Item -LiteralPath $AliasPath -Force -ErrorAction SilentlyContinue
    if ($existing) {
        $isJunction = ($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        if (-not $isJunction) {
            Fail "Workspace alias $AliasPath already exists and is not a junction. Pass -WorkspaceAlias with another short path."
        }

        $target = $existing.Target
        if ($target -is [array]) {
            $target = $target[0]
        }
        if ((Normalize-Path $target) -ne (Normalize-Path $RepoRoot)) {
            Fail "Workspace alias $AliasPath points to $target, not $RepoRoot. Pass -WorkspaceAlias with another short path."
        }
    } else {
        New-Item -ItemType Junction -Path $AliasPath -Target $RepoRoot | Out-Null
        Write-Ok "Created short workspace alias: $AliasPath -> $RepoRoot"
    }

    Write-Warn "Using $AliasPath because Android release builds can fail under paths with spaces."
    return $AliasPath
}

function Invoke-LocalGradle([string]$RepoRoot, [string]$AppDir) {
    Require-Command "pnpm" "Install pnpm or enable it via corepack."
    Require-Command "adb" "Install Android SDK platform-tools and add them to PATH."
    Set-ProfileEnv -AppDir $AppDir -ProfileName "preview"

    if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
        $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
        if (Test-Path -LiteralPath $defaultSdk) {
            $env:ANDROID_HOME = $defaultSdk
            $env:ANDROID_SDK_ROOT = $defaultSdk
            Write-Ok "Using Android SDK at $defaultSdk"
        } else {
            Fail "ANDROID_HOME or ANDROID_SDK_ROOT is not set, and $defaultSdk was not found."
        }
    }

    $buildRoot = Get-LocalBuildRoot -RepoRoot $RepoRoot -AliasPath $WorkspaceAlias
    $buildAppDir = Join-Path $buildRoot "apps\customer-mobile"
    $androidDir = Join-Path $buildAppDir "android"
    $apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
    $metadataPath = Join-Path $androidDir "app\build\outputs\apk\release\output-metadata.json"

    if (-not (Test-Path -LiteralPath $androidDir)) {
        Fail "Missing generated Android project at $androidDir. Run 'pnpm --filter @goldsmith/customer-mobile exec expo prebuild --platform android' first."
    }

    if (-not $SkipBuild) {
        Write-Step "Building customer-mobile release APK with local Gradle"
        Push-Location $androidDir
        try {
            .\gradlew.bat :app:assembleRelease
        } finally {
            Pop-Location
        }
    } else {
        Write-Warn "Skipping Gradle build; reusing existing APK"
    }

    $packageName = $env:EXPO_PUBLIC_ANDROID_PACKAGE
    if (Test-Path -LiteralPath $metadataPath) {
        $metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
        $packageName = $metadata.applicationId
    }

    Write-ApkDetails -ApkPath $apkPath -PackageName $packageName
    Install-Apk -ApkPath $apkPath -PackageName $packageName
}

function Invoke-PlayInternal([string]$AppDir) {
    Require-Command "eas" "Install with: npm install -g eas-cli"

    $profile = Get-EasProfile -AppDir $AppDir -ProfileName "production"
    Assert-NoPlaceholders -Value $profile -Path "build.production"
    Set-ProfileEnv -AppDir $AppDir -ProfileName "production"
    Import-DotEnvFile -Path (Join-Path $AppDir ".env.production")

    $env:BUILD_TARGET_PLATFORM = "android"
    $androidPackage = Assert-EnvValue "EXPO_PUBLIC_ANDROID_PACKAGE"
    $apiBaseUrl = Assert-EnvValue "EXPO_PUBLIC_API_BASE_URL"
    $null = Assert-EnvValue "EXPO_PUBLIC_SHOP_SLUG"
    $null = Assert-EnvValue "EXPO_PUBLIC_APP_NAME"
    $null = Assert-EnvValue "EXPO_PUBLIC_FIREBASE_PROJECT_ID"
    $null = Assert-EnvValue "EXPO_PUBLIC_EAS_PROJECT_ID"
    if ($env:EXPO_PUBLIC_DEV_AUTH -eq "1") {
        Fail "EXPO_PUBLIC_DEV_AUTH must not be 1 for Play internal testing."
    }
    if (-not $apiBaseUrl.StartsWith("https://")) {
        Fail "EXPO_PUBLIC_API_BASE_URL must start with https:// for Play internal testing."
    }
    Assert-ReverseDns -Name "EXPO_PUBLIC_ANDROID_PACKAGE" -Value $androidPackage

    if (-not $env:GOOGLE_SERVICES_JSON) {
        Write-Warn "GOOGLE_SERVICES_JSON is not set locally. This is OK only if it is configured as an EAS production environment file variable."
    } elseif ($env:GOOGLE_SERVICES_JSON -like "*REPLACE_WITH_*" -or $env:GOOGLE_SERVICES_JSON -like "SET-*") {
        Fail "GOOGLE_SERVICES_JSON still contains a placeholder value."
    }

    $appConfig = Get-Content -Raw -LiteralPath (Join-Path $AppDir "app.config.ts")
    if ($appConfig -notmatch "targetSdkVersion:\s*35") {
        Fail "app.config.ts does not configure Android targetSdkVersion 35 for Play builds."
    }

    Write-Step "Checking EAS login"
    Push-Location $AppDir
    try {
        $whoami = eas whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Fail "Not logged in to EAS. Run 'eas login' and rerun this script.`n$($whoami -join "`n")"
        }
        Write-Ok "EAS user: $($whoami[-1])"

        if (-not $SkipBuild) {
            Write-Step "Building production AAB for Play internal testing"
            eas build --profile production --platform android --non-interactive
            if ($LASTEXITCODE -ne 0) {
                Fail "EAS production build failed."
            }
        } else {
            Write-Warn "Skipping EAS production build."
        }

        if ($Submit) {
            $submitProfile = Get-EasSubmitProfile -AppDir $AppDir -ProfileName "production"
            Assert-NoPlaceholders -Value $submitProfile.android -Path "submit.production.android"

            Write-Step "Submitting latest Android build to Play internal track"
            eas submit --platform android --profile production --latest --non-interactive
            if ($LASTEXITCODE -ne 0) {
                Fail "EAS submit failed."
            }
        } else {
            Write-Warn "Submit skipped. Upload the AAB manually or rerun with -Submit after eas.json submit.production.android is populated."
        }
    } finally {
        Pop-Location
    }
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Normalize-Path (Join-Path $scriptDir "..")
$appDir = Join-Path $repoRoot "apps\customer-mobile"

if (-not (Test-Path -LiteralPath $appDir)) {
    Fail "customer-mobile app was not found at $appDir"
}

Write-Step "Mode: $Mode"
switch ($Mode) {
    "eas-preview" {
        Invoke-EasPreview -AppDir $appDir
    }
    "local-gradle" {
        Invoke-LocalGradle -RepoRoot $repoRoot -AppDir $appDir
    }
    "play-internal" {
        Invoke-PlayInternal -AppDir $appDir
    }
}

Write-Host ""
Write-Host "Deploy script complete." -ForegroundColor Cyan
