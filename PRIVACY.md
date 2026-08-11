# Privacy and local-only operating rules

PdfOverlay is designed as a **portable, local-only** PDF comparison tool.

## Guarantees the application aims to provide

- Runs without installation, services, drivers, browser extensions, or background processes.
- Does not require administrator permissions.
- Does not write to the Windows registry.
- Does not require Python, Node.js, Java, or other development runtimes on the destination PC when shipped as a self-contained build.
- Does not require an internet connection for normal use.
- Does not auto-start with Windows.
- Does not perform automatic updates.
- Does not collect analytics, telemetry, or usage information.
- Does not communicate with external servers from application code.
- Does not upload PDF files or document contents.
- Keeps all PDF processing on the local computer.
- Opens source PDFs read-only and never overwrites them.
- Does not maintain a recent-files list or permanently store recently opened file names.
- Does not save thumbnails or document previews after the application closes.
- Does not save alignment/opacity settings unless a future explicit project export is used.
- Stores temporary files only inside a clearly defined temporary working folder.
- Deletes application-created temporary files when the application closes.
- Provides a **Clear Temporary Data** command.
- Allows the user to choose the temporary working location.

## Honest limitation

This application does **not** claim to leave absolutely no trace on Windows. Operating systems, antivirus products, and company security tools may independently record that an executable was opened.

The application itself is responsible for:

- not installing anything
- not retaining PDF contents after exit
- not retaining file history
- not transmitting information
- cleaning up its own temporary files

## Temporary working folder

Default location (portable):

```text
<folder-containing-PdfOverlay.exe>\temp\
```

Use **Choose Temporary Folder…** to relocate it. Use **Clear Temporary Data** at any time. Closing the app also clears application-created temporary contents.
