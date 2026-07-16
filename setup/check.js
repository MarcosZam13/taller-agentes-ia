#!/usr/bin/env node
// check.js — Valida que el entorno está listo para el taller
// Uso: node setup/check.js
// Requiere: .env en la raíz del repo (o variables en el entorno)

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");

// ─── Colores ────────────────────────────────────────────────────────────────
const ok   = (s) => `\x1b[32m[✓]\x1b[0m ${s}`;
const fail = (s) => `\x1b[31m[✗]\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m[!]\x1b[0m ${s}`;
const head = (s) => `\n\x1b[1m${s}\x1b[0m`;

let errors = 0;
let warnings = 0;

function check(label, passed, hint = "") {
  if (passed) {
    console.log(ok(label));
  } else {
    console.log(fail(label) + (hint ? `\n     → ${hint}` : ""));
    errors++;
  }
}

function checkWarn(label, passed, hint = "") {
  if (passed) {
    console.log(ok(label));
  } else {
    console.log(warn(label) + (hint ? `\n     → ${hint}` : ""));
    warnings++;
  }
}

// ─── Cargar .env si existe ──────────────────────────────────────────────────
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── 1. Node version ─────────────────────────────────────────────────────────
console.log(head("1. Runtime"));
const nodeVer = process.versions.node.split(".").map(Number);
check(
  `Node.js v${process.versions.node}`,
  nodeVer[0] >= 22,
  "Actualizar Node: https://nodejs.org o usar fnm/nvm"
);

// ─── 2. OpenClaw instalado ────────────────────────────────────────────────────
console.log(head("2. OpenClaw"));
import { execSync } from "child_process";

let openclawOk = false;
let openclawVer = "";
try {
  // execSync corre a través del shell → en Windows resuelve `openclaw.cmd` vía PATHEXT.
  // Con execFile("openclaw") daba un falso "no instalado" en Windows/Git Bash: el
  // ejecutable real es openclaw.cmd, no el shim sin extensión, y Node no lo resuelve
  // sin shell (aunque `openclaw --version` sí funcione al escribirlo en la terminal).
  openclawVer = execSync("openclaw --version", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  openclawOk = true;
} catch (_) {}
check(
  openclawOk ? `openclaw ${openclawVer}` : "openclaw no instalado",
  openclawOk,
  "Ejecutar: bash setup/install.sh"
);

// Verificar que el gateway responde
let gatewayOk = false;
if (openclawOk) {
  try {
    const resp = await fetch("http://127.0.0.1:18789/health", {
      signal: AbortSignal.timeout(3000),
    });
    gatewayOk = resp.ok || resp.status === 401;
  } catch (_) {}
  checkWarn(
    gatewayOk ? "Gateway responde en :18789" : "Gateway no responde en :18789",
    gatewayOk,
    "Iniciar: systemctl --user start openclaw-gateway.service  (o: openclaw gateway start)"
  );
}

// ─── 3. Variables de entorno ──────────────────────────────────────────────────
console.log(head("3. Variables de entorno"));

const groqKey        = process.env.GROQ_API_KEY           || "";
const azureEndpoint  = process.env.AZURE_OPENAI_ENDPOINT  || "";
const azureKey       = process.env.AZURE_OPENAI_API_KEY   || "";
const openrouterKey  = process.env.OPENROUTER_API_KEY     || "";
const tgToken        = process.env.TELEGRAM_BOT_TOKEN     || "";
const tgUser         = process.env.TELEGRAM_ALLOWED_USER_ID || "";

const hasGroq        = !!groqKey;
const hasAzure       = !!(azureEndpoint && azureKey);
const hasOpenRouter  = !!openrouterKey;

// Al menos un proveedor requerido. Prioridad = la de apply-config.mjs:
// OpenRouter > Azure > Groq (el primario real es el que el agente usa).
check(
  hasOpenRouter || hasAzure || hasGroq
    ? `Proveedor activo: ${hasOpenRouter ? "OpenRouter (primario, gpt-4o-mini)" : hasAzure ? "Azure OpenAI (gpt-4o-mini)" : "Groq (llama-3.3-70b)"}`
    : "Ningún proveedor configurado",
  hasOpenRouter || hasAzure || hasGroq,
  "Configurar OPENROUTER_API_KEY (recomendado) en .env"
);

// El taller usa OpenRouter (gpt-4o-mini). Groq y Azure quedan como alternativas:
// solo mostramos la key que el participante realmente configuró, sin exigir Groq.
if (hasOpenRouter) {
  console.log(ok(`  OpenRouter key: ${"*".repeat(8)}${openrouterKey.slice(-4)}`));
}
if (hasGroq) {
  console.log(ok(`  Groq key (alternativa): ${"*".repeat(8)}${groqKey.slice(-4)}`));
}
if (hasAzure) {
  console.log(ok(`  Azure endpoint: ${azureEndpoint.substring(0, 40)}...`));
}

checkWarn(
  tgToken
    ? "TELEGRAM_BOT_TOKEN configurado"
    : "TELEGRAM_BOT_TOKEN no configurado (opcional para taller básico)",
  !!tgToken,
  "Crear bot en @BotFather en Telegram"
);
checkWarn(
  tgUser
    ? `TELEGRAM_ALLOWED_USER_ID: ${tgUser}`
    : "TELEGRAM_ALLOWED_USER_ID no configurado",
  !!tgUser,
  "Obtener tu ID con @userinfobot en Telegram"
);

// ─── 4. Conexión al proveedor activo ─────────────────────────────────────────
console.log(head("4. Conexión al proveedor"));

async function testEndpoint(url, headers, body, label) {
  let status = null;
  let err = null;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    status = resp.status;
  } catch (e) {
    err = e.message;
  }
  const ok2 = status === 200 || status === 400 || status === 429;
  check(
    err ? `${label}: error de red — ${err}` : `${label}: HTTP ${status}`,
    ok2,
    status === 401 ? "API key inválida"
      : status === 404 ? "Deployment o modelo no encontrado"
      : status === 429 ? "OK (rate limit — credenciales válidas)"
      : err ? "Verificar endpoint en .env"
      : `HTTP ${status} inesperado`
  );
}

// Se testea el PRIMARIO real (mismo orden que apply-config.mjs): OpenRouter > Azure > Groq.
if (hasOpenRouter) {
  await testEndpoint(
    "https://openrouter.ai/api/v1/chat/completions",
    { Authorization: `Bearer ${openrouterKey}` },
    { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1 },
    "OpenRouter"
  );
} else if (hasAzure) {
  const base = azureEndpoint.replace(/\/$/, "");
  await testEndpoint(
    `${base}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview`,
    { "api-key": azureKey },
    { messages: [{ role: "user", content: "ping" }], max_tokens: 1 },
    "Azure OpenAI"
  );
} else if (hasGroq) {
  await testEndpoint(
    "https://api.groq.com/openai/v1/chat/completions",
    { Authorization: `Bearer ${groqKey}` },
    { model: "llama-3.1-8b-instant", messages: [{ role: "user", content: "ping" }], max_tokens: 1 },
    "Groq"
  );
} else {
  console.log(warn("Saltando test de conexión — ningún proveedor configurado"));
  warnings++;
}

// ─── 5. Telegram (si está configurado) ───────────────────────────────────────
console.log(head("5. Telegram"));

if (!tgToken) {
  console.log(warn("Telegram no configurado — se omite verificación"));
} else {
  let tgOk = false;
  let tgBotName = "";
  try {
    const resp = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    tgOk = data.ok === true;
    if (tgOk) tgBotName = data.result?.username || "";
  } catch (_) {}
  check(
    tgOk ? `Bot Telegram: @${tgBotName}` : "Bot Telegram: token inválido",
    tgOk,
    "Verificar TELEGRAM_BOT_TOKEN con @BotFather"
  );
}

// ─── 6. Skills ───────────────────────────────────────────────────────────────
console.log(head("6. Skills"));
const SKILLS = ["expense-tracker", "second-brain", "pdf-extractor", "dev-assistant"];
for (const skill of SKILLS) {
  const skillPath = resolve(ROOT, "skills", skill, "SKILL.md");
  check(
    `SKILL.md ${skill}`,
    existsSync(skillPath),
    `Archivo esperado: skills/${skill}/SKILL.md`
  );
  const wsSkill = resolve(process.env.HOME || "/root", ".openclaw/workspace/skills", skill, "SKILL.md");
  checkWarn(
    existsSync(wsSkill) ? `  ${skill} instalada en workspace` : `  ${skill} no en workspace`,
    existsSync(wsSkill),
    `Ejecutar: bash setup/install.sh`
  );
}

// ─── 7. Vault relay ──────────────────────────────────────────────────────────
console.log(head("7. Vault relay"));
const relayPath = resolve(ROOT, "demo/vault/relay.mjs");
const wsModulePath = resolve(ROOT, "demo/vault/node_modules/ws");
check("relay.mjs existe", existsSync(relayPath), `Archivo esperado: demo/vault/relay.mjs`);
checkWarn(
  existsSync(wsModulePath) ? "Dependencia ws instalada" : "Dependencia ws no instalada",
  existsSync(wsModulePath),
  "Ejecutar: cd demo/vault && npm install"
);
let relayOk = false;
try {
  const r = await fetch("http://127.0.0.1:3001/events", { signal: AbortSignal.timeout(1500) });
  relayOk = r.ok;
} catch (_) {}
checkWarn(
  relayOk ? "Relay activo en :3001" : "Relay no activo (opcional para verificación)",
  relayOk,
  "Iniciar con: bash setup/open-vault.sh"
);

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(50));
if (errors === 0 && warnings === 0) {
  console.log("\x1b[32m\x1b[1m¡Todo listo! Podés empezar el taller.\x1b[0m");
} else if (errors === 0) {
  console.log(`\x1b[33m\x1b[1mListo con ${warnings} advertencia(s) — el taller puede continuar.\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m${errors} error(es) crítico(s). Corregir antes de continuar.\x1b[0m`);
  process.exit(1);
}
