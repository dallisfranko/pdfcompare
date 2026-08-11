#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${ROOT}/publish/PdfOverlay"
ZIP="${ROOT}/publish/PdfOverlay-portable-win-x64.zip"

bash "${ROOT}/scripts/publish-win-x64.sh"

rm -rf "${STAGE}"
mkdir -p "${STAGE}"

# App binaries
cp -a "${ROOT}/publish/win-x64/." "${STAGE}/"

# Recipient / IT docs travel with the USB package
cp "${ROOT}/dist/START-HERE.txt" "${STAGE}/START-HERE.txt"
cp "${ROOT}/PRIVACY.md" "${STAGE}/PRIVACY.md"
cp "${ROOT}/IT-REVIEW.md" "${STAGE}/IT-REVIEW.md"
cp "${ROOT}/DISTRIBUTION.md" "${STAGE}/DISTRIBUTION.md"

rm -f "${ZIP}"
(
  cd "${ROOT}/publish"
  zip -r -q "$(basename "${ZIP}")" "PdfOverlay"
)

echo "USB-ready package: ${ZIP}"
echo "Copy that zip (or the publish/PdfOverlay folder) onto a USB drive."
echo "Each recipient still needs company approval before use on a work PC."
