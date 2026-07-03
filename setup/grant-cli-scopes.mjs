#!/usr/bin/env node
// grant-cli-scopes.mjs — Otorga al device del CLI los scopes operator.* que hacen
// falta para operaciones de ESCRITURA contra el gateway (crear crons, etc.).
//
// Por qué existe: en una instalación limpia, el device del CLI se registra con solo
// `operator.read`, así que `openclaw cron add` falla con "el device no tiene permiso
// de escritura (operator.write)". `openclaw devices approve` no sirve acá porque es
// circular (el propio device que necesita aprobar es el que pide el permiso). Este
// script edita ~/.openclaw/devices/paired.json y le pone al/los device(s) los 5
// scopes en `scopes`, `approvedScopes` y `tokens.operator.scopes`, y vacía pending.json.
//
// El caller DEBE reiniciar el gateway después para que tome los scopes:
//   systemctl --user restart openclaw-gateway
//
// Uso: node setup/grant-cli-scopes.mjs

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const HOME = process.env.HOME || "/root";
const DEV = resolve(HOME, ".openclaw", "devices");
const pairedPath = resolve(DEV, "paired.json");
const pendingPath = resolve(DEV, "pending.json");

const SCOPES = [
  "operator.admin",
  "operator.read",
  "operator.write",
  "operator.approvals",
  "operator.pairing",
];

if (!existsSync(pairedPath)) {
  console.error(`[grant-cli-scopes] No existe ${pairedPath}.`);
  console.error("  El gateway tiene que haber arrancado y el CLI conectado al menos una vez. Probá: openclaw cron list");
  process.exit(1);
}

const paired = JSON.parse(readFileSync(pairedPath, "utf8"));
const keys = Object.keys(paired);
// Preferimos tocar solo devices del CLI; si no se detecta ninguno (esquema distinto),
// caemos a otorgar a todos (contexto del taller: un único usuario/host local).
const cliKeys = keys.filter((k) => {
  const d = paired[k] || {};
  return d.clientId === "cli" || d.clientMode === "cli";
});
const target = cliKeys.length ? cliKeys : keys;

let n = 0;
for (const k of target) {
  const d = paired[k];
  if (!d) continue;
  d.scopes = SCOPES.slice();
  d.approvedScopes = SCOPES.slice();
  if (d.tokens?.operator) d.tokens.operator.scopes = SCOPES.slice();
  n++;
}

writeFileSync(pairedPath, JSON.stringify(paired, null, 2) + "\n", "utf8");
if (existsSync(pendingPath)) writeFileSync(pendingPath, "{}\n", "utf8");

console.log(`[grant-cli-scopes] ✓ Scopes operator.* otorgados a ${n} device(s)${cliKeys.length ? " del CLI" : " (todos)"}; pending.json vaciado.`);
console.log("[grant-cli-scopes]   Reiniciá el gateway para aplicar: systemctl --user restart openclaw-gateway");
