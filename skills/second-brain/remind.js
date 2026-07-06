#!/usr/bin/env node
// remind.js — Motor de recordatorios ad-hoc que EMPUJAN por Telegram a una hora.
//
// A diferencia de una nota con fecha (`brain.js new --due`, que solo aparece si
// preguntás "qué se viene"), un recordatorio te BUSCA: a la hora exacta te llega
// un mensaje al chat. Lo hace de forma determinista con el cron nativo de OpenClaw
// usando un payload de tipo `--command` (un `printf` del texto). Así el mensaje que
// llega es EXACTAMENTE el texto del recordatorio — nunca lo redacta el LLM, así que
// es imposible que llegue "vacío" o con un divague de estado del sistema.
//
// Por qué existe: si el agente improvisa `openclaw cron add` como job de agente sin
// --message, al dispararse OpenClaw le inyecta su prompt por defecto
// "[OpenClaw heartbeat poll]" y el modelo responde con un status genérico → esa era
// la "notificación vacía". Este script cierra ese hueco.
//
// Uso:
//   node remind.js add "<texto>" --at "<cuándo>" [--to <chatId>] [--tz <IANA>]
//        <cuándo> = datetime local "YYYY-MM-DD HH:MM" (se combina con --tz),
//                   o una duración relativa "+45m" / "+2h" / "+1d".
//   node remind.js list                 # recordatorios pendientes
//   node remind.js rm <id>              # cancela un recordatorio
//
// El chatId destino y la zona horaria se resuelven solos desde la config de
// OpenClaw (~/.openclaw/openclaw.json → channels.telegram.allowFrom). Podés
// sobreescribirlos con --to / --tz o con las envs TELEGRAM_ALLOWED_USER_ID / BRIEF_TZ.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TZ_DEFAULT = "America/Costa_Rica";

function getFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

// Encuentra el binario `openclaw`. Preferimos el del PATH; si no está (p.ej. el
// exec del agente heredó un PATH mínimo), probamos las rutas típicas del install.
function openclawBin() {
  const candidates = [
    "openclaw",
    join(homedir(), ".npm-global", "bin", "openclaw"),
    join(homedir(), ".local", "bin", "openclaw"),
    "/usr/local/bin/openclaw",
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch { /* siguiente candidato */ }
  }
  // Último recurso: que PATH lo resuelva y falle con un error claro si no está.
  return "openclaw";
}

// chatId destino: --to > env > config de OpenClaw (primer allowFrom de telegram).
function resolveChatId(explicit) {
  if (explicit) return String(explicit).replace(/^tg:/, "").replace(/^telegram:/, "");
  if (process.env.TELEGRAM_ALLOWED_USER_ID) {
    return String(process.env.TELEGRAM_ALLOWED_USER_ID).replace(/^tg:/, "").replace(/^telegram:/, "");
  }
  const cfg = join(homedir(), ".openclaw", "openclaw.json");
  if (existsSync(cfg)) {
    try {
      const d = JSON.parse(readFileSync(cfg, "utf8"));
      const allow = d?.channels?.telegram?.allowFrom;
      if (Array.isArray(allow) && allow.length) {
        return String(allow[0]).replace(/^tg:/, "").replace(/^telegram:/, "");
      }
    } catch { /* config ilegible: caemos al error de abajo */ }
  }
  return null;
}

function cmdAdd(args) {
  const at = getFlag(args, "at");
  const to = getFlag(args, "to");
  const tz = getFlag(args, "tz") || process.env.BRIEF_TZ || TZ_DEFAULT;
  const texto = args.join(" ").trim();

  if (!texto) throw new Error('Falta el texto. Uso: add "<texto>" --at "<cuándo>"');
  if (!at) throw new Error('Falta --at. Ej: --at "2026-07-07 05:00"  o  --at "+2h"');

  const chatId = resolveChatId(to);
  if (!chatId) {
    throw new Error(
      "No pude resolver el chat de Telegram destino. Pasá --to <chatId>, o configurá " +
      "TELEGRAM_ALLOWED_USER_ID, o dejá el allowFrom de telegram en openclaw.json."
    );
  }

  // El mensaje que llega, literal. El cron corre  sh -lc '<command>'  así que el
  // texto va dentro de comillas simples con escape POSIX (' -> '\'') para que
  // cualquier carácter (comillas, $, backticks, %) viaje intacto y sin inyección.
  const mensaje = `⏰ Recordatorio: ${texto}`;
  const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const command = `printf '%s' ${shq(mensaje)}`;

  const nombre = `Recordatorio: ${texto.length > 48 ? texto.slice(0, 47) + "…" : texto}`;

  const cronArgs = [
    "cron", "add",
    "--name", nombre,
    "--agent", "main",
    "--at", at,
    "--tz", tz,
    "--command", command,
    "--announce",
    "--channel", "telegram",
    "--to", chatId,
    "--delete-after-run",
    "--best-effort-deliver",
    "--json",
  ];

  let out;
  try {
    out = execFileSync(openclawBin(), cronArgs, { encoding: "utf8" });
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
    throw new Error(`no se pudo programar el recordatorio.\n${detail}`);
  }

  let id = "", when = at;
  try {
    const j = JSON.parse(out.slice(out.indexOf("{")));
    id = j.id || "";
    if (j.schedule?.at) when = j.schedule.at;
  } catch { /* si no es JSON parseable, igual salió bien */ }

  console.log(`OK Recordatorio programado: "${texto}"`);
  console.log(`   Cuándo: ${when} (${tz})   →   Telegram ${chatId}`);
  if (id) console.log(`   ID: ${id}  (cancelalo con: remind.js rm ${id})`);
}

function cmdList() {
  let out;
  try {
    out = execFileSync(openclawBin(), ["cron", "list", "--json"], { encoding: "utf8" });
  } catch (e) {
    throw new Error((e.stderr || e.message || "").toString().trim());
  }
  let jobs = [];
  try {
    // La salida puede traer un warning antes del JSON. Cortamos desde el primer
    // "{" o "[" (lo que aparezca primero) para quedarnos solo con el JSON.
    const iObj = out.indexOf("{"), iArr = out.indexOf("[");
    const start = [iObj, iArr].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    const a = JSON.parse(out.slice(start));
    jobs = Array.isArray(a) ? a : (a.jobs || a.items || []);
  } catch { jobs = []; }

  const recs = jobs.filter((j) => j && typeof j.name === "string" && j.name.startsWith("Recordatorio:"));
  if (recs.length === 0) { console.log("No tenés recordatorios pendientes."); return; }

  console.log(`Recordatorios pendientes — ${recs.length}:`);
  for (const j of recs) {
    const next = j.state?.nextRunAtMs || j.schedule?.at;
    const cuando = typeof next === "number" ? new Date(next).toISOString() : (next || "?");
    console.log(`${cuando}  ${j.name.replace(/^Recordatorio:\s*/, "")}   [id: ${j.id}]`);
  }
}

function cmdRm(args) {
  const id = (args[0] || "").trim();
  if (!id) throw new Error("Uso: rm <id>  (mirá los ids con: remind.js list)");
  try {
    execFileSync(openclawBin(), ["cron", "rm", id], { stdio: "ignore" });
  } catch (e) {
    throw new Error(`no pude cancelar ${id}. ${(e.stderr || e.message || "").toString().trim()}`);
  }
  console.log(`OK Recordatorio ${id} cancelado.`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "add": cmdAdd(args); break;
    case "list": cmdList(); break;
    case "rm": cmdRm(args); break;
    default:
      console.log("Comandos: add | list | rm");
      console.log('  add "<texto>" --at "YYYY-MM-DD HH:MM" | --at "+2h"');
      console.log("  list");
      console.log("  rm <id>");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
