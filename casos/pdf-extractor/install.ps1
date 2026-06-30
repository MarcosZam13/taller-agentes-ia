# install.ps1 — Instala el caso "pdf-extractor" (extractor de PDF) sobre el chatbot base.
# Requiere haber corrido antes el instalador global: setup\install.ps1
# Necesita poppler (pdftotext); el instalador avisa si falta.
$ErrorActionPreference = "Stop"
$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
node (Join-Path $RepoDir "setup\install-case.mjs") pdf-extractor
