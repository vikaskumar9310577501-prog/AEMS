# Copy your own product photos into AssestFlow device previews.
# Usage: put JPGs in .\my-device-photos\ then run:
#   .\scripts\import-user-device-images.ps1 -SourceDir "C:\path\to\my-device-photos"

param(
  [string]$SourceDir = (Join-Path $PSScriptRoot "..\my-device-photos")
)

$dest = Join-Path $PSScriptRoot "..\public\device-previews"
if (-not (Test-Path $SourceDir)) {
  Write-Host "Create folder and add photos: $SourceDir"
  Write-Host "Expected names: monitor.jpg, keyboard.jpg, mouse.jpg, ups.jpg, printer.jpg, qr-scanner.jpg, ..."
  exit 1
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$count = 0
Get-ChildItem $SourceDir -Include *.jpg,*.jpeg,*.png,*.webp -File | ForEach-Object {
  $name = $_.BaseName.ToLower() -replace '\s+','-'
  $ext = if ($_.Extension -match 'png|webp') { '.jpg' } else { '.jpg' }
  $target = Join-Path $dest ($name + $ext)
  Copy-Item $_.FullName $target -Force
  Write-Host "Imported -> $target"
  $count++
}
Write-Host "Done. $count file(s) copied. Restart app if running."
