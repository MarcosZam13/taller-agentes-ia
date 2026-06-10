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

DASHBOARD_URL="http://127.0.0.1:18789/#token=$TOKEN"

# Escribir un HTML temporal con meta-refresh — el token no queda en argv del navegador
TMPFILE=$(mktemp /tmp/openclaw-XXXXXX.html)
cat > "$TMPFILE" <<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=$DASHBOARD_URL">
  <title>OpenClaw Dashboard</title>
</head>
<body>Redirigiendo al dashboard de OpenClaw...</body>
</html>
HTML
# Limpiar el archivo después de que el navegador lo cargue
(sleep 10 && rm -f "$TMPFILE") &

echo "[+] Dashboard: http://127.0.0.1:18789 (abriendo con auth...)"

# Abrir el archivo HTML local — el token no aparece en los args del proceso
if command -v xdg-open &>/dev/null; then
  xdg-open "file://$TMPFILE"
elif command -v firefox &>/dev/null; then
  firefox "file://$TMPFILE" &
elif command -v chromium &>/dev/null; then
  chromium "file://$TMPFILE" &
else
  # Fallback: copiar al clipboard sin imprimir en stdout
  if command -v wl-copy &>/dev/null; then
    printf '%s' "$DASHBOARD_URL" | wl-copy
    echo "[+] URL copiada al clipboard — pegar en el navegador"
  elif command -v xclip &>/dev/null; then
    printf '%s' "$DASHBOARD_URL" | xclip -selection clipboard
    echo "[+] URL copiada al clipboard — pegar en el navegador"
  else
    echo "[!] Abrir manualmente: http://127.0.0.1:18789 y usar 'openclaw dashboard --no-open' para el token"
  fi
fi
