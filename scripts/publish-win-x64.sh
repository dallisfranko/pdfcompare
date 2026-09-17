#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/publish/win-x64"

rm -rf "${OUT}"

dotnet publish "${ROOT}/src/PdfOverlay.App/PdfOverlay.App.csproj" \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=false \
  -p:DebugType=none \
  -p:DebugSymbols=false \
  -o "${OUT}"

# Native packages sometimes drop .pdb files; strip them from the portable folder.
find "${OUT}" -type f -name '*.pdb' -delete

echo "Portable folder ready: ${OUT}"
echo "Distribute that folder. Recipients run PdfOverlay.exe — no installer."
