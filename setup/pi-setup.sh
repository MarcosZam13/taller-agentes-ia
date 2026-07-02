#!/usr/bin/env bash
# pi-setup.sh — Instalación TODO-EN-UNO para la Raspberry Pi del facilitador.
#
# Deja la Pi lista para la presentación:
#   1. OpenClaw + OpenRouter (gpt-4o-mini) + Telegram  → chatbot/agente
#   2. Los 4 casos instalados (finanzas, second-brain, pdf-extractor, dev-assistant)
#   3. El relay del vault sirviendo el dashboard + datos en vivo (puerto 3001)
#   4. Un túnel de Cloudflare que expone ese dashboard a una URL pública
#   5. Todo como servicios systemd que arrancan solos al prender la Pi
#
# Es para el FACILITADOR (Marcos). Los asistentes usan setup/install.sh + UN caso.
#
# Uso:
#   bash setup/pi-setup.sh                 # túnel rápido (URL aleatoria *.trycloudflare.com)
#   CF_TUNNEL_TOKEN=eyJ... bash setup/pi-setup.sh   # túnel con dominio (URL fija)
#
# NO rompe nada: usa servicios systemd de USUARIO propios (taller-*), no toca otros
# servicios, y es idempotente (se puede correr varias veces).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAY_PORT=3001
USER_UNIT_DIR="$HOME/.config/systemd/user"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
step()  { echo -e "\n${CYAN}=== $* ===${NC}"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

command -v systemctl >/dev/null || error "Esta Pi no tiene systemd. Script pensado para Raspberry Pi OS / Debian."

# ── 1. Instalación global (OpenClaw + proveedor + gateway) ────────────────────
step "1/5 · Instalación global de OpenClaw"
bash "$REPO_DIR/setup/install.sh"

# ── 2. Instalar los 4 casos ───────────────────────────────────────────────────
step "2/5 · Instalando los 4 casos"
for caso in finanzas second-brain pdf-extractor dev-assistant; do
  bash "$REPO_DIR/casos/$caso/install.sh" || warn "El caso $caso reportó algo — revisar arriba"
done

# ── 2b. Recordatorio diario por Telegram (best-effort) ────────────────────────
# La Pi es el destino natural del "Resumen diario": corre agenda (citas/pagos) +
# resumen de gastos y lo empuja a Telegram cada mañana. Solo si hay Telegram en .env.
[[ -f "$REPO_DIR/.env" ]] && { set -a; . "$REPO_DIR/.env"; set +a; }
if [[ -n "${TELEGRAM_ALLOWED_USER_ID:-}" ]]; then
  step "2b · Recordatorio diario por Telegram"
  bash "$REPO_DIR/setup/setup-reminders.sh" \
    || warn "No se pudo crear el recordatorio (ver mensaje arriba; si es por scopes, revisá 'openclaw devices list')."
else
  warn "Sin TELEGRAM_ALLOWED_USER_ID en .env — omito el recordatorio diario (configuralo y corré: bash setup/setup-reminders.sh)."
fi

# ── 3. Dependencias del relay + servicio systemd ──────────────────────────────
step "3/5 · Relay del vault (dashboard + datos en vivo)"
if [[ -f "$REPO_DIR/demo/vault/package.json" ]]; then
  (cd "$REPO_DIR/demo/vault" && npm install --silent 2>/dev/null) || \
    warn "npm install en demo/vault falló — el relay necesita 'ws'"
fi

# Habilitar linger para que los servicios de usuario corran sin login (Pi siempre on)
loginctl enable-linger "$USER" 2>/dev/null || warn "No se pudo habilitar linger (correr: sudo loginctl enable-linger $USER)"

mkdir -p "$USER_UNIT_DIR"
NODE_BIN="$(command -v node)"
cat > "$USER_UNIT_DIR/taller-vault-relay.service" <<EOF
[Unit]
Description=Taller Vault relay (dashboard + datos del gateway OpenClaw)
After=network-online.target openclaw-gateway.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR/demo/vault
ExecStart=$NODE_BIN $REPO_DIR/demo/vault/relay.mjs
Environment=NODE_ENV=production
${VAULT_PUBLIC_ORIGIN:+Environment=VAULT_PUBLIC_ORIGIN=$VAULT_PUBLIC_ORIGIN}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now taller-vault-relay.service
sleep 2
if curl -sf "http://127.0.0.1:$RELAY_PORT/events" >/dev/null; then
  info "Relay activo en http://127.0.0.1:$RELAY_PORT (sirve el dashboard y los datos)"
else
  warn "El relay no respondió aún — ver: journalctl --user -u taller-vault-relay -n 30"
fi

# ── 4. Instalar cloudflared ───────────────────────────────────────────────────
step "4/5 · Cloudflare Tunnel"
if ! command -v cloudflared >/dev/null; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    aarch64|arm64) CF_ARCH="arm64" ;;
    armv7l|armhf)  CF_ARCH="arm" ;;
    x86_64|amd64)  CF_ARCH="amd64" ;;
    *) error "Arquitectura no reconocida para cloudflared: $ARCH" ;;
  esac
  mkdir -p "$HOME/.local/bin"
  info "Descargando cloudflared ($CF_ARCH)..."
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH" \
    -o "$HOME/.local/bin/cloudflared"
  chmod +x "$HOME/.local/bin/cloudflared"
  export PATH="$HOME/.local/bin:$PATH"
  command -v cloudflared >/dev/null || warn "Agregá ~/.local/bin al PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
CF_BIN="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"
info "cloudflared: $("$CF_BIN" --version 2>/dev/null | head -1)"

# ── 5. Servicio del túnel ──────────────────────────────────────────────────────
step "5/5 · Túnel como servicio"
if [[ -n "${CF_TUNNEL_TOKEN:-}" ]]; then
  # Túnel CON dominio (URL fija). El token sale del dashboard de Cloudflare Zero Trust.
  # Configurá el hostname público → http://localhost:3001 desde ese dashboard.
  cat > "$USER_UNIT_DIR/taller-cloudflared.service" <<EOF
[Unit]
Description=Taller Cloudflare Tunnel (dominio fijo) → vault relay
After=network-online.target taller-vault-relay.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=$CF_BIN tunnel --no-autoupdate run --token $CF_TUNNEL_TOKEN
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now taller-cloudflared.service
  info "Túnel con dominio activo. La URL pública es la que configuraste en Cloudflare Zero Trust."
  warn "En el dashboard de Cloudflare: Public hostname → Service = http://localhost:$RELAY_PORT"
else
  # Túnel RÁPIDO (sin cuenta). URL aleatoria *.trycloudflare.com que CAMBIA al reiniciar.
  cat > "$USER_UNIT_DIR/taller-cloudflared.service" <<EOF
[Unit]
Description=Taller Cloudflare Quick Tunnel → vault relay
After=network-online.target taller-vault-relay.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=$CF_BIN tunnel --no-autoupdate --url http://localhost:$RELAY_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now taller-cloudflared.service
  sleep 6
  URL="$(journalctl --user -u taller-cloudflared --no-pager -n 50 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)"
  echo ""
  if [[ -n "$URL" ]]; then
    info "URL pública del dashboard: ${CYAN}$URL${NC}"
  else
    warn "Aún no aparece la URL. Buscala con:"
    echo "    journalctl --user -u taller-cloudflared -f | grep trycloudflare"
  fi
  warn "Túnel rápido: la URL CAMBIA cada vez que reinicia. Para URL fija, usá CF_TUNNEL_TOKEN."
fi

echo ""
info "=== Pi lista ==="
echo "  Dashboard (local):  http://localhost:$RELAY_PORT"
echo "  Dashboard (público): la URL de Cloudflare de arriba — abrila en cualquier celular"
echo "  Estado servicios:   systemctl --user status taller-vault-relay taller-cloudflared"
echo "  Logs del túnel:     journalctl --user -u taller-cloudflared -f"
echo "  Probar el agente:   abrí Telegram y escribile, o mirá el dashboard reaccionar"
