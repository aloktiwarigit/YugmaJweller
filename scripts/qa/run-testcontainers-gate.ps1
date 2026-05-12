[CmdletBinding()]
param(
  [ValidateSet('TenantIsolation', 'IntegrationSmoke', 'ApiIntegration', 'IntegrationFull')]
  [string]$Scope = 'TenantIsolation'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$env:TESTCONTAINERS_RYUK_DISABLED = 'false'

function Command-Exists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-TestcontainersCount {
  if (-not (Command-Exists 'docker')) {
    return 0
  }

  $items = @(& docker ps --filter label=org.testcontainers=true --format '{{.ID}}')
  return ($items | Where-Object { $_ -and $_.Trim().Length -gt 0 }).Count
}

function Invoke-Step {
  param(
    [string]$Name,
    [string[]]$PnpmArgs
  )

  Write-Host ""
  Write-Host "== $Name =="
  Write-Host ("pnpm {0}" -f ($PnpmArgs -join ' '))
  & pnpm @PnpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

if (-not (Command-Exists 'pnpm')) {
  throw 'pnpm is not on PATH'
}

if (-not (Command-Exists 'docker')) {
  throw 'docker is not on PATH'
}

$before = Get-TestcontainersCount
Write-Host "Running Testcontainers gate scope: $Scope"
Write-Host "Running Testcontainers containers before: $before"

switch ($Scope) {
  'TenantIsolation' {
    Invoke-Step 'tenant-isolation package' @(
      '--filter', '@goldsmith/testing-tenant-isolation',
      'exec', 'vitest', 'run',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
  }
  'IntegrationSmoke' {
    Invoke-Step 'tenant-isolation package' @(
      '--filter', '@goldsmith/testing-tenant-isolation',
      'exec', 'vitest', 'run',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
    Invoke-Step 'db integration package' @(
      '--filter', '@goldsmith/db',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
  }
  'ApiIntegration' {
    Invoke-Step 'api integration package' @(
      '--filter', '@goldsmith/api',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
  }
  'IntegrationFull' {
    Invoke-Step 'audit integration package' @(
      '--filter', '@goldsmith/audit',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
    Invoke-Step 'db integration package' @(
      '--filter', '@goldsmith/db',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
    Invoke-Step 'sync integration package' @(
      '--filter', '@goldsmith/sync',
      'exec', 'vitest', 'run', '--dir', 'test/integration',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
    Invoke-Step 'tenant-context integration package' @(
      '--filter', '@goldsmith/tenant-context',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
    Invoke-Step 'api integration package' @(
      '--filter', '@goldsmith/api',
      'exec', 'vitest', 'run', '--dir', 'test',
      '--maxWorkers=1',
      '--no-file-parallelism'
    )
  }
}

$after = Get-TestcontainersCount
Write-Host ""
Write-Host "Running Testcontainers containers after: $after"
if ($after -gt $before) {
  Write-Warning "Testcontainers count increased by $($after - $before). Inspect with: docker ps --filter label=org.testcontainers=true"
}
