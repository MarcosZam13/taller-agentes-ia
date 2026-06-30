#!/usr/bin/env bash
# install.sh — Instala el caso "finanzas" (rastreador de gastos) sobre el chatbot base.
# Requiere haber corrido antes el instalador global: bash setup/install.sh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$REPO_DIR/setup/install-case.mjs" finanzas
