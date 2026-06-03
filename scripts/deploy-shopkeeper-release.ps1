<#
.SYNOPSIS
Build the shopkeeper Android app locally and optionally install it on a device.

.DESCRIPTION
Mirrors the customer-mobile local release flow. It copies the repo to a short
workspace path, installs dependencies, fetches Android signing credentials from
Azure Key Vault, builds a release APK or AAB, and optionally installs the APK.

Use -Aab -BuildOnly for a Play Store upload artifact.
#>

param(
    [switch]$Aab,
    [switch]$BuildOnly,
    [switch]$SkipCopy,
    [string]$DeviceSerial = "",
    [string]$WorkspacePath = "C:\g",
    [string]$VirtualStoreDir = ".p"
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
        Fail "$Name is required. Set it in apps/shopkeeper/.env.production."
    }
    if ($value -like "*REPLACE_WITH_*" -or $value -like "SET-*") {
        Fail "$Name still contains a placeholder value."
    }
    return $value
}

function Get-EnvOrDefault([string]$Name, [string]$Default) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
}

function Get-KvSecret([string]$VaultName, [string]$SecretName) {
    $val = az keyvault secret show --vault-name $VaultName --name $SecretName --query "value" -o tsv 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Could not read secret '$SecretName' from Key Vault '$VaultName'. Run 'az login' if not authenticated."
    }
    return $val.Trim()
}

function Assert-SafeWorkspacePath([string]$Path) {
    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($full -match "\s") {
        Fail "WorkspacePath '$full' must not contain spaces."
    }
    if ($full -notmatch '^[A-Za-z]:\\[^\\]+$') {
        Fail "WorkspacePath '$full' must be a short top-level directory like C:\g."
    }
    if ($full -eq [System.IO.Path]::GetPathRoot($full).TrimEnd('\')) {
        Fail "WorkspacePath must not be a drive root."
    }
    return $full
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$appDir = Join-Path $repoRoot "apps\shopkeeper"
$WorkspacePath = Assert-SafeWorkspacePath $WorkspacePath
$wsAppDir = Join-Path $WorkspacePath "apps\shopkeeper"
$androidDir = Join-Path $wsAppDir "android"

if ($VirtualStoreDir -match "\s") {
    Fail "VirtualStoreDir '$VirtualStoreDir' must not contain spaces."
}

$env:APP_ENV = "production"
$env:NODE_ENV = "production"
Import-DotEnv -Path (Join-Path $appDir ".env.production")

$androidPackage = Assert-EnvValue "EXPO_PUBLIC_ANDROID_PACKAGE"
$null = Assert-EnvValue "EXPO_PUBLIC_API_BASE_URL"
$null = Assert-EnvValue "EXPO_PUBLIC_TENANT_SLUG"
$null = Assert-EnvValue "EXPO_PUBLIC_FIREBASE_PROJECT_ID"

if ($androidPackage.EndsWith(".dev")) {
    Fail "EXPO_PUBLIC_ANDROID_PACKAGE must not end with .dev for production builds."
}

$gsPath = Join-Path $appDir "android\app\google-services.json"
if (-not (Test-Path -LiteralPath $gsPath)) {
    Fail "Missing apps/shopkeeper/android/app/google-services.json. Fetch it with Firebase CLI first."
}

$tempKeystore = $null
try {
    $kvName = Assert-EnvValue "AZURE_KEYVAULT_NAME"
    $keystoreSecret = Get-EnvOrDefault "ANDROID_KEYSTORE_B64_SECRET" "goldsmith-customer-keystore-b64"
    $storePassSecret = Get-EnvOrDefault "ANDROID_STORE_PASSWORD_SECRET" "goldsmith-customer-store-password"
    $keyAliasSecret = Get-EnvOrDefault "ANDROID_KEY_ALIAS_SECRET" "goldsmith-customer-key-alias"
    $keyPassSecret = Get-EnvOrDefault "ANDROID_KEY_PASSWORD_SECRET" "goldsmith-customer-key-password"

    Write-Step "Fetching signing credentials from Key Vault '$kvName'"
    $keystoreB64 = Get-KvSecret -VaultName $kvName -SecretName $keystoreSecret
    $storePass = Get-KvSecret -VaultName $kvName -SecretName $storePassSecret
    $keyAlias = Get-KvSecret -VaultName $kvName -SecretName $keyAliasSecret
    $keyPass = Get-KvSecret -VaultName $kvName -SecretName $keyPassSecret

    $tempKeystore = Join-Path $env:TEMP "gs-shopkeeper-release-$([System.IO.Path]::GetRandomFileName()).keystore"
    [IO.File]::WriteAllBytes($tempKeystore, [Convert]::FromBase64String($keystoreB64))
    Write-Ok "Keystore written to temp path"

    $env:ANDROID_RELEASE_STORE_FILE = $tempKeystore
    $env:ANDROID_RELEASE_STORE_PASSWORD = $storePass
    $env:ANDROID_RELEASE_KEY_ALIAS = $keyAlias
    $env:ANDROID_RELEASE_KEY_PASSWORD = $keyPass

    if (-not $SkipCopy) {
        Write-Step "Copying repo to $WorkspacePath"
        if (Test-Path -LiteralPath $WorkspacePath) {
            Remove-Item -LiteralPath $WorkspacePath -Recurse -Force
        }
        New-Item -ItemType Directory -Path $WorkspacePath -Force | Out-Null

        robocopy "$repoRoot" "$WorkspacePath" /E /XD ".claude" "node_modules" ".git" ".gradle" "build" ".turbo" /NFL /NDL /NJH /NJS | Out-Null
        if ($LASTEXITCODE -ge 8) { Fail "robocopy failed (exit $LASTEXITCODE)" }
        Write-Ok "Copied repo"

        $npmrc = Join-Path $WorkspacePath ".npmrc"
        $npmrcLines = @(Get-Content -LiteralPath $npmrc -ErrorAction SilentlyContinue)
        if (-not ($npmrcLines | Where-Object { $_.Trim() -eq "public-hoist-pattern[]=*" })) {
            Add-Content -LiteralPath $npmrc -Value "`npublic-hoist-pattern[]=*"
            Write-Ok "Added public-hoist-pattern to $npmrc"
        }
        $npmrcLines = @(Get-Content -LiteralPath $npmrc -ErrorAction SilentlyContinue)
        if (-not ($npmrcLines | Select-String "virtual-store-dir")) {
            Add-Content -LiteralPath $npmrc -Value "`nvirtual-store-dir=$VirtualStoreDir"
            Write-Ok "Added short pnpm virtual-store-dir to $npmrc"
        }

        Write-Step "Installing dependencies in $WorkspacePath"
        Push-Location $WorkspacePath
        $previousNodeEnv = $env:NODE_ENV
        try {
            Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
            cmd /c "pnpm install --frozen-lockfile --prod=false"
            if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed (exit $LASTEXITCODE)" }
        } finally {
            $env:NODE_ENV = $previousNodeEnv
            Pop-Location
        }
        Write-Ok "Dependencies installed"
    }

    if (-not (Test-Path -LiteralPath $androidDir)) {
        Fail "Android project not found at $androidDir."
    }

    $dstGs = Join-Path $wsAppDir "android\app\google-services.json"
    Copy-Item -LiteralPath $gsPath -Destination $dstGs -Force
    Write-Ok "google-services.json copied"

    $gradleTask = if ($Aab) { ":app:bundleRelease" } else { ":app:assembleRelease" }
    Write-Step "Running Gradle $gradleTask"

    Push-Location $androidDir
    try {
        .\gradlew.bat $gradleTask
        if ($LASTEXITCODE -ne 0) { Fail "Gradle build failed" }
    } finally {
        Pop-Location
    }

    if ($Aab) {
        $artifact = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
        $artifactType = "AAB"
    } else {
        $artifact = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
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

    if ($Aab) {
        Write-Warn "AAB cannot be sideloaded. Upload it to Play Console internal testing."
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
        cmd /c "adb -s $DeviceSerial shell monkey -p $androidPackage -c android.intent.category.LAUNCHER 1 >NUL 2>NUL"
        if ($LASTEXITCODE -ne 0) { Fail "ADB launch failed for $androidPackage on $DeviceSerial." }
        Write-Ok "Launched $androidPackage"
    }
} finally {
    if ($null -ne $tempKeystore -and (Test-Path -LiteralPath $tempKeystore)) {
        Remove-Item -LiteralPath $tempKeystore -Force
        Write-Ok "Temp keystore deleted"
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
