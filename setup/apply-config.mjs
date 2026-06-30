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
  OLLAMA_EMBED_MODEL = "nomic-embed-text",
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
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", contextWindow: 131072, maxTokens: 8000 },
      { id: "llama-3.1-8b-instant",    name: "Llama 3.1 8B Fast (Groq)", contextWindow: 131072, maxTokens: 8000 },
      { id: "openai/gpt-oss-20b",      name: "GPT-OSS 20B (Groq)", contextWindow: 131072, maxTokens: 8000 },
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
      // Primario del taller: mismo Llama 3.3 70B que la narrativa, servido por
      // OpenRouter (contexto 131k, sin el techo TPM del free tier de Groq).
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B (OpenRouter)", contextWindow: 131072, maxTokens: 8000 },
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

  // Provider dedicado para embeddings de memoria (api nativa "ollama", SIN /v1).
  // Separado del de chat para no mezclar el endpoint openai-completions con el
  // de embeddings. Habilita la búsqueda semántica de memoria (memorySearch).
  providers["ollama-embed"] = {
    baseUrl: OLLAMA_BASE_URL.replace(/\/$/, ""),
    api: "ollama",
    models: [{ id: OLLAMA_EMBED_MODEL, name: OLLAMA_EMBED_MODEL }],
  };
}

// Prioridad: OpenRouter > Azure > Groq > Ollama.
// Modelo primario = gpt-4o-mini (vía OpenRouter). IMPORTANTE: se eligió gpt-4o-mini
// y NO Llama 3.3 70B porque, probado end-to-end, Llama 3.3 70B vía OpenRouter NO
// hace tool-calling nativo confiable — emite las llamadas a herramientas como
// TEXTO (bloque ```json) en vez del formato real, lo que rompe las 4 skills
// agénticas (ejecutar scripts con exec). gpt-4o-mini hace tool-calls nativas y
// ejecuta los scripts correctamente. Llama 3.3 70B queda disponible en el
// allowlist (alias llama70b) para demostrar la diferencia en el taller.
const primaryModel = hasOpenRouter ? "openrouter/openai/gpt-4o-mini"
                   : hasAzure      ? "azure/gpt-4o-mini"
                   : hasGroq       ? "groq/llama-3.3-70b-versatile"
                                   : "ollama/llama3.2:3b";

// Groq como primario sólo si no hay OpenRouter ni Azure. En ese caso el contexto
// no entra en el free tier de Groq y se aplica el perfil "minimal" + cap de
// bootstrap (workaround degradado; las tareas que escriben archivos pueden fallar).
const groqIsPrimary = !hasOpenRouter && !hasAzure && hasGroq;

// Fallbacks: SOLO modelos con tool-calling nativo confiable (otro gpt-4o-mini).
// NO se usa Llama ni ollama-3b como fallback: emiten las tool calls como texto y
// rompen las skills. Mejor que el primario falle visible a que caiga a un modelo
// que "responde" pero no ejecuta nada.
const fallbackModels = [
  ...(hasOpenRouter && hasAzure ? ["azure/gpt-4o-mini"] : []),
].filter((m) => m !== primaryModel);

// Allowlist: SOLO modelos con tool-calling nativo. CLAVE: NO incluir
// openrouter/meta-llama/llama-3.3-70b-instruct ni ollama-3b. Si están en el
// allowlist, el auto-fallback/health-monitor de OpenClaw puede CAMBIAR la sesión
// a ellos cuando el primario tiene un hipo — y como emiten tool calls como texto,
// el agente deja de ejecutar las skills (se ve el JSON crudo en el chat). Groq
// 70B sí hace tool-calling nativo (Groq soporta functions), así que se permite
// sólo cuando Groq es el único proveedor.
const modelAllowlist = {};
if (hasOpenRouter) modelAllowlist["openrouter/openai/gpt-4o-mini"] = { alias: "gpt4omini" };
if (hasAzure)      modelAllowlist["azure/gpt-4o-mini"]             = { alias: "azure-mini" };
if (groqIsPrimary) modelAllowlist["groq/llama-3.3-70b-versatile"] = { alias: "groq70b" };
if (!hasOpenRouter && !hasAzure && !hasGroq && hasOllama) modelAllowlist["ollama/llama3.2:3b"] = { alias: "ollama-local" };

// ── Herramientas ──────────────────────────────────────────────────────────────
// El instalador GLOBAL deja un CHATBOT PELADO: exec DESHABILITADO y sin deny especial.
// Así el baseline no puede correr scripts ni "fingir" que ejecutó algo — el contraste
// con un agente con herramientas queda limpio. exec + la deny list (que fuerzan el uso
// de los scripts de las skills) los agrega cada caso en setup/install-case.mjs, no acá.
const toolsConfig = {};
// Recorte de contexto SOLO si Groq es el primario: OpenClaw inyecta ~29k tokens
// (system prompt + esquemas de TODAS las tools) y el free tier de Groq rechaza
// requests > 12k TPM. Con OpenRouter/Azure el contexto entra holgado.
if (groqIsPrimary) toolsConfig.profile = "minimal";

const additions = {
  models: { providers },
  tools: toolsConfig,
  gateway: {
    // El relay conecta desde http://127.0.0.1:18789 (mismo origen que el gateway).
    // No se necesita "null" — el vault dashboard NO conecta directamente al WS,
    // siempre pasa por el relay (demo/vault/relay.mjs).
    controlUi: {
      allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
    },
  },
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      // sandbox OFF: exec corre directo en el host (runtime "direct"). Sin esto, el
      // sandbox "bundled" está deshabilitado por defecto y exec falla con
      // "bundled (disabled by default)", así que las skills no pueden correr scripts.
      // Aceptable en el taller: agente restringido a un único usuario de Telegram.
      sandbox: { mode: "off" },
      // Cap de bootstrap (AGENTS.md, SOUL.md, etc.) sólo con Groq primario, para
      // dejar headroom bajo su techo de 12k. Con OpenRouter/Azure no hace falta.
      ...(groqIsPrimary ? { bootstrapTotalMaxChars: 1200 } : {}),
      model: {
        primary: primaryModel,
        ...(fallbackModels.length > 0 ? { fallbacks: fallbackModels } : {}),
      },
      models: modelAllowlist,
      // skills VACÍO a propósito: el instalador global deja un CHATBOT PELADO (sin
      // herramientas). Cada caso del taller se agrega después con su propio
      // instalador (casos/<caso>/install.sh → setup/install-case.mjs), que registra
      // SU skill en esta lista. Así en la exposición se ve la diferencia entre un
      // chatbot normal y uno con herramientas. OJO: deepMerge REEMPLAZA arrays, así
      // que re-ejecutar este script "resetea" el agente a chatbot pelado (borra los
      // casos instalados) — es el comportamiento buscado.
      skills: [],
      // Memoria semántica: solo si hay Ollama (embeddings locales). Sin esto, la
      // búsqueda de memoria queda en modo palabras clave (FTS), que es el default.
      ...(hasOllama
        ? {
            memorySearch: {
              provider: "ollama-embed",
              model: OLLAMA_EMBED_MODEL,
              query: { hybrid: { enabled: true, vectorWeight: 0.7, textWeight: 0.3 } },
            },
          }
        : {}),
    },
    list: [
      {
        // Un solo agente "main". Arranca SIN skills (chatbot pelado); cada caso del
        // taller suma su skill vía casos/<caso>/install.sh. Las skills se cargan
        // on-demand, así que tener varias instaladas no infla el prompt.
        id: "main",
        default: true,
        skills: [],
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

// deepMerge fusiona objetos (no borra claves viejas). El allowlist de modelos DEBE
// sobrescribirse por completo: si quedara una clave vieja como
// openrouter/meta-llama/llama-3.3-70b-instruct, el auto-fallback de OpenClaw podría
// cambiar a ese modelo (que rompe las skills). Forzamos el valor exacto.
if (merged.agents?.defaults) {
  merged.agents.defaults.models = modelAllowlist;
  merged.agents.defaults.model = {
    primary: primaryModel,
    ...(fallbackModels.length > 0 ? { fallbacks: fallbackModels } : {}),
  };
}

// tools: forzar el valor base (chatbot pelado). deepMerge NO borra claves, así que si
// un caso dejó tools.exec/tools.deny, hay que sobrescribir para volver al chatbot sin
// herramientas. Re-ejecutar el instalador global "resetea" el agente a baseline.
merged.tools = toolsConfig;

writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

const providerName = hasOpenRouter ? "OpenRouter" : hasAzure ? "Azure OpenAI" : hasGroq ? "Groq" : "Ollama (local)";
console.log(`✓ Config escrito en ${configPath}`);
console.log(`  Proveedor activo: ${providerName} → ${primaryModel}`);
if (hasOllama)   console.log("  Ollama: configurado (modo local)");
if (hasOllama)   console.log(`  Memoria semántica: embeddings con ollama-embed/${OLLAMA_EMBED_MODEL}`);
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
