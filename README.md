# PdfOverlay

Portable, local-only PDF page overlay comparison tool (proof of concept).

Open two PDFs from disk, pick one page from each, overlay them, and adjust opacity. Nothing is uploaded. Original PDFs are never modified. Temporary files stay in a dedicated folder and are cleared on exit.

## Why this stack

| Choice | Reason |
|--------|--------|
| **C# / .NET 8** | Self-contained Windows publish with no SDK on the destination PC |
| **Avalonia 11** | Desktop UI that can be developed on Windows/Linux/macOS and shipped for Windows |
| **PDFtoImage (PDFium)** | Local page rasterization |
| **SkiaSharp** | In-memory opacity compositing |

## Solution layout

```text
PdfOverlay.sln
src/
  PdfOverlay.Core/     # temp workspace, PDF open/render, overlay compose
  PdfOverlay.App/      # Avalonia desktop UI
tests/
  PdfOverlay.Tests/
PRIVACY.md
```

## Develop (personal / approved machine)

Prerequisites: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

```bash
dotnet restore PdfOverlay.sln
dotnet build PdfOverlay.sln -c Release
dotnet test PdfOverlay.sln -c Release
dotnet run --project src/PdfOverlay.App -c Release
```

## Publish a portable Windows folder (no installer)

On a Windows machine (or any machine that can target `win-x64`):

```bash
dotnet publish src/PdfOverlay.App/PdfOverlay.App.csproj \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=false \
  -o publish/win-x64
```

Distribute the entire `publish/win-x64` folder. Recipients run `PdfOverlay.exe`. No installation step.

Optional single-file experiment:

```bash
dotnet publish src/PdfOverlay.App/PdfOverlay.App.csproj \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true \
  -o publish/win-x64-single
```

Prefer the folder publish for clearer IT review of shipped files.

## PoC features

1. Open two local PDFs
2. Display one selected page from each
3. Overlay the pages
4. Opacity adjustment for the top page
5. Choose temporary working folder
6. Clear Temporary Data
7. Cleanup of application temp data on exit
8. No recent-files list, no uploads, no source-file writes

See [PRIVACY.md](PRIVACY.md) for the full local-only policy.

## Important

Create, build, and test on a personal or approved development computer. Deliver only the reviewed portable build to a company-owned PC.
