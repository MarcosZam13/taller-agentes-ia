#!/usr/bin/env bash
# open-dashboard.sh — Abre el dashboard de OpenClaw con autenticación correcta
# Uso: bash setup/open-dashboard.sh
#
# Por qué existe este script:
# El dashboard en http://127.0.0.1:18789 sin token siempre da error de auth.
# La URL correcta lleva el token como fragmento: http://127.0.0.1:18789/#token=XXX
# Este script obtiene ese token del config y abre la URL correcta.

export PATH="$HOME/.npm-global/bin:$PATH"
set -euo pipefail

# Verificar que el gateway está corriendo
if ! curl -sf http://127.0.0.1:18789/health &>/dev/null; then
  echo "[!] Gateway no responde. Iniciando..."
  systemctl --user start openclaw-gateway.service 2>/dev/null || \
    openclaw gateway run &
  sleep 3
fi

# Obtener URL con token (openclaw dashboard --no-open la copia al clipboard)
# La URL tiene formato: http://127.0.0.1:18789/#token=<TOKEN>
TOKEN=$(python3 -c "
import json, os
path = os.path.expanduser('~/.openclaw/openclaw.json')
with open(path) as f:
    d = json.load(f)
print(d.get('gateway',{}).get('auth',{}).get('token',''))
" 2>/dev/null)

if [[ -z "$TOKEN" ]]; then
  echo "[!] No se encontró token en ~/.openclaw/openclaw.json"
  echo "    Ejecutar: openclaw gateway install"
  exit 1
fi

URL="http://127.0.0.1:18789/#token=$TOKEN"
echo "[+] Dashboard: $URL"
echo "[+] Abriendo navegador..."

# Abrir en el navegador disponible
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v firefox &>/dev/null; then
  firefox "$URL" &
elif command -v chromium &>/dev/null; then
  chromium "$URL" &
else
  echo "[!] Copiar esta URL manualmente al navegador:"
  echo "    $URL"
fi
