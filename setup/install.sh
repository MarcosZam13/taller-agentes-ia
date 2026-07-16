#!/usr/bin/env bash
# install.sh — Instala OpenClaw (Linux, macOS y Windows vía Git Bash)
# Uso: bash setup/install.sh
# Requiere Node >= 22.22.3 (lo exige openclaw). Detecta nvm/fnm y no pelea con ellos.
set -euo pipefail

OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# 1. Verificar Node (openclaw exige >= 22.22.3; NO basta un "22.x" cualquiera)
MIN_NODE="22.22.3"
NODE_VER=$(node --version 2>/dev/null | sed 's/^v//')

# Sugerencia de instalación según el gestor de versiones que tenga el usuario.
# (nvm es una función del shell: se detecta por NVM_DIR o ~/.nvm, no con command -v.)
node_install_hint() {
  if [[ -n "${NVM_DIR:-}" || -d "$HOME/.nvm" ]]; then
    echo "Tenés nvm →  nvm install 22 && nvm alias default 22 && nvm use 22"
  elif [[ -n "${FNM_DIR:-}" || -d "$HOME/.fnm" || -d "$HOME/.local/share/fnm" ]] || command -v fnm &>/dev/null; then
    echo "Tenés fnm →  fnm install 22 && fnm use 22 && fnm default 22"
  else
    echo "Instalá Node 22 LTS desde https://nodejs.org  (o fnm: curl -fsSL https://fnm.vercel.app/install | bash)"
  fi
}

if [[ -z "$NODE_VER" ]]; then
  error "Node.js no encontrado.
    $(node_install_hint)"
fi
# ¿NODE_VER >= MIN_NODE? El menor de ambos (sort -V) debe ser MIN_NODE.
if [[ "$(printf '%s\n%s\n' "$MIN_NODE" "$NODE_VER" | sort -V | head -n1)" != "$MIN_NODE" ]]; then
  error "Node v$NODE_VER es muy viejo. openclaw requiere Node >= $MIN_NODE.
    $(node_install_hint)
    Luego REABRÍ la terminal y volvé a correr: bash setup/install.sh"
fi
info "Node.js v$NODE_VER OK (>= $MIN_NODE)"

# 2. npm prefix / PATH — depende del sistema y del gestor de node:
#   • Windows (Git Bash): el instalador de Node YA deja el bin global de npm en el
#     PATH. Personalizar el prefix rompe justo eso → openclaw queda fuera del PATH
#     (check.js diría "openclaw no instalado" aunque sí esté).
#   • nvm: maneja su propio prefix por versión; 'npm config set prefix' lo ROMPE
#     (aviso "nvm use --delete-prefix ...").
#   • Linux/macOS sin nvm: personalizar el prefix evita EACCES y hay que persistir
#     el PATH en el rc del shell (bash o zsh).
IS_WINDOWS=false
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=true ;; esac
USING_NVM=false
[[ -n "${NVM_DIR:-}" || -d "$HOME/.nvm" ]] && USING_NVM=true

if $IS_WINDOWS || $USING_NVM; then
  # Auto-sanar un prefix personalizado que una corrida vieja (o el paso de PowerShell
  # de la guía) pudo dejar, y que rompe nvm o saca a openclaw del PATH en Windows.
  CUR_PREFIX=$(npm config get prefix 2>/dev/null || true)
  if [[ "$CUR_PREFIX" == *".npm-global"* ]]; then
    warn "Prefix personalizado ('$CUR_PREFIX') que rompe $( $IS_WINDOWS && echo 'el PATH de Windows' || echo 'nvm' ). Quitándolo..."
    npm config delete prefix 2>/dev/null || true
  fi
  info "npm: usando el prefix por defecto ($( $IS_WINDOWS && echo 'Windows' || echo 'nvm' ) ya deja openclaw en el PATH)"
else
  # Linux/macOS sin nvm
  EXPECTED_PREFIX="$HOME/.npm-global"
  CURRENT_PREFIX=$(npm config get prefix 2>/dev/null || true)
  if [[ "$CURRENT_PREFIX" != "$EXPECTED_PREFIX" ]]; then
    warn "npm prefix en '$CURRENT_PREFIX'. Configurando $EXPECTED_PREFIX ..."
    mkdir -p "$EXPECTED_PREFIX"
    npm config set prefix "$EXPECTED_PREFIX"
  fi
  NPM_BIN="$EXPECTED_PREFIX/bin"

  # Persistir el PATH en el rc del shell (bash o zsh). Sin esto, openclaw se instala
  # pero las terminales nuevas no lo ven, y check.js diría "openclaw no instalado".
  PATH_LINE="export PATH=\"$NPM_BIN:\$PATH\""
  persist_path() {
    local rc="$1"
    [[ -z "$rc" ]] && return
    if [[ ! -f "$rc" ]] || ! grep -qF "$NPM_BIN" "$rc" 2>/dev/null; then
      printf '\n# Taller Agentes IA — PATH de npm global (openclaw)\n%s\n' "$PATH_LINE" >> "$rc"
      info "PATH de openclaw agregado a $rc"
    fi
  }
  case "$(basename "${SHELL:-bash}")" in
    zsh)  SHELL_RC="$HOME/.zshrc";  persist_path "$SHELL_RC" ;;
    bash) SHELL_RC="$HOME/.bashrc"; persist_path "$SHELL_RC" ;;
    *)    SHELL_RC="$HOME/.bashrc"; persist_path "$HOME/.bashrc"; persist_path "$HOME/.zshrc" ;;
  esac

  export PATH="$NPM_BIN:$PATH"
  info "npm prefix: $EXPECTED_PREFIX (bin: $NPM_BIN) OK"
fi

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
    Opción A (recomendada) — OpenRouter: OPENROUTER_API_KEY (https://openrouter.ai) → gpt-4o-mini
    Opción B — Azure OpenAI:             AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY (gpt-4o-mini)
    Opción C — Groq:                     GROQ_API_KEY (https://console.groq.com, gratis) → llama-3.3-70b"
fi

# Prioridad: OpenRouter > Azure > Groq (igual que apply-config.mjs). OpenRouter con
# gpt-4o-mini es la ruta validada del taller: hace tool-calling nativo confiable, que
# es lo que las skills necesitan. Groq queda como último recurso (su 70B sirve, pero
# el modelo recomendado del taller es gpt-4o-mini).
if [[ "$HAS_OPENROUTER" == true ]]; then
  info "Proveedor activo: OpenRouter (openai/gpt-4o-mini) — recomendado"
elif [[ "$HAS_AZURE" == true ]]; then
  info "Proveedor activo: Azure OpenAI ($AZURE_OPENAI_ENDPOINT — gpt-4o-mini)"
else
  info "Proveedor activo: Groq (llama-3.3-70b-versatile)"
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

# 7. Copiar AGENTS.md base al workspace
# El instalador global deja un CHATBOT PELADO: NO instala ninguna skill. Cada caso
# del taller se agrega después con su propio instalador (casos/<caso>/install.sh),
# que copia su skill y la registra. Así en la exposición se ve la diferencia entre
# un chatbot normal y uno con herramientas.
mkdir -p "$HOME/.openclaw/workspace"
cp "$REPO_DIR/AGENTS.md" "$HOME/.openclaw/workspace/" 2>/dev/null && \
  info "AGENTS.md base copiado al workspace (chatbot sin skills)" || true

# 8. Instalar dependencias del vault relay
if command -v npm &>/dev/null && [[ -f "$REPO_DIR/demo/vault/package.json" ]]; then
  info "Instalando dependencias del vault relay..."
  (cd "$REPO_DIR/demo/vault" && npm install --silent 2>/dev/null) && \
    info "Dependencias del vault instaladas" || \
    warn "npm install en demo/vault falló — ejecutar manualmente: cd demo/vault && npm install"
fi

echo ""
info "=== Instalación completa — tenés un CHATBOT funcional (sin herramientas) ==="
echo ""
warn "IMPORTANTE: reabrí la terminal (o corré 'source ${SHELL_RC:-~/.bashrc}') para que"
warn "el comando 'openclaw' quede disponible. Recién DESPUÉS corré: node setup/check.js"
echo ""
echo "  Probá el chatbot:  abrí Telegram o http://127.0.0.1:18789 y conversá"
echo ""
echo "  Para darle herramientas, instalá uno o más casos:"
echo "    bash casos/finanzas/install.sh        # registrar gastos"
echo "    bash casos/second-brain/install.sh    # notas / segundo cerebro"
echo "    bash casos/pdf-extractor/install.sh   # leer PDFs (necesita poppler)"
echo "    bash casos/dev-assistant/install.sh   # ejecutar Python (necesita python3)"
echo ""
echo "  Vault dashboard: bash setup/open-vault.sh"
echo "  Verificar:       node setup/check.js"
echo "  Logs:            journalctl --user -u openclaw-gateway.service -f"
