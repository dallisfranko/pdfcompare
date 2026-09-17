$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Resolve-Path "$PSScriptRoot\..").Path }

$PublishDir = Join-Path $Root "publish\win-x64"
$Stage = Join-Path $Root "publish\PdfOverlay"
$Zip = Join-Path $Root "publish\PdfOverlay-portable-win-x64.zip"

dotnet publish (Join-Path $Root "src\PdfOverlay.App\PdfOverlay.App.csproj") `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -p:DebugType=none `
  -p:DebugSymbols=false `
  -o $PublishDir

Get-ChildItem -Path $PublishDir -Filter *.pdb -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage | Out-Null
Copy-Item -Path (Join-Path $PublishDir "*") -Destination $Stage -Recurse -Force

Copy-Item (Join-Path $Root "dist\START-HERE.txt") (Join-Path $Stage "START-HERE.txt") -Force
Copy-Item (Join-Path $Root "PRIVACY.md") (Join-Path $Stage "PRIVACY.md") -Force
Copy-Item (Join-Path $Root "IT-REVIEW.md") (Join-Path $Stage "IT-REVIEW.md") -Force
Copy-Item (Join-Path $Root "DISTRIBUTION.md") (Join-Path $Stage "DISTRIBUTION.md") -Force

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $Stage -DestinationPath $Zip

Write-Host "USB-ready package: $Zip"
Write-Host "Copy that zip (or the publish\PdfOverlay folder) onto a USB drive."
Write-Host "Each recipient still needs company approval before use on a work PC."
