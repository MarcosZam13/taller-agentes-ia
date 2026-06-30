#!/usr/bin/env bash
# install.sh — Instala OpenClaw en Linux (probado en CachyOS/Arch)
# Uso: bash setup/install.sh
set -euo pipefail

OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# 1. Verificar Node 22+
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
if [[ -z "$NODE_MAJOR" ]]; then
  error "Node.js no encontrado. Instalar con: curl -fsSL https://fnm.vercel.app/install | bash"
fi
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  error "Se requiere Node 22+. Versión actual: $(node --version)"
fi
info "Node.js $(node --version) OK"

# 2. Verificar/configurar npm prefix (evita EACCES en Linux)
CURRENT_PREFIX=$(npm config get prefix 2>/dev/null)
EXPECTED_PREFIX="$HOME/.npm-global"
if [[ "$CURRENT_PREFIX" != "$EXPECTED_PREFIX" ]]; then
  warn "npm prefix en '$CURRENT_PREFIX'. Configurando $EXPECTED_PREFIX ..."
  mkdir -p "$EXPECTED_PREFIX"
  npm config set prefix "$EXPECTED_PREFIX"
  # Agregar al PATH si no está
  if ! echo "$PATH" | grep -q "$EXPECTED_PREFIX/bin"; then
    warn "Agregar esto a ~/.bashrc o ~/.zshrc:"
    warn "  export PATH=\"\$HOME/.npm-global/bin:\$PATH\""
  fi
fi
export PATH="$EXPECTED_PREFIX/bin:$PATH"
info "npm prefix: $EXPECTED_PREFIX OK"

# 3. Instalar OpenClaw
if command -v openclaw &>/dev/null; then
  CURRENT_VER=$(openclaw --version 2>/dev/null || echo "desconocida")
  warn "OpenClaw ya instalado (v$CURRENT_VER). Actualizando..."
fi
info "Instalando openclaw@latest..."
npm install -g openclaw@latest
info "OpenClaw $(openclaw --version) instalado"

# 4. Verificar variables de entorno requeridas
if [[ ! -f "$REPO_DIR/.env" ]]; then
  if [[ -f "$REPO_DIR/.env.example" ]]; then
    warn ".env no encontrado. Copiando .env.example → .env"
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    warn "Editar $REPO_DIR/.env con tus credenciales antes de continuar"
    error "Completar .env y volver a ejecutar install.sh"
  else
    error ".env no encontrado. Ver .env.example para las variables requeridas."
  fi
fi

# Cargar variables desde .env
set -a
# shellcheck source=/dev/null
source "$REPO_DIR/.env"
set +a

# Verificar que al menos un proveedor esté configurado
HAS_GROQ=false
HAS_AZURE=false
HAS_OPENROUTER=false
[[ -n "${GROQ_API_KEY:-}" ]] && HAS_GROQ=true
[[ -n "${AZURE_OPENAI_API_KEY:-}" && -n "${AZURE_OPENAI_ENDPOINT:-}" ]] && HAS_AZURE=true
[[ -n "${OPENROUTER_API_KEY:-}" ]] && HAS_OPENROUTER=true

if [[ "$HAS_GROQ" == false && "$HAS_AZURE" == false && "$HAS_OPENROUTER" == false ]]; then
  error "Se requiere al menos un proveedor en .env:
    Opción A (recomendada) — Groq: GROQ_API_KEY (https://console.groq.com, gratis)
    Opción B — OpenRouter:        OPENROUTER_API_KEY (https://openrouter.ai)
    Opción C — Azure OpenAI:      AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY"
fi

# Prioridad: Groq > Azure > OpenRouter (igual que apply-config.mjs)
if [[ "$HAS_GROQ" == true ]]; then
  info "Proveedor activo: Groq (llama-3.1-70b-versatile)"
elif [[ "$HAS_AZURE" == true ]]; then
  info "Proveedor activo: Azure OpenAI ($AZURE_OPENAI_ENDPOINT)"
else
  info "Proveedor activo: OpenRouter"
fi

# 5. Instalar como systemd user service
if command -v systemctl &>/dev/null && systemctl --user &>/dev/null 2>&1; then
  if ! systemctl --user is-enabled openclaw-gateway.service &>/dev/null; then
    info "Instalando servicio systemd de usuario..."
    openclaw gateway install 2>&1 | grep -v "^$" || true
    systemctl --user daemon-reload 2>/dev/null
    systemctl --user enable openclaw-gateway.service 2>/dev/null
  fi
  systemctl --user start openclaw-gateway.service 2>/dev/null && \
    info "Servicio openclaw-gateway.service iniciado" || \
    warn "No se pudo iniciar el servicio. Ejecutar: systemctl --user start openclaw-gateway.service"
else
  warn "systemd no disponible. Iniciando gateway en background..."
  openclaw gateway run &>/tmp/openclaw-install.log &
  disown
fi

# Esperar a que el gateway responda (máx 15s)
info "Esperando al gateway..."
for i in $(seq 1 15); do
  curl -sf http://127.0.0.1:18789/health &>/dev/null && break
  sleep 1
done
curl -sf http://127.0.0.1:18789/health &>/dev/null || warn "Gateway tardando en responder — continuar igual"

# 6. Aplicar configuración de proveedores vía config.patch
info "Aplicando configuración de modelos y skills..."
node "$REPO_DIR/setup/apply-config.mjs" && info "Configuración aplicada" || \
  warn "apply-config.mjs falló — ejecutar manualmente: node setup/apply-config.mjs"

# 7. Instalar las 4 skills en el workspace
# Se copia el directorio COMPLETO de cada skill (no solo SKILL.md): varias skills
# traen un motor .js determinista (expense.js, brain.js, pdf.js, runpy.js) que el
# agente ejecuta. Si solo se copiara SKILL.md, esas skills quedarían rotas.
for SKILL in expense-tracker second-brain pdf-extractor dev-assistant; do
  SKILL_DEST="$HOME/.openclaw/workspace/skills/$SKILL"
  if [[ -f "$REPO_DIR/skills/$SKILL/SKILL.md" ]]; then
    mkdir -p "$SKILL_DEST"
    cp -r "$REPO_DIR/skills/$SKILL/." "$SKILL_DEST/"
    info "Skill $SKILL instalada en workspace"
  else
    warn "Skill $SKILL no encontrada en skills/$SKILL/SKILL.md — omitida"
  fi
done

# Copiar AGENTS.md al workspace
cp "$REPO_DIR/AGENTS.md" "$HOME/.openclaw/workspace/" 2>/dev/null && \
  info "AGENTS.md copiado al workspace" || true

# 8. Instalar dependencias del vault relay
if command -v npm &>/dev/null && [[ -f "$REPO_DIR/demo/vault/package.json" ]]; then
  info "Instalando dependencias del vault relay..."
  (cd "$REPO_DIR/demo/vault" && npm install --silent 2>/dev/null) && \
    info "Dependencias del vault instaladas" || \
    warn "npm install en demo/vault falló — ejecutar manualmente: cd demo/vault && npm install"
fi

echo ""
info "=== Instalación completa ==="
echo "  Vault dashboard: bash setup/open-vault.sh"
echo "  Dashboard:       bash setup/open-dashboard.sh"
echo "  Verificar:       node setup/check.js"
echo "  Logs:            journalctl --user -u openclaw-gateway.service -f"
