# install.ps1 — Instala el caso "finanzas" (rastreador de gastos) sobre el chatbot base.
# Requiere haber corrido antes el instalador global: setup\install.ps1
$ErrorActionPreference = "Stop"
$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
node (Join-Path $RepoDir "setup\install-case.mjs") finanzas
