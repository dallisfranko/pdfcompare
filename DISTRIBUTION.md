# Distribution and USB handoff

This app is meant to be shared as a **portable folder** (or zip), not installed.

## Recommended workflow

1. Build/test on a **personal or approved** development computer.
2. Create the portable package (`scripts/package-usb.sh` or `.ps1`).
3. Ask **your** IT/security team for approval to use it on the work PC / remote desktop session.
4. If a colleague (for example Adam) also needs it:
   - Copy the same portable folder/zip onto a USB drive (or otherwise transfer the package).
   - They ask **their** IT/security for approval.
   - After approval, they copy the folder onto the work machine (or run from USB if allowed) and launch `PdfOverlay.exe`.

Approval is per person / per company policy. Sharing the USB does **not** replace approval.

## Create a USB-ready zip

### Linux / macOS / Git Bash

```bash
./scripts/package-usb.sh
```

Output:

```text
publish/PdfOverlay-portable-win-x64.zip
```

### Windows PowerShell

```powershell
.\scripts\package-usb.ps1
```

## Put it on a USB drive

1. Unzip `PdfOverlay-portable-win-x64.zip`, **or** copy the unzipped folder.
2. Copy the whole `PdfOverlay` folder to the USB drive.
3. Keep all files together. Do not send only `PdfOverlay.exe`.

## Recipient checklist

- [ ] Read `START-HERE.txt`
- [ ] Get IT approval before use on a company computer
- [ ] Copy the full folder to an allowed location
- [ ] Run `PdfOverlay.exe` inside the work/remote session where the PDFs already are
- [ ] Use **Clear Temporary Data** when finished if desired

## What not to do

- Do not create an installer
- Do not email confidential work PDFs to a personal inbox just to compare them locally
- Do not assume USB delivery equals authorization
