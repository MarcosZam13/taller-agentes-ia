#!/usr/bin/env bash
# install.sh — Instala el caso "pdf-extractor" (extractor de PDF) sobre el chatbot base.
# Requiere haber corrido antes el instalador global: bash setup/install.sh
# Necesita poppler (pdftotext); el instalador avisa si falta.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$REPO_DIR/setup/install-case.mjs" pdf-extractor
