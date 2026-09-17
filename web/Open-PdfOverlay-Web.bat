@echo off
setlocal
cd /d "%~dp0"

echo Starting local PdfOverlay web page on this computer only...
echo Nothing is uploaded. Close the black window when you are done.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Open-PdfOverlay-Web.ps1"
if errorlevel 1 (
  echo.
  echo Could not start the local viewer.
  echo Try opening index.html in Chrome or Edge instead.
  pause
)
