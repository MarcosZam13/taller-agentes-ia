#!/usr/bin/env node
// install-case.mjs — Instala UN caso del taller sobre el chatbot base.
//
// El instalador global (setup/install.sh) deja un chatbot PELADO (agente sin skills).
// Este script agrega UN caso: copia su skill al workspace, la registra en el agente,
// inserta su fila de routing en AGENTS.md y deja que el gateway recargue.
//
// Uso: node setup/install-case.mjs <caso>
//   <caso> ∈ finanzas | second-brain | pdf-extractor | dev-assistant
//
// Es idempotente: correrlo dos veces no duplica nada. Asume que el instalador global
// ya corrió (debe existir ~/.openclaw/openclaw.json con el agente "main").

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");
const HOME = process.env.HOME || process.env.USERPROFILE || "";
const WORKSPACE = resolve(HOME, ".openclaw", "workspace");
const CONFIG_PATH = resolve(HOME, ".openclaw", "openclaw.json");

const C = { red: "\x1b[0;31m", green: "\x1b[0;32m", yellow: "\x1b[1;33m", nc: "\x1b[0m" };
const info = (m) => console.log(`${C.green}[+]${C.nc} ${m}`);
const warn = (m) => console.log(`${C.yellow}[!]${C.nc} ${m}`);
const fail = (m) => { console.error(`${C.red}[✗]${C.nc} ${m}`); process.exit(1); };

// ── Config "agéntica" compartida por todos los casos ────────────────────────
// El chatbot base viene SIN exec. El primer caso que se instale habilita exec y la
// deny list que fuerza el uso de los scripts de las skills (en vez de guardar en
// memoria, crear goals o delegar a subagentes). Es idempotente entre casos.
const EXEC_CONFIG = { security: "full", ask: "off" };
const BASE_DENY = [
  "write", "file_write", "apply_patch",
  "skill_workshop", "create_goal", "update_goal", "get_goal",
  "sessions_spawn", "sessions_yield", "subagents",
  // Memoria de embeddings de OpenClaw: DENEGADA. La "memoria" del agente son los
  // scripts deterministas (brain.js/expense.js). Sin esto, el agente podía caer al
  // índice de embeddings (vacío + roto) y mezclar fuentes o alucinar datos.
  "memory_search", "memory_get",
];

// ── Manifiesto de los 4 casos ───────────────────────────────────────────────
// caso = nombre de la carpeta en casos/. skill = nombre de la carpeta en skills/
// (difieren solo en finanzas → expense-tracker). routing = filas que el agente
// usa para saber qué ejecutar. requires = binarios que el caso necesita.
const CASES = {
  finanzas: {
    skill: "expense-tracker",
    label: "Rastreador de gastos 💰",
    requires: [],
    routing: [
      "| menciona que **gastó/compró/pagó** algo | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js add <monto> <categoria> \"<desc>\"` |",
      "| menciona que **le pagaron / recibió plata / un ingreso** (\"me pagaron\", \"me depositaron\", \"cobré\") | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js income <monto> \"<desc>\"` |",
      "| pregunta **cuánto puede gastar / cuánto le queda / balance / disponible** | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js balance` (o `balance YYYY-MM`) |",
      "| pide **ver el resumen del mes** (categorías + ingresos + disponible) | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js summary` (o `summary YYYY-MM`) |",
      "| pide el **desglose de gastos de un mes** (\"de qué son los gastos de julio\") | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js list --mes YYYY-MM` |",
      "| pregunta **cuánto gastó / últimos gastos / qué gastó tal día** | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js list 20` |",
      "| pregunta **cuándo compró algo por última vez / hace cuánto / cada cuánto lo compra** (\"cuándo compré creatina\", \"cuánto me duró\") | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js search <texto>` |",
    ],
  },
  "second-brain": {
    skill: "second-brain",
    label: "Segundo cerebro 🧠",
    requires: [],
    routing: [
      "| quiere **guardar una idea/nota** (\"anotá\", \"guardá idea\") | `node ~/.openclaw/workspace/skills/second-brain/brain.js new \"<titulo>\" --tags <a,b> --body \"<texto>\"` |",
      "| menciona una **cita/turno con fecha** (\"tengo cita el…\") | `node ~/.openclaw/workspace/skills/second-brain/brain.js new \"<titulo>\" --tags cita --due \"YYYY-MM-DD[ HH:MM]\" --body \"<detalle>\"` |",
      "| menciona un **pago/vencimiento con fecha** (\"pagar … el …\") | `node ~/.openclaw/workspace/skills/second-brain/brain.js new \"<titulo>\" --tags pago --due \"YYYY-MM-DD\" --body \"<detalle>\"` |",
      "| menciona un **pendiente/tarea SIN fecha fija** (\"tengo que…\", \"me falta…\", \"quiero comprar…\", \"anotá que debo…\") | `node ~/.openclaw/workspace/skills/second-brain/brain.js new \"<titulo>\" --tags pendiente --body \"<detalle>\"` |",
      "| pide un **recordatorio que le AVISE a una hora** (\"recordame…\", \"ponme un recordatorio…\", \"avisame a las…\") | `node ~/.openclaw/workspace/skills/second-brain/remind.js add \"<texto>\" --at \"YYYY-MM-DD HH:MM\"` — calculá la fecha/hora ABSOLUTA con `date` si es relativa; para dentro de un rato podés usar `--at \"+90m\"` / `--at \"+2h\"` |",
      "| pregunta **qué se viene / próximas citas / pagos / qué tengo que hacer** | `node ~/.openclaw/workspace/skills/second-brain/brain.js agenda` (con fecha) y `node ~/.openclaw/workspace/skills/second-brain/brain.js pendientes` (sin fecha) |",
      "| dice que **ya hizo/completó** algo anotado (\"ya compré…\", \"listo lo de…\", \"marcá como hecho…\") | `node ~/.openclaw/workspace/skills/second-brain/brain.js done \"<titulo>\"` |",
      "| pregunta por sus **recordatorios programados** o quiere **cancelar uno** | `node ~/.openclaw/workspace/skills/second-brain/remind.js list` (y `remind.js rm <id>` para cancelar) |",
      "| quiere **buscar en sus notas** | `node ~/.openclaw/workspace/skills/second-brain/brain.js search <texto>` |",
    ],
  },
  "pdf-extractor": {
    skill: "pdf-extractor",
    label: "Extractor de PDF 📄",
    // OpenClaw trae una tool nativa `pdf` (necesita modelo de visión) que el agente
    // elige en vez de pdf.js → se deniega para forzar la vía exec → pdf.js.
    extraDeny: ["pdf"],
    requires: [
      { bin: "pdftotext", hint: "instalar poppler (Arch: sudo pacman -S poppler / Debian: sudo apt install poppler-utils)" },
    ],
    routing: [
      "| **adjunta/indica un PDF** y pide resumen o datos | `node ~/.openclaw/workspace/skills/pdf-extractor/pdf.js text <ruta_pdf>` |",
    ],
  },
  "dev-assistant": {
    skill: "dev-assistant",
    label: "Asistente de desarrollo 🐍",
    requires: [
      { bin: "python3", hint: "instalar Python 3 (Arch: sudo pacman -S python / Debian: sudo apt install python3)" },
    ],
    routing: [
      "| pide **ejecutar/probar código Python** | `echo '<código>' \\| node ~/.openclaw/workspace/skills/dev-assistant/runpy.js snippet` |",
      "| hace una **pregunta de cálculo** (\"cuánto es…\", \"cuántos días faltan…\", \"convertí…\") | `printf '<código python>\\n' \\| node ~/.openclaw/workspace/skills/dev-assistant/runpy.js snippet` |",
    ],
  },
};

// ── Argumento ────────────────────────────────────────────────────────────────
const caso = (process.argv[2] || "").trim();
if (!caso || !CASES[caso]) {
  fail(`Caso inválido: "${caso}". Opciones: ${Object.keys(CASES).join(", ")}`);
}
const spec = CASES[caso];

// ── Preflight ──────────────────────────────────────────────────────────────
if (!existsSync(CONFIG_PATH)) {
  fail(`No existe ${CONFIG_PATH}. Primero corré el instalador global: bash setup/install.sh`);
}
let config;
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
} catch (e) {
  fail(`No se pudo parsear ${CONFIG_PATH}: ${e.message}`);
}
if (!config.agents?.defaults) {
  fail(`La config no tiene agents.defaults. ¿Corriste el instalador global? (bash setup/install.sh)`);
}

console.log(`\n=== Instalando caso: ${caso} (${spec.label}) ===\n`);

// ── 1. Verificar binarios requeridos ──────────────────────────────────────────
for (const req of spec.requires) {
  try {
    execSync(`command -v ${req.bin}`, { stdio: "ignore", shell: "/bin/bash" });
    info(`Dependencia OK: ${req.bin}`);
  } catch {
    warn(`Falta "${req.bin}" — el caso lo necesita. ${req.hint}`);
    warn(`Podés continuar e instalarlo después; el caso fallará hasta tenerlo.`);
  }
}

// ── 2. Copiar la skill al workspace (directorio completo: SKILL.md + motor .js) ─
const skillSrc = resolve(ROOT, "skills", spec.skill);
if (!existsSync(resolve(skillSrc, "SKILL.md"))) {
  fail(`No se encontró la skill en ${skillSrc}/SKILL.md`);
}
const skillDest = resolve(WORKSPACE, "skills", spec.skill);
mkdirSync(skillDest, { recursive: true });
cpSync(skillSrc, skillDest, { recursive: true });
info(`Skill "${spec.skill}" copiada a ${skillDest}`);

// ── 3. Registrar la skill en el agente (defaults + agente "main"), sin duplicar ─
const addSkill = (arr) => {
  const list = Array.isArray(arr) ? arr.slice() : [];
  if (!list.includes(spec.skill)) list.push(spec.skill);
  return list;
};
config.agents.defaults.skills = addSkill(config.agents.defaults.skills);
if (Array.isArray(config.agents.list)) {
  for (const a of config.agents.list) {
    if (a.id === "main" || a.default) a.skills = addSkill(a.skills);
  }
}

// ── 4. Habilitar exec + deny (base + extra del caso) ───────────────────────────
// El caso necesita exec para correr su motor .js. Se activa acá (el chatbot base no
// lo trae). La deny list empuja al agente a usar el script en vez de memoria/goals.
config.tools = config.tools || {};
config.tools.exec = EXEC_CONFIG;
const wantDeny = [...BASE_DENY, ...(spec.extraDeny || [])];
config.tools.deny = Array.isArray(config.tools.deny) ? config.tools.deny : [];
for (const d of wantDeny) {
  if (!config.tools.deny.includes(d)) config.tools.deny.push(d);
}
info(`exec habilitado; tools.deny con ${config.tools.deny.length} entradas`);

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
info(`Config actualizada (agente "main" ahora incluye "${spec.skill}")`);

// ── 5. Insertar las filas de routing en el AGENTS.md del workspace ─────────────
const wsAgents = resolve(WORKSPACE, "AGENTS.md");
if (!existsSync(wsAgents)) {
  // Si no está en el workspace, copiar la base del repo.
  cpSync(resolve(ROOT, "AGENTS.md"), wsAgents);
  info("AGENTS.md base copiado al workspace");
}
let agentsTxt = readFileSync(wsAgents, "utf8");
const START = "<!-- TALLER:CASOS:START -->";
const END = "<!-- TALLER:CASOS:END -->";
if (!agentsTxt.includes(START) || !agentsTxt.includes(END)) {
  warn("AGENTS.md del workspace no tiene los marcadores TALLER:CASOS — no se insertó routing.");
  warn("Reinstalá el AGENTS.md base (bash setup/install.sh) y volvé a correr este caso.");
} else {
  const head = agentsTxt.slice(0, agentsTxt.indexOf(START) + START.length);
  let body = agentsTxt.slice(agentsTxt.indexOf(START) + START.length, agentsTxt.indexOf(END));
  const tail = agentsTxt.slice(agentsTxt.indexOf(END));
  // Quitar el placeholder y quedarnos solo con filas de tabla ya presentes.
  const existingRows = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  for (const row of spec.routing) {
    if (!existingRows.includes(row.trim())) existingRows.push(row);
  }
  const newBody = "\n" + existingRows.join("\n") + "\n";
  agentsTxt = head + newBody + tail;
  writeFileSync(wsAgents, agentsTxt, "utf8");
  info(`Routing del caso agregado a ${wsAgents}`);
}

console.log(`\n${C.green}=== Caso "${caso}" instalado ===${C.nc}`);
console.log(`El gateway recarga solo (hybrid reload). Probalo en el chat/Telegram.`);
console.log(`Verificá con: openclaw config get agents.defaults.skills\n`);
