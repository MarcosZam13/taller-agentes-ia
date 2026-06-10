#!/usr/bin/env bash
# open-vault.sh — Arranca el relay y abre el vault dashboard
# Uso: bash setup/open-vault.sh
#
# El vault dashboard (demo/vault/index.html) muestra en vivo los agentes
# y mensajes que pasan por el gateway de OpenClaw.
# Requiere que el gateway esté corriendo primero.

export PATH="$HOME/.npm-global/bin:$PATH"
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAY_DIR="$REPO_DIR/demo/vault"
RELAY_PID_FILE="/tmp/vault-relay.pid"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# 1. Verificar que el gateway está corriendo
if ! curl -sf http://127.0.0.1:18789/health &>/dev/null; then
  warn "Gateway no responde. Iniciando..."
  systemctl --user start openclaw-gateway.service 2>/dev/null || \
    openclaw gateway run &>/tmp/openclaw.log &
  for i in $(seq 1 12); do
    curl -sf http://127.0.0.1:18789/health &>/dev/null && break
    sleep 1
  done
  curl -sf http://127.0.0.1:18789/health &>/dev/null || error "Gateway no respondió. Ver: journalctl --user -u openclaw-gateway.service -n 30"
fi
info "Gateway activo en :18789"

# 2. Verificar dependencias del relay
if [[ ! -d "$RELAY_DIR/node_modules/ws" ]]; then
  info "Instalando dependencias del relay..."
  (cd "$RELAY_DIR" && npm install --silent)
fi

# 3. Matar relay anterior si existe
if [[ -f "$RELAY_PID_FILE" ]]; then
  OLD_PID=$(cat "$RELAY_PID_FILE")
  kill "$OLD_PID" 2>/dev/null || true
  rm -f "$RELAY_PID_FILE"
fi
# Liberar puerto 3001 si está ocupado
EXISTING=$(lsof -ti:3001 2>/dev/null || true)
[[ -n "$EXISTING" ]] && kill "$EXISTING" 2>/dev/null || true
sleep 0.5

# 4. Iniciar el relay en background
info "Iniciando relay en :3001..."
node "$RELAY_DIR/relay.mjs" >/tmp/vault-relay.log 2>&1 &
RELAY_PID=$!
echo "$RELAY_PID" > "$RELAY_PID_FILE"

# Esperar a que el relay esté listo (máx 8s)
for i in $(seq 1 8); do
  RELAY_STATUS=$(curl -sf http://127.0.0.1:3001/events 2>/dev/null || echo "")
  if [[ -n "$RELAY_STATUS" ]]; then
    CONNECTED=$(echo "$RELAY_STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('connected','false'))" 2>/dev/null || echo "false")
    if [[ "$CONNECTED" == "True" || "$CONNECTED" == "true" ]]; then
      info "Relay conectado al gateway ✓"
      break
    fi
  fi
  sleep 1
done
info "Relay PID $RELAY_PID — logs: tail -f /tmp/vault-relay.log"

# 5. Abrir el vault dashboard
VAULT_HTML="$RELAY_DIR/index.html"
info "Abriendo vault dashboard..."
if command -v xdg-open &>/dev/null; then
  xdg-open "file://$VAULT_HTML" 2>/dev/null &
elif command -v firefox &>/dev/null; then
  firefox "file://$VAULT_HTML" &
elif command -v chromium &>/dev/null; then
  chromium "file://$VAULT_HTML" &
else
  warn "Abrir manualmente: file://$VAULT_HTML"
fi

echo ""
info "=== VAULT DASHBOARD ACTIVO ==="
echo "  Dashboard:  file://$VAULT_HTML"
echo "  Relay API:  http://127.0.0.1:3001/events"
echo "  Relay logs: tail -f /tmp/vault-relay.log"
echo ""
echo "  Para detener el relay: kill $(cat $RELAY_PID_FILE 2>/dev/null || echo 'PID')"
