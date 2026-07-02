#!/usr/bin/env bash
# setup-memory-ollama.sh — OPT-IN: ENCIENDE la memoria semántica de OpenClaw con
# embeddings locales de Ollama (sin depender de OpenAI ni internet).
#
# IMPORTANTE: por defecto el taller corre con la memoria semántica APAGADA — la
# "memoria" de los agentes son los scripts deterministas (brain.js/expense.js). Este
# script es para DEMOSTRAR la memoria por embeddings: setea MEMORY_SEMANTIC=on en
# .env y reconstruye el índice. Sin este flag, apply-config.mjs deja la memoria off.
#
# Qué hace:
#   1. Verifica/instala Ollama
#   2. Descarga el modelo de embeddings (nomic-embed-text por defecto)
#   3. Agrega OLLAMA_BASE_URL + OLLAMA_EMBED_MODEL + MEMORY_SEMANTIC=on al .env (idempotente)
#   4. Crea el directorio de memoria del workspace
#   5. Aplica la config (apply-config.mjs registra ollama-embed + memorySearch.enabled=true)
#   6. Reinicia el gateway y reindexa la memoria
#
# Uso: bash setup/setup-memory-ollama.sh
#
# OJO (orden de instalación): si corrés esto DESPUÉS de instalar los casos, apply-config
# resetea el agente a chatbot pelado (deepMerge reemplaza el array de skills). Corré la
# memoria ANTES que los casos, o reinstalá los casos después (bash casos/<caso>/install.sh).
#
# Por qué: la búsqueda de memoria de OpenClaw usa embeddings y por defecto apunta
# al proveedor "openai" (que requiere API key de pago). Groq no hace embeddings.
# Ollama corre local, gratis, y resuelve la "memoria pausada".
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
WORKSPACE="$HOME/.openclaw/workspace"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── 1. Ollama instalado ───────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  info "Ollama ya instalado ($(ollama --version 2>/dev/null | head -1))"
else
  warn "Ollama no encontrado. Instalando (curl https://ollama.com/install.sh)..."
  curl -fsSL https://ollama.com/install.sh | sh || error "No se pudo instalar Ollama"
  info "Ollama instalado"
fi

# Asegurar que el servicio responde antes de hacer pull
if ! curl -sf "${OLLAMA_URL%/}/api/tags" &>/dev/null; then
  warn "Ollama no responde en $OLLAMA_URL — intentando arrancarlo..."
  (ollama serve &>/tmp/ollama-serve.log &) || true
  for i in $(seq 1 15); do
    curl -sf "${OLLAMA_URL%/}/api/tags" &>/dev/null && break
    sleep 1
  done
fi
curl -sf "${OLLAMA_URL%/}/api/tags" &>/dev/null \
  || error "Ollama no responde en $OLLAMA_URL. Arrancalo con 'ollama serve' y reintentá."

# ── 2. Modelo de embeddings ───────────────────────────────────────────────────
if ollama list 2>/dev/null | grep -q "^${EMBED_MODEL}"; then
  info "Modelo de embeddings '$EMBED_MODEL' ya descargado"
else
  info "Descargando modelo de embeddings '$EMBED_MODEL' (~270 MB)..."
  ollama pull "$EMBED_MODEL" || error "No se pudo descargar $EMBED_MODEL"
fi

# ── 3. .env (idempotente) ─────────────────────────────────────────────────────
[[ -f "$ENV_FILE" ]] || error ".env no encontrado en $ENV_FILE. Corré primero bash setup/install.sh"

ensure_env() {
  local key="$1" val="$2"
  if grep -qE "^${key}=.+" "$ENV_FILE"; then
    info "$key ya está activo en .env — no se toca"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    info "$key=$val agregado a .env"
  fi
}
ensure_env "OLLAMA_BASE_URL"   "$OLLAMA_URL"
ensure_env "OLLAMA_EMBED_MODEL" "$EMBED_MODEL"
# Enciende la memoria semántica en apply-config.mjs (por defecto está apagada).
ensure_env "MEMORY_SEMANTIC" "on"

# ── 4. Directorio de memoria ──────────────────────────────────────────────────
mkdir -p "$WORKSPACE/memory"
info "Directorio de memoria listo: $WORKSPACE/memory"

# ── 5. Aplicar config ─────────────────────────────────────────────────────────
info "Aplicando config (registra ollama-embed + memorySearch)..."
node "$REPO_DIR/setup/apply-config.mjs" || error "apply-config.mjs falló"

# ── 6. Reiniciar gateway + reindexar ──────────────────────────────────────────
if command -v systemctl &>/dev/null && systemctl --user &>/dev/null 2>&1; then
  systemctl --user restart openclaw-gateway.service 2>/dev/null \
    && info "Gateway reiniciado" \
    || warn "No se pudo reiniciar el gateway — reiniciá manualmente"
  sleep 2
fi

info "Construyendo el índice de memoria (embeddings)..."
# IMPORTANTE: 'memory status --index' construye el índice Y escribe el metadata.
# 'memory index --force' por sí solo deja el metadata incompleto en esta versión
# y la búsqueda vectorial queda "paused until memory is rebuilt".
openclaw memory status --index --agent main >/dev/null 2>&1 \
  || warn "El índice falló — revisá 'openclaw memory status'"

echo ""
info "=== Memoria semántica activada ==="
openclaw memory status | grep -E "Provider:|Model:|Vector search:|Indexed:" || true
echo ""
echo "  Probá: creá una nota en $WORKSPACE/memory/*.md, luego:"
echo "    openclaw memory status --index --agent main   # reconstruye el índice"
echo "    openclaw memory search \"tu consulta\""
