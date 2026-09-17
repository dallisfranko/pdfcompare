# PdfOverlay

Portable, local-only PDF page overlay comparison tool (proof of concept).

Open two PDFs from disk, pick one page from each, overlay them, and adjust opacity. Nothing is uploaded. Original PDFs are never modified. Temporary files stay in a dedicated folder and are cleared on exit.

## Best way to use this at work

If your PDFs live inside a company **remote desktop** session, run PdfOverlay **inside that session** after IT approval. That avoids emailing files to your personal laptop.

You can also put the portable folder on a **USB drive** and give it to a colleague (for example Adam). They still need their own approval before using it on a company PC.

See [DISTRIBUTION.md](DISTRIBUTION.md) and [IT-REVIEW.md](IT-REVIEW.md).

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
dist/START-HERE.txt    # included in USB package
PRIVACY.md
IT-REVIEW.md
DISTRIBUTION.md
```

## Develop (personal / approved machine)

Prerequisites: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

```bash
dotnet restore PdfOverlay.sln
dotnet build PdfOverlay.sln -c Release
dotnet test PdfOverlay.sln -c Release
dotnet run --project src/PdfOverlay.App -c Release
```

## Make a USB-ready portable package

```bash
./scripts/package-usb.sh
```

Windows PowerShell:

```powershell
.\scripts\package-usb.ps1
```

Creates:

```text
publish/PdfOverlay-portable-win-x64.zip
publish/PdfOverlay/   # unzipped folder you can copy to USB
```

Recipients open `START-HERE.txt`, get approval, then run `PdfOverlay.exe`. No installation step.

## PoC / MVP features

1. Open two local PDFs
2. Display one selected page from each
3. Overlay the pages with opacity control
4. Align overlay page with nudge / scale controls
5. View zoom for inspection
6. Export / import project settings (JSON only — PDFs are never embedded)
7. Choose temporary working folder
8. Clear Temporary Data
9. Cleanup of application temp data on exit
10. USB-friendly portable folder/zip packaging
11. No recent-files list, no uploads, no source-file writes

See [PRIVACY.md](PRIVACY.md) for the full local-only policy.

## Important

Create, build, and test on a personal or approved development computer. Deliver only the reviewed portable build to a company-owned PC, and only after approval.
