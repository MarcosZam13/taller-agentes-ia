#!/usr/bin/env node
// apply-config.mjs — Aplica la configuración del taller al gateway de OpenClaw
// Estrategia: merge directo en ~/.openclaw/openclaw.json
// El gateway detecta el cambio y recarga automáticamente (hybrid reload mode)
//
// Uso: node setup/apply-config.mjs
// Requiere: variables en .env o en el entorno

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");
const HOME = process.env.HOME || "/root";

// ── Cargar .env ──────────────────────────────────────────────────────────────
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const {
  AZURE_OPENAI_ENDPOINT = "",
  AZURE_OPENAI_API_KEY = "",
  OPENROUTER_API_KEY = "",
  TELEGRAM_BOT_TOKEN = "",
  TELEGRAM_ALLOWED_USER_ID = "",
} = process.env;

const hasAzure      = !!(AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY);
const hasOpenRouter = !!OPENROUTER_API_KEY;
const hasTelegram   = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_ALLOWED_USER_ID);

if (!hasAzure && !hasOpenRouter) {
  console.error("Error: configurar AZURE_OPENAI_API_KEY o OPENROUTER_API_KEY en .env");
  process.exit(1);
}

// ── Leer config existente (preservar gateway token y otras settings) ──────────
const configPath = resolve(HOME, ".openclaw", "openclaw.json");
let existing = {};
if (existsSync(configPath)) {
  try {
    existing = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error(`Advertencia: no se pudo parsear ${configPath}: ${e.message}`);
    console.error("Continuando con config vacío — el gateway token puede perderse");
  }
}

// ── Deep merge helper ─────────────────────────────────────────────────────────
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── Construir las adiciones según proveedores disponibles ─────────────────────
const providers = {};

if (hasAzure) {
  providers.azure = {
    baseUrl: `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments`,
    apiKey: AZURE_OPENAI_API_KEY,
    api: "openai-completions",
    models: [
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini (Azure)",
        contextWindow: 128000,
        maxTokens: 16000,
      },
    ],
  };
}

if (hasOpenRouter) {
  providers.openrouter = {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
    api: "openai-completions",
    models: [
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini (OpenRouter)",
        contextWindow: 128000,
        maxTokens: 16000,
      },
    ],
  };
}

const primaryModel = hasAzure ? "azure/gpt-4o-mini" : "openrouter/openai/gpt-4o-mini";
const fallbackModels = hasAzure && hasOpenRouter ? ["openrouter/openai/gpt-4o-mini"] : [];

const modelAllowlist = {};
if (hasAzure)      modelAllowlist["azure/gpt-4o-mini"]            = { alias: "azure-mini" };
if (hasOpenRouter) modelAllowlist["openrouter/openai/gpt-4o-mini"] = { alias: "or-mini" };

const additions = {
  models: { providers },
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: {
        primary: primaryModel,
        ...(fallbackModels.length > 0 ? { fallbacks: fallbackModels } : {}),
      },
      models: modelAllowlist,
      skills: ["expense-tracker"],
    },
    list: [{ id: "main", default: true }],
  },
  session: {
    dmScope: "per-channel-peer",
    threadBindings: { enabled: true, idleHours: 24 },
  },
};

if (hasTelegram) {
  additions.channels = {
    telegram: {
      enabled: true,
      botToken: TELEGRAM_BOT_TOKEN,
      dmPolicy: "allowlist",
      allowFrom: [`tg:${TELEGRAM_ALLOWED_USER_ID}`],
      healthMonitor: { enabled: true },
    },
  };
}

// ── Merge y escribir ──────────────────────────────────────────────────────────
const merged = deepMerge(existing, additions);
writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

console.log(`✓ Config escrito en ${configPath}`);
console.log(`  Proveedor activo: ${hasAzure ? "Azure OpenAI" : "OpenRouter"}`);
if (hasTelegram) console.log("  Telegram: configurado");
console.log("  El gateway recargará automáticamente (hybrid mode)");

// Verificar que el gateway procesó el cambio
if (process.env.CHECK_RELOAD !== "0") {
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const resp = await fetch("http://127.0.0.1:18789/health", {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok || resp.status === 401) {
      console.log("✓ Gateway sigue activo tras el cambio de config");
    }
  } catch (_) {
    console.log("  (Gateway no responde en :18789 — verificar manualmente)");
  }
}
