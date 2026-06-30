# install.ps1 — Instalación completa en Windows (PowerShell)
# Uso: Set-ExecutionPolicy -Scope CurrentUser Bypass; .\setup\install.ps1
# Requiere: Windows 10/11, PowerShell 5.1+
# Recomendado: PowerShell 7 (https://aka.ms/powershell)
#
# Qué hace este script:
#   1. Instala Node.js 22+ via winget (si no está)
#   2. Configura npm prefix sin permisos de admin
#   3. Instala openclaw@latest
#   4. Verifica y carga el .env
#   5. Aplica config de proveedores al gateway
#   6. Instala las 4 skills en el workspace
#   7. Instala dependencias del relay
#   8. Configura el gateway como tarea programada de Windows
#
# Si ya tenés WSL2 configurado, usá los pasos de Linux (install.sh) dentro de WSL.

param(
  [switch]$SkipNodeInstall,
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ── Colores ───────────────────────────────────────────────────────────────────
function ok($msg)   { Write-Host "[+] $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function err($msg)  { Write-Host "[x] $msg" -ForegroundColor Red; exit 1 }

$REPO_DIR = Split-Path -Parent $PSScriptRoot
Write-Host ""
Write-Host "=== Taller Agentes IA — Instalación Windows ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar Node.js 22+ ──────────────────────────────────────────────────
$nodeOk = $false
try {
  $nodeVer = (node --version 2>$null).TrimStart("v")
  $nodeMajor = [int]($nodeVer -split "\.")[0]
  if ($nodeMajor -ge 22) {
    ok "Node.js v$nodeVer encontrado"
    $nodeOk = $true
  } else {
    warn "Node.js v$nodeVer es muy viejo (se requiere 22+). Actualizando..."
  }
} catch {
  warn "Node.js no encontrado."
}

if (-not $nodeOk -and -not $SkipNodeInstall) {
  # Intentar instalar via winget (disponible en Windows 11 y Win10 actualizado)
  $wingetOk = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)
  if ($wingetOk) {
    ok "Instalando Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e
    # Recargar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    ok "Node.js instalado. Reiniciar PowerShell si los comandos siguen sin encontrarse."
  } else {
    err "winget no disponible. Instalar Node.js 22 manualmente desde https://nodejs.org y volver a ejecutar este script."
  }
}

# Verificar de nuevo
try {
  $nodeVer = (node --version 2>$null).TrimStart("v")
  $nodeMajor = [int]($nodeVer -split "\.")[0]
  if ($nodeMajor -lt 22) { err "Node.js $nodeVer instalado pero se necesita 22+." }
  ok "Node.js v$nodeVer listo"
} catch {
  err "node no encontrado en PATH. Reiniciar PowerShell e intentar de nuevo."
}

# ── 2. Configurar npm prefix sin admin ───────────────────────────────────────
$npmGlobal = "$env:USERPROFILE\.npm-global"
$currentPrefix = (npm config get prefix 2>$null).Trim()
if ($currentPrefix -ne $npmGlobal) {
  warn "Configurando npm prefix a $npmGlobal (evita errores de permisos)..."
  New-Item -ItemType Directory -Force -Path $npmGlobal | Out-Null
  npm config set prefix $npmGlobal

  # Agregar al PATH del usuario permanentemente
  $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
  $binPath = "$npmGlobal\bin"
  if ($userPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$binPath", "User")
    $env:Path = "$env:Path;$binPath"
    warn "PATH actualizado. Si 'openclaw' no se encuentra después, reiniciar PowerShell."
  }
}
ok "npm prefix: $npmGlobal"

# ── 3. Instalar openclaw ──────────────────────────────────────────────────────
$openclawOk = $null -ne (Get-Command openclaw -ErrorAction SilentlyContinue)
if ($openclawOk) {
  $ver = (openclaw --version 2>$null).Trim()
  warn "OpenClaw ya instalado (v$ver). Actualizando..."
}
ok "Instalando openclaw@latest..."
npm install -g openclaw@latest
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User") + ";$npmGlobal\bin"
ok "OpenClaw $(openclaw --version) instalado"

# ── 4. Verificar .env ─────────────────────────────────────────────────────────
$envFile = "$REPO_DIR\.env"
$envExample = "$REPO_DIR\.env.example"
if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    warn ".env no encontrado. Se copió .env.example → .env"
    warn "Completar $envFile con tus credenciales:"
    warn "  GROQ_API_KEY=gsk_...   (obtener en https://console.groq.com)"
    warn "  TELEGRAM_BOT_TOKEN=... (opcional, con @BotFather)"
    warn ""
    warn "Después de completar .env, volver a ejecutar este script."
    notepad $envFile  # abrir el archivo para que el usuario lo llene
    err "Completar .env y volver a ejecutar install.ps1"
  } else {
    err ".env no encontrado y tampoco .env.example. Verificar que estás en la raíz del repo."
  }
}

# Cargar variables del .env
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $idx = $line.IndexOf("=")
    if ($idx -gt 0) {
      $key = $line.Substring(0, $idx).Trim()
      $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

$hasGroq       = -not [string]::IsNullOrEmpty($env:GROQ_API_KEY)
$hasAzure      = (-not [string]::IsNullOrEmpty($env:AZURE_OPENAI_API_KEY)) -and
                 (-not [string]::IsNullOrEmpty($env:AZURE_OPENAI_ENDPOINT))
$hasOpenRouter = -not [string]::IsNullOrEmpty($env:OPENROUTER_API_KEY)

if (-not ($hasGroq -or $hasAzure -or $hasOpenRouter)) {
  err "Sin proveedor configurado en .env. Se necesita al menos GROQ_API_KEY (gratis en https://console.groq.com)"
}

if ($hasGroq)       { ok "Proveedor: Groq (recomendado para el taller)" }
elseif ($hasAzure)  { ok "Proveedor: Azure OpenAI" }
else                { ok "Proveedor: OpenRouter" }

# ── 5. Configurar e iniciar gateway ──────────────────────────────────────────
ok "Configurando gateway..."
Push-Location $REPO_DIR
node setup\apply-config.mjs
if ($LASTEXITCODE -ne 0) { warn "apply-config.mjs falló — continuar igual, ejecutar manualmente después" }

# Instalar/iniciar gateway como tarea programada de Windows
try {
  openclaw gateway install 2>$null
  ok "Gateway instalado como tarea programada de Windows"
} catch {
  warn "No se pudo instalar el gateway como servicio. Iniciando manualmente..."
}
try {
  openclaw gateway start 2>$null
  ok "Gateway iniciado"
} catch {
  warn "Intentar iniciar manualmente: openclaw gateway start"
}

# Esperar a que el gateway responda (máx 15s)
ok "Esperando al gateway..."
$gatewayOk = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:18789/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { $gatewayOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if ($gatewayOk) { ok "Gateway activo en :18789" }
else { warn "Gateway tardando en responder — continuar igual" }

# ── 6. Instalar las 4 skills ──────────────────────────────────────────────────
$workspace = "$env:USERPROFILE\.openclaw\workspace\skills"
foreach ($skill in @("expense-tracker", "second-brain", "pdf-extractor", "dev-assistant")) {
  # Se copia el directorio COMPLETO (no solo SKILL.md): varias skills traen un
  # motor .js determinista (expense.js, brain.js, pdf.js, runpy.js) que el agente
  # ejecuta. Si solo se copiara SKILL.md, esas skills quedarían rotas.
  $src = "$REPO_DIR\skills\$skill"
  $dst = "$workspace\$skill"
  if (Test-Path "$src\SKILL.md") {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item "$src\*" $dst -Recurse -Force
    ok "Skill $skill instalada"
  } else {
    warn "Skill $skill no encontrada en skills\$skill\SKILL.md"
  }
}

# Copiar AGENTS.md al workspace
$agentsWS = "$env:USERPROFILE\.openclaw\workspace"
if (Test-Path "$REPO_DIR\AGENTS.md") {
  New-Item -ItemType Directory -Force -Path $agentsWS | Out-Null
  Copy-Item "$REPO_DIR\AGENTS.md" "$agentsWS\AGENTS.md" -Force
  ok "AGENTS.md copiado al workspace"
}

# ── 7. Instalar dependencias del relay ────────────────────────────────────────
$vaultDir = "$REPO_DIR\demo\vault"
if (Test-Path "$vaultDir\package.json") {
  ok "Instalando dependencias del relay..."
  Push-Location $vaultDir
  npm install --silent
  Pop-Location
  ok "Dependencias del relay instaladas"
}

Pop-Location

# ── Resumen ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Instalación completa ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Verificar entorno:    node setup\check.js"             -ForegroundColor Cyan
Write-Host "  Abrir vault:          bash setup\open-vault.sh"        -ForegroundColor Cyan
Write-Host "     (o desde cmd):     node demo\vault\relay.mjs"       -ForegroundColor Cyan
Write-Host "  Dashboard OpenClaw:   bash setup\open-dashboard.sh"    -ForegroundColor Cyan
Write-Host "  Logs del gateway:     openclaw gateway status"         -ForegroundColor Cyan
Write-Host ""
warn "Si 'openclaw' no se reconoce, reiniciar PowerShell para que tome el nuevo PATH."
Write-Host ""
