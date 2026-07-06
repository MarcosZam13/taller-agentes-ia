#!/usr/bin/env bash
# setup-reminders.sh — Recordatorios proactivos por Telegram vía el cron nativo de
# OpenClaw. Crea (idempotente) un "Resumen diario" que cada mañana ejecuta los
# scripts de las skills (agenda de citas/pagos/pendientes + resumen de gastos) y
# empuja el resumen al chat de Telegram del usuario.
#
# NO usa systemd: el scheduler es el propio Gateway de OpenClaw (openclaw cron).
#
# Requisitos:
#   - Instalador global + al menos el caso second-brain (y ojalá finanzas) instalados.
#   - Telegram configurado (TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USER_ID en .env).
#   - Gateway corriendo (systemctl --user status openclaw-gateway).
#
# Uso:
#   bash setup/setup-reminders.sh            # crea/actualiza el resumen diario (07:00)
#   bash setup/setup-reminders.sh --test     # además dispara un push de prueba en ~2 min
#
# Variables opcionales (en .env o entorno):
#   BRIEF_CRON="0 7 * * *"          # horario (cron 5 campos). Default 07:00 diario.
#   BRIEF_TZ="America/Costa_Rica"   # zona horaria IANA.
#   BRIEF_NAME="Resumen diario"     # nombre del job.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C_G="\033[0;32m"; C_Y="\033[1;33m"; C_R="\033[0;31m"; C_N="\033[0m"
info() { echo -e "${C_G}[+]${C_N} $*"; }
warn() { echo -e "${C_Y}[!]${C_N} $*"; }
die()  { echo -e "${C_R}[x]${C_N} $*" >&2; exit 1; }

# ── Cargar .env ───────────────────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a; # shellcheck disable=SC1091
  . "$ROOT/.env"; set +a
fi

command -v openclaw >/dev/null 2>&1 || die "No se encontró 'openclaw' en el PATH."
[ -n "${TELEGRAM_ALLOWED_USER_ID:-}" ] || die "Falta TELEGRAM_ALLOWED_USER_ID en .env (el chatId de Telegram destino)."

BRIEF_CRON="${BRIEF_CRON:-0 7 * * *}"
BRIEF_TZ="${BRIEF_TZ:-America/Costa_Rica}"
BRIEF_NAME="${BRIEF_NAME:-Resumen diario}"

# El prompt que corre el agente. Le exige USAR los scripts (memoria = scripts) y no
# inventar nada. Los paths son los del workspace instalado.
BRIEF_PROMPT=$(cat <<'PROMPT'
Armá el resumen diario del usuario, en español y en tono cercano (usá "vos"). Seguí estos pasos con la herramienta exec y NO inventes datos:
1. Ejecutá: node ~/.openclaw/workspace/skills/second-brain/brain.js agenda
   → lo que tiene fecha. Puede traer una sección "⚠️ Atrasados" (vencidos sin marcar
     hecho) y después la agenda de lo próximo. Respetá esa división.
2. Ejecutá: node ~/.openclaw/workspace/skills/second-brain/brain.js pendientes
   → cosas por hacer SIN fecha (ej. "comprar PS5"), que no aparecen en la agenda.
3. Ejecutá: node ~/.openclaw/workspace/skills/expense-tracker/expense.js summary
   → es el gasto del mes por categoría.
Con SOLO esa salida, redactá un mensaje breve con estas secciones, en este orden:
"⚠️ Atrasados" (si la agenda trajo esa sección; OMITILA si no hay), "Qué se viene"
(la parte de agenda de hoy en adelante; si está vacía, decilo), "Pendientes" (lo de
pendientes; OMITÍ la sección si no hay ninguno), y "Gastos del mes" (el total y las
2-3 categorías top). Si algún script no existe o falla, omití esa sección sin inventarla.
No agregues horas, montos ni fechas que los scripts no hayan impreso.
PROMPT
)

# ── Idempotencia: si ya existe un job con ese nombre, borrarlo y recrearlo ─────
existing_id="$(openclaw cron list --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const j=(Array.isArray(a)?a:(a.jobs||a.items||[])).find(x=>x&&x.name===process.argv[1]);process.stdout.write(j&&(j.id||j.jobId)||"");}catch{process.stdout.write("");}})' "$BRIEF_NAME" 2>/dev/null || true)"

if [ -n "$existing_id" ]; then
  warn "Ya existe un job \"$BRIEF_NAME\" (id $existing_id). Lo reemplazo."
  openclaw cron rm "$existing_id" >/dev/null 2>&1 || warn "No pude borrar $existing_id (sigo)."
fi

crear_brief() {
  openclaw cron add \
    --name "$BRIEF_NAME" \
    --cron "$BRIEF_CRON" \
    --tz "$BRIEF_TZ" \
    --agent main \
    --session isolated \
    --message "$BRIEF_PROMPT" \
    --announce \
    --channel telegram \
    --to "$TELEGRAM_ALLOWED_USER_ID" \
    --best-effort-deliver 2>&1
}

info "Creando \"$BRIEF_NAME\" ($BRIEF_CRON, $BRIEF_TZ) → Telegram $TELEGRAM_ALLOWED_USER_ID"
set +e
add_out="$(crear_brief)"; add_rc=$?
set -e

# Auto-remediar el gotcha de scopes: el device del CLI nace con solo operator.read y
# `cron add` necesita operator.write. Otorgamos scopes, reiniciamos el gateway y
# reintentamos UNA vez (en vez de solo imprimir instrucciones manuales).
if [ $add_rc -ne 0 ] && echo "$add_out" | grep -qiE "scope|pairing|operator\.write|permiso de escritura"; then
  warn "El device del CLI no tiene operator.write. Otorgando scopes automáticamente…"
  if node "$ROOT/setup/grant-cli-scopes.mjs"; then
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --user restart openclaw-gateway >/dev/null 2>&1 \
        || warn "No pude reiniciar el gateway — hacelo a mano: systemctl --user restart openclaw-gateway"
      for _ in $(seq 1 15); do
        systemctl --user is-active openclaw-gateway 2>/dev/null | grep -q active && { sleep 2; break; }
        sleep 1
      done
    else
      warn "Sin systemctl: reiniciá el gateway manualmente y reintentá."
    fi
    info "Reintentando crear el recordatorio…"
    set +e; add_out="$(crear_brief)"; add_rc=$?; set -e
  fi
fi

echo "$add_out" | tail -3
if [ $add_rc -ne 0 ]; then
  echo "$add_out" | grep -qiE "credential|token|password" && {
    warn "Falta el token de auth del gateway. Corré primero:  node setup/apply-config.mjs  (genera gateway.auth.token) y reiniciá el gateway."
  }
  echo "$add_out" | grep -qiE "scope|pairing" && {
    warn "Persistió el problema de scopes. Fix manual: node setup/grant-cli-scopes.mjs && systemctl --user restart openclaw-gateway"
  }
  die "No se pudo crear el recordatorio (cron add salió con código $add_rc)."
fi

info "Listo. Verificá con: openclaw cron list"

# ── Prueba opcional: push en ~2 minutos y auto-borrado ────────────────────────
if [ "${1:-}" = "--test" ]; then
  info "Programando un push de PRUEBA en ~2 min (se borra solo al correr)…"
  openclaw cron add \
    --name "${BRIEF_NAME} (prueba)" \
    --at "2m" \
    --tz "$BRIEF_TZ" \
    --agent main \
    --session isolated \
    --message "$BRIEF_PROMPT" \
    --announce \
    --channel telegram \
    --to "$TELEGRAM_ALLOWED_USER_ID" \
    --best-effort-deliver \
    --delete-after-run
  info "Esperá ~2 min el mensaje del bot en Telegram. Ver estado: openclaw cron runs"
fi
