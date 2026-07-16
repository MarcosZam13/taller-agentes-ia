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
#   6. Copia AGENTS.md base (deja un CHATBOT sin skills; los casos se instalan aparte)
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

# ── 1. Verificar Node.js (openclaw exige >= 22.22.3, NO basta un "22.x") ───────
$MIN_NODE = [version]"22.22.3"
function Get-NodeVersion {
  try {
    $raw = (node --version 2>$null)
    if (-not $raw) { return $null }
    return [version]($raw.TrimStart("v"))
  } catch { return $null }
}

$nodeVer = Get-NodeVersion
if ($nodeVer -and $nodeVer -ge $MIN_NODE) {
  ok "Node.js v$nodeVer OK (>= $MIN_NODE)"
} elseif ($SkipNodeInstall) {
  if ($nodeVer) { err "Node.js v$nodeVer es muy viejo; se requiere >= $MIN_NODE (y -SkipNodeInstall está activo)." }
  else          { err "Node.js no encontrado; se requiere >= $MIN_NODE (y -SkipNodeInstall está activo)." }
} else {
  if ($nodeVer) { warn "Node.js v$nodeVer es muy viejo (se requiere >= $MIN_NODE). Actualizando..." }
  else          { warn "Node.js no encontrado. Instalando..." }
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
    err "winget no disponible. Instalá Node.js 22 (>= $MIN_NODE) desde https://nodejs.org y volvé a ejecutar este script."
  }
  # Verificar de nuevo
  $nodeVer = Get-NodeVersion
  if (-not $nodeVer)          { err "node no encontrado en PATH. Reiniciá PowerShell e intentá de nuevo." }
  if ($nodeVer -lt $MIN_NODE) { err "Node.js v$nodeVer instalado pero se necesita >= $MIN_NODE." }
  ok "Node.js v$nodeVer listo"
}

# ── 2. npm: usar el prefix por DEFECTO (ya está en el PATH del instalador de Node) ─
# En Windows npm deja los ejecutables globales en la RAÍZ del prefix por defecto
# (%AppData%\npm), que el instalador de Node ya agrega al PATH. Personalizar el prefix
# —o agregarle "\bin"— saca a openclaw del PATH (falso "openclaw no instalado"). Si una
# corrida vieja dejó un prefix ~/.npm-global, lo revertimos al valor por defecto.
$currentPrefix = (npm config get prefix 2>$null)
if ($currentPrefix -and $currentPrefix -like "*.npm-global*") {
  warn "Revirtiendo prefix personalizado de npm ($($currentPrefix.Trim())) al valor por defecto..."
  npm config delete prefix 2>$null | Out-Null
}
# Asegurar que el bin global por defecto (%AppData%\npm) esté en el PATH del usuario.
$npmDefault = Join-Path $env:APPDATA "npm"
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$npmDefault*") {
  [Environment]::SetEnvironmentVariable("PATH", "$userPath;$npmDefault", "User")
  warn "Agregado $npmDefault al PATH del usuario (reiniciá PowerShell si openclaw no aparece)."
}
if ($env:Path -notlike "*$npmDefault*") { $env:Path = "$env:Path;$npmDefault" }
ok "npm: usando prefix por defecto; bin global en $npmDefault"

# ── 3. Instalar openclaw ──────────────────────────────────────────────────────
$openclawOk = $null -ne (Get-Command openclaw -ErrorAction SilentlyContinue)
if ($openclawOk) {
  $ver = (openclaw --version 2>$null).Trim()
  warn "OpenClaw ya instalado (v$ver). Actualizando..."
}
ok "Instalando openclaw@latest..."
npm install -g openclaw@latest
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User") + ";$npmDefault"
try   { ok "OpenClaw $(openclaw --version) instalado" }
catch { warn "OpenClaw instalado. Si 'openclaw' no responde, reiniciá PowerShell para tomar el PATH." }

# ── 4. Verificar .env ─────────────────────────────────────────────────────────
$envFile = "$REPO_DIR\.env"
$envExample = "$REPO_DIR\.env.example"
if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    warn ".env no encontrado. Se copió .env.example → .env"
    warn "Completar $envFile con tus credenciales:"
    warn "  OPENROUTER_API_KEY=sk-or-... (recomendado, https://openrouter.ai) → gpt-4o-mini"
    warn "  TELEGRAM_BOT_TOKEN=...       (opcional, con @BotFather)"
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
  err "Sin proveedor configurado en .env. Recomendado: OPENROUTER_API_KEY (https://openrouter.ai) → gpt-4o-mini"
}

# Prioridad: OpenRouter > Azure > Groq (igual que apply-config.mjs). gpt-4o-mini es
# la ruta validada del taller (tool-calling nativo confiable, que las skills necesitan).
if ($hasOpenRouter) { ok "Proveedor: OpenRouter (openai/gpt-4o-mini) — recomendado" }
elseif ($hasAzure)  { ok "Proveedor: Azure OpenAI (gpt-4o-mini)" }
else                { ok "Proveedor: Groq (llama-3.3-70b-versatile)" }

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

# ── 6. Copiar AGENTS.md base (chatbot sin skills) ─────────────────────────────
# El instalador global deja un CHATBOT PELADO: NO instala ninguna skill. Cada caso
# del taller se agrega después con su propio instalador (casos\<caso>\install.ps1),
# que copia su skill y la registra. Así en la exposición se ve la diferencia entre
# un chatbot normal y uno con herramientas.
$agentsWS = "$env:USERPROFILE\.openclaw\workspace"
if (Test-Path "$REPO_DIR\AGENTS.md") {
  New-Item -ItemType Directory -Force -Path $agentsWS | Out-Null
  Copy-Item "$REPO_DIR\AGENTS.md" "$agentsWS\AGENTS.md" -Force
  ok "AGENTS.md base copiado al workspace (chatbot sin skills)"
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
Write-Host "=== Instalación completa — tenés un CHATBOT funcional (sin herramientas) ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Probá el chatbot: abrí Telegram o http://127.0.0.1:18789 y conversá" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para darle herramientas, instalá uno o más casos:" -ForegroundColor Cyan
Write-Host "    .\casos\finanzas\install.ps1        # registrar gastos"          -ForegroundColor Cyan
Write-Host "    .\casos\second-brain\install.ps1    # notas / segundo cerebro"   -ForegroundColor Cyan
Write-Host "    .\casos\pdf-extractor\install.ps1   # leer PDFs (necesita poppler)" -ForegroundColor Cyan
Write-Host "    .\casos\dev-assistant\install.ps1   # ejecutar Python (necesita python3)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Verificar entorno:    node setup\check.js"             -ForegroundColor Cyan
Write-Host "  Dashboard OpenClaw:   bash setup\open-dashboard.sh"    -ForegroundColor Cyan
Write-Host "  Logs del gateway:     openclaw gateway status"         -ForegroundColor Cyan
Write-Host ""
warn "Si 'openclaw' no se reconoce, reiniciar PowerShell para que tome el nuevo PATH."
Write-Host ""
