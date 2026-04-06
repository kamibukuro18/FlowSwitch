param(
  [string]$SigntoolPath = "",
  [Parameter(Mandatory = $true)]
  [string]$PfxPath,
  [Parameter(Mandatory = $true)]
  [string]$PfxPassword,
  [string]$TimestampUrl = "http://timestamp.digicert.com",
  [string]$BundleRoot = "src-tauri\target\release\bundle"
)

$ErrorActionPreference = "Stop"

function Resolve-Signtool {
  param([string]$ExplicitPath)

  if ($ExplicitPath -and (Test-Path -LiteralPath $ExplicitPath)) {
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }

  $command = Get-Command signtool -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $sdkRoots = @(
    "$env:ProgramFiles(x86)\Windows Kits\10\bin",
    "$env:ProgramFiles\Windows Kits\10\bin"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  foreach ($root in $sdkRoots) {
    $candidate = Get-ChildItem -Path $root -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }

  throw "signtool.exe was not found. Install the Windows SDK or pass -SigntoolPath explicitly."
}

function Get-BundleArtifacts {
  param([string]$Root)

  $resolvedRoot = Resolve-Path -LiteralPath $Root
  $patterns = @("*.exe", "*.msi")
  $files = foreach ($pattern in $patterns) {
    Get-ChildItem -Path $resolvedRoot -Recurse -File -Filter $pattern
  }

  $filtered = $files | Where-Object {
    $_.FullName -match "\\bundle\\(nsis|msi)\\"
  } | Sort-Object FullName -Unique

  if (-not $filtered) {
    throw "No bundle artifacts were found under '$resolvedRoot'. Run 'npm run tauri build' first."
  }

  return $filtered
}

function Assert-Success {
  param(
    [int]$ExitCode,
    [string]$FilePath
  )

  if ($ExitCode -ne 0) {
    throw "Signing failed for '$FilePath' with exit code $ExitCode."
  }
}

$signtool = Resolve-Signtool -ExplicitPath $SigntoolPath
$certificate = Resolve-Path -LiteralPath $PfxPath
$artifacts = Get-BundleArtifacts -Root $BundleRoot

Write-Host "Using signtool:" $signtool
Write-Host "Using certificate:" $certificate
Write-Host "Artifacts to sign:"
$artifacts | ForEach-Object { Write-Host " - $($_.FullName)" }

foreach ($artifact in $artifacts) {
  Write-Host ""
  Write-Host "Signing $($artifact.FullName)..."
  & $signtool sign `
    /fd SHA256 `
    /td SHA256 `
    /tr $TimestampUrl `
    /f $certificate `
    /p $PfxPassword `
    $artifact.FullName

  Assert-Success -ExitCode $LASTEXITCODE -FilePath $artifact.FullName
}

Write-Host ""
Write-Host "Signature summary:"
foreach ($artifact in $artifacts) {
  $signature = Get-AuthenticodeSignature -FilePath $artifact.FullName
  Write-Host "$($artifact.Name): $($signature.Status) - $($signature.SignerCertificate.Subject)"
}
