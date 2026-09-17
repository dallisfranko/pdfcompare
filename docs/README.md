# PdfOverlay Web (local browser version)

A browser-based PDF overlay tool that keeps everything temporary and local.

## Privacy rules

- PDFs are chosen from your computer and read only in this browser tab
- Nothing is uploaded to a server by this app
- Original PDF files are never overwritten or replaced
- No recent-files list is saved
- Use **Clear everything** anytime
- Closing the tab discards the session

This still cannot prevent your browser, OS, or company security tools from recording that a web page was opened.

## How to open it (no coding)

### Option A — From this folder on your computer

1. Download/copy the whole `web` folder
2. Open `index.html` in Chrome or Edge  
   (If the page fails to load scripts from a local file, use Option B.)

### Option B — Tiny local viewer (still on your PC)

In the `web` folder, double-click `Open-PdfOverlay-Web.bat` on Windows, or run:

```bash
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/ in your browser.

Nothing is hosted on the internet by that command — it only serves files from the folder on your computer.

## Company / remote desktop note

If work PDFs live inside a remote desktop session, open this web tool **inside that same session** after IT approval, so you do not need to email PDFs around.
