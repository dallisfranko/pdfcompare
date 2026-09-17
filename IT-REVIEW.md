# IT review one-pager — PdfOverlay

## Request

Permission to run a **portable, local-only** PDF page overlay comparison tool on an approved company Windows computer (including remote desktop sessions).

## What we are asking to run

- A folder containing `PdfOverlay.exe` and its dependencies
- **No installer**
- **No administrator rights** required (`asInvoker`)
- **No registry writes** by the application
- **No services, drivers, browser extensions, or startup entries**
- **No automatic updates**
- **No analytics/telemetry** from application code
- **No network features** for normal use; PDF processing stays on the local computer
- Source PDFs are opened **read-only** and are never overwritten

## Why it is needed

Staff compare PDF pages while working inside the company remote desktop environment, where the documents already live. Moving those files to a personal computer by email is undesirable.

## Temporary files

- Default working folder: `temp` beside `PdfOverlay.exe` (USB/portable friendly)
- User can choose another temporary folder
- **Clear Temporary Data** command is available
- Application clears its temporary data on exit
- No recent-files list; previews are not kept after close

## Distribution

May be copied as a folder or zip (including via USB) to other employees **after each person receives approval**.

## Honest limitation

Windows, antivirus, or company security tooling may still record that the executable was launched. The application itself does not install software, retain PDF contents after exit, keep file history, or transmit documents.

## Supporting files in the package

- `START-HERE.txt`
- `PRIVACY.md`
- `IT-REVIEW.md` (this file)
