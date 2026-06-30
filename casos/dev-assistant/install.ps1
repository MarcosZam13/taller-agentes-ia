# install.ps1 — Instala el caso "dev-assistant" (asistente de desarrollo) sobre el chatbot base.
# Requiere haber corrido antes el instalador global: setup\install.ps1
# Necesita python3; el instalador avisa si falta.
$ErrorActionPreference = "Stop"
$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
node (Join-Path $RepoDir "setup\install-case.mjs") dev-assistant
