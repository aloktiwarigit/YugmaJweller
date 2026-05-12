[CmdletBinding()]
param(
  [switch]$Docker,
  [switch]$NativeOnly,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SemgrepArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

if (-not $SemgrepArgs -or $SemgrepArgs.Count -eq 0) {
  $SemgrepArgs = @('--config', 'ops/semgrep/', '--error')
}

function Command-Exists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $FilePath @Arguments
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

if (-not $Docker) {
  if (Command-Exists 'semgrep') {
    $nativeExitCode = Invoke-Native 'semgrep' $SemgrepArgs
    if ($nativeExitCode -eq 0) {
      exit 0
    }

    if ($NativeOnly) {
      exit $nativeExitCode
    }

    Write-Warning 'native semgrep failed; trying Docker fallback'
  } elseif ($NativeOnly) {
    Write-Error 'semgrep is not on PATH'
    exit 1
  }
}

if (-not (Command-Exists 'docker')) {
  Write-Error 'docker is required for Semgrep Docker fallback'
  exit 1
}

$mount = "${repoRoot}:/src"
$dockerArgs = @(
  'run',
  '--rm',
  '-e',
  'SEMGREP_SEND_METRICS=off',
  '-v',
  $mount,
  '-w',
  '/src',
  'returntocorp/semgrep:latest',
  'semgrep'
) + $SemgrepArgs

$dockerExitCode = Invoke-Native 'docker' $dockerArgs
exit $dockerExitCode
