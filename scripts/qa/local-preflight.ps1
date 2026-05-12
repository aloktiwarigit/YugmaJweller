[CmdletBinding()]
param(
  [switch]$Strict,
  [switch]$CleanupTestcontainers
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$failures = New-Object System.Collections.Generic.List[string]

function Write-Section {
  param([string]$Name)
  Write-Host ""
  Write-Host "== $Name =="
}

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Write-Ok {
  param([string]$Message)
  Write-Host "OK: $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Command-Exists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Format-NativeOutput {
  param($Output)
  return (($Output | ForEach-Object { $_.ToString() }) -join ' ').
    Replace(' System.Management.Automation.RemoteException', '').Trim()
}

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $FilePath @Arguments 2>&1 | ForEach-Object { $_.ToString() }
    return [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = $output
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

Write-Section 'Node and pnpm'
if (Command-Exists 'node') {
  $nodeVersion = (& node --version).Trim()
  if ($nodeVersion -match '^v20\.') {
    Write-Ok "node $nodeVersion matches package engine >=20.11 <21"
  } else {
    Write-Warn "node $nodeVersion is outside package engine >=20.11 <21"
  }
} else {
  Add-Failure 'node is not on PATH'
}

if (Command-Exists 'pnpm') {
  $pnpmVersion = (& pnpm --version).Trim()
  if ($pnpmVersion -eq '9.12.0') {
    Write-Ok "pnpm $pnpmVersion matches packageManager"
  } else {
    Write-Warn "pnpm $pnpmVersion differs from packageManager pnpm@9.12.0"
  }
} else {
  Add-Failure 'pnpm is not on PATH'
}

Write-Section 'Generated package artifacts'
$generatedArtifacts = @()
if (Test-Path 'packages') {
  $generatedArtifacts = Get-ChildItem -LiteralPath 'packages' -Recurse -File |
    Where-Object {
      ($_.Name -like '*.js' -or $_.Name -like '*.d.ts' -or $_.Name -like '*.js.map' -or $_.Name -like '*.map') -and
      $_.FullName -match '\\packages\\.*\\(src|test)\\' -and
      $_.FullName -notmatch '\\dist\\'
    }
}

if ($generatedArtifacts.Count -eq 0) {
  Write-Ok 'no generated .js/.d.ts/.map artifacts found under packages/*/(src|test)'
} else {
  Write-Warn ("found {0} generated artifacts under packages/*/(src|test)" -f $generatedArtifacts.Count)
  $generatedArtifacts |
    Select-Object -First 12 -ExpandProperty FullName |
    ForEach-Object { Write-Host "  $_" }
  if ($generatedArtifacts.Count -gt 12) {
    Write-Host ("  ... {0} more" -f ($generatedArtifacts.Count - 12))
  }
}

Write-Section 'Docker and Testcontainers'
if (Command-Exists 'docker') {
  try {
    $dockerVersion = Invoke-Native 'docker' @('version', '--format', '{{.Server.Version}}')
    if ($dockerVersion.ExitCode -eq 0) {
      Write-Ok "Docker server $(Format-NativeOutput $dockerVersion.Output) is reachable"
    } else {
      Add-Failure "Docker server is not reachable: $(Format-NativeOutput $dockerVersion.Output)"
    }
  } catch {
    Add-Failure "Docker check failed: $($_.Exception.Message)"
  }

  try {
    $composeConfig = Invoke-Native 'docker' @('compose', '-f', 'docker-compose.dev.yml', 'config')
    if ($composeConfig.ExitCode -eq 0) {
      Write-Ok 'docker-compose.dev.yml renders successfully'
      $composeWarnings = @($composeConfig.Output | Where-Object { $_ -match 'warning|WARN' })
      $composeWarnings | ForEach-Object { Write-Warn "docker compose: $_" }
    } else {
      Add-Failure "docker compose config failed: $(Format-NativeOutput $composeConfig.Output)"
    }
  } catch {
    Add-Failure "docker compose config check failed: $($_.Exception.Message)"
  }

  $testcontainers = @(& docker ps --filter label=org.testcontainers=true --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}')
  $testcontainers = $testcontainers | Where-Object { $_ -and $_.Trim().Length -gt 0 }
  if ($testcontainers.Count -eq 0) {
    Write-Ok 'no running Testcontainers containers detected'
  } else {
    Write-Warn ("{0} running Testcontainers containers detected" -f $testcontainers.Count)
    $testcontainers | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    if ($testcontainers.Count -gt 10) {
      Write-Host ("  ... {0} more" -f ($testcontainers.Count - 10))
    }
    if ($CleanupTestcontainers) {
      Write-Warn 'removing containers with label org.testcontainers=true'
      $ids = $testcontainers | ForEach-Object { ($_ -split '\s+')[0] }
      & docker rm -f @ids
      if ($LASTEXITCODE -ne 0) {
        Add-Failure 'docker rm -f failed for one or more Testcontainers containers'
      }
    } else {
      Write-Host '  Cleanup, if these are stale: .\scripts\qa\local-preflight.ps1 -CleanupTestcontainers'
    }
  }
} else {
  Add-Failure 'docker is not on PATH'
}

Write-Section 'Semgrep'
if (Command-Exists 'semgrep') {
  $semgrepOutput = Invoke-Native 'semgrep' @('--version')
  if ($semgrepOutput.ExitCode -eq 0) {
    Write-Ok "semgrep $(Format-NativeOutput $semgrepOutput.Output)"
  } else {
    Add-Failure "native semgrep failed: $(Format-NativeOutput $semgrepOutput.Output)"
    Write-Host '  Docker fallback: .\scripts\qa\run-semgrep.ps1 -Docker'
  }
} else {
  Add-Failure 'semgrep is not on PATH'
  Write-Host '  Docker fallback: .\scripts\qa\run-semgrep.ps1 -Docker'
}

Write-Section 'Android adb'
if (Command-Exists 'adb') {
  $devices = Invoke-Native 'adb' @('devices')
  if ($devices.ExitCode -eq 0) {
    Write-Ok 'adb is on PATH'
    $devices.Output | ForEach-Object { Write-Host "  $_" }
  } else {
    Add-Failure "adb devices failed: $(Format-NativeOutput $devices.Output)"
  }

  $reverse = Invoke-Native 'adb' @('reverse', '--list')
  if ($reverse.ExitCode -eq 0) {
    Write-Host '  adb reverse --list:'
    $reverse.Output | ForEach-Object { Write-Host "  $_" }
  }
} else {
  Add-Failure 'adb is not on PATH; install Android SDK platform-tools before Android smoke tests'
}

Write-Section 'Browser smoke path'
if (Test-Path 'apps/customer-web/package.json') {
  Write-Host '  Start customer web: pnpm --filter @goldsmith/customer-web dev'
  Write-Host '  Then open: http://localhost:3000, /products, /wishlist, /try-at-home, /admin/login'
} else {
  Add-Failure 'apps/customer-web/package.json is missing'
}

Write-Section 'Summary'
if ($failures.Count -eq 0) {
  Write-Ok 'preflight completed without hard failures'
  exit 0
}

$failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
if ($Strict) {
  exit 1
}

Write-Warn 'preflight completed with failures; rerun with -Strict to make this a hard gate'
exit 0
