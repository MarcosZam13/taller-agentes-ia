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
  GROQ_API_KEY = "",
  AZURE_OPENAI_ENDPOINT = "",
  AZURE_OPENAI_API_KEY = "",
  OPENROUTER_API_KEY = "",
  OLLAMA_BASE_URL = "",
  TELEGRAM_BOT_TOKEN = "",
  TELEGRAM_ALLOWED_USER_ID = "",
} = process.env;

const hasGroq       = !!GROQ_API_KEY;
const hasAzure      = !!(AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY);
const hasOpenRouter = !!OPENROUTER_API_KEY;
const hasOllama     = !!OLLAMA_BASE_URL;
const hasTelegram   = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_ALLOWED_USER_ID);

if (!hasGroq && !hasAzure && !hasOpenRouter && !hasOllama) {
  console.error("Error: configurar al menos un proveedor en .env:");
  console.error("  GROQ_API_KEY       (recomendado — groq.com, gratis)");
  console.error("  OPENROUTER_API_KEY (fallback)");
  console.error("  AZURE_OPENAI_*     (enterprise)");
  console.error("  OLLAMA_BASE_URL    (local — Raspberry Pi sin internet)");
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

// Groq — primario para el taller (gratis, ~500 tok/s, OpenAI-compatible)
if (hasGroq) {
  providers.groq = {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: GROQ_API_KEY,
    api: "openai-completions",
    models: [
      { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B (Groq)", contextWindow: 131072, maxTokens: 8000 },
      { id: "llama-3.1-8b-instant",    name: "Llama 3.1 8B Fast (Groq)", contextWindow: 131072, maxTokens: 8000 },
      { id: "mixtral-8x7b-32768",      name: "Mixtral 8x7B (Groq)", contextWindow: 32768,  maxTokens: 8000 },
    ],
  };
}

if (hasAzure) {
  providers.azure = {
    baseUrl: `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments`,
    apiKey: AZURE_OPENAI_API_KEY,
    api: "openai-completions",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Azure)", contextWindow: 128000, maxTokens: 16000 },
    ],
  };
}

if (hasOpenRouter) {
  providers.openrouter = {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
    api: "openai-completions",
    models: [
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (OpenRouter)", contextWindow: 128000, maxTokens: 16000 },
    ],
  };
}

// Ollama — IA local en Raspberry Pi, sin internet requerido
if (hasOllama) {
  providers.ollama = {
    baseUrl: OLLAMA_BASE_URL.replace(/\/$/, "") + "/v1",
    apiKey: "ollama",
    api: "openai-completions",
    models: [
      { id: "llama3.2:3b",  name: "Llama 3.2 3B (Local/Pi)", contextWindow: 8192, maxTokens: 2048 },
      { id: "llama3.2:1b",  name: "Llama 3.2 1B Fast (Local/Pi)", contextWindow: 8192, maxTokens: 2048 },
    ],
  };
}

// Prioridad: Groq > Azure > OpenRouter > Ollama
const primaryModel = hasGroq       ? "groq/llama-3.1-70b-versatile"
                   : hasAzure      ? "azure/gpt-4o-mini"
                   : hasOpenRouter ? "openrouter/openai/gpt-4o-mini"
                                   : "ollama/llama3.2:3b";

const fallbackModels = [
  ...(hasGroq && hasOpenRouter ? ["openrouter/openai/gpt-4o-mini"] : []),
  ...(hasGroq && hasAzure      ? ["azure/gpt-4o-mini"]             : []),
  ...(hasOllama ? ["ollama/llama3.2:3b"]                           : []),
].filter((m) => m !== primaryModel);

const modelAllowlist = {};
if (hasGroq)       modelAllowlist["groq/llama-3.1-70b-versatile"]  = { alias: "llama70b" };
if (hasGroq)       modelAllowlist["groq/llama-3.1-8b-instant"]     = { alias: "llama8b" };
if (hasAzure)      modelAllowlist["azure/gpt-4o-mini"]              = { alias: "azure-mini" };
if (hasOpenRouter) modelAllowlist["openrouter/openai/gpt-4o-mini"]  = { alias: "or-mini" };
if (hasOllama)     modelAllowlist["ollama/llama3.2:3b"]             = { alias: "ollama-local" };

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
      skills: ["expense-tracker", "second-brain", "pdf-extractor", "dev-assistant"],
    },
    list: [
      {
        // Agente principal — maneja cerebro, documentos y desarrollo
        id: "main",
        default: true,
        skills: ["second-brain", "pdf-extractor", "dev-assistant"],
      },
      {
        // Agente especializado en finanzas — modelo más rápido para respuestas cortas
        id: "finanzas",
        skills: ["expense-tracker"],
        model: {
          primary: hasGroq ? "groq/llama-3.1-8b-instant" : primaryModel,
        },
      },
    ],
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

const providerName = hasGroq ? "Groq" : hasAzure ? "Azure OpenAI" : hasOpenRouter ? "OpenRouter" : "Ollama (local)";
console.log(`✓ Config escrito en ${configPath}`);
console.log(`  Proveedor activo: ${providerName} → ${primaryModel}`);
if (hasOllama)   console.log("  Ollama: configurado (modo local)");
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
