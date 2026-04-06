param(
  [string]$BundleRoot = "src-tauri\target\release\bundle"
)

$ErrorActionPreference = "Stop"

$resolvedRoot = Resolve-Path -LiteralPath $BundleRoot
$artifacts = Get-ChildItem -Path $resolvedRoot -Recurse -File |
  Where-Object {
    $_.FullName -match "\\bundle\\(nsis|msi)\\" -and
    ($_.Extension -eq ".exe" -or $_.Extension -eq ".msi")
  } |
  Sort-Object FullName

if (-not $artifacts) {
  throw "No bundle artifacts were found under '$resolvedRoot'."
}

$artifacts | ForEach-Object {
  $signature = Get-AuthenticodeSignature -FilePath $_.FullName
  [pscustomobject]@{
    File   = $_.Name
    Status = $signature.Status
    Signer = $signature.SignerCertificate.Subject
  }
} | Format-Table -AutoSize
