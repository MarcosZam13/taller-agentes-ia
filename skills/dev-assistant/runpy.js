#!/usr/bin/env node
// runpy.js — Runner determinista de Python para el dev-assistant.
//
// Por qué un runner y no ejecutar python a pelo: este script da SIEMPRE el mismo
// marco de salida (STDOUT / STDERR / exit code), aplica un timeout (un loop
// infinito no cuelga al agente) y maneja los archivos temporales por vos. Así el
// agente no inventa resultados ni se le escapa un proceso colgado.
//
// Uso:
//   node runpy.js run <archivo.py> [args...]   [--timeout <seg>]
//   node runpy.js snippet [--timeout <seg>]     # lee código Python de STDIN
//   node runpy.js test [ruta]    [--timeout <seg>]   # pytest si hay, si no unittest
//
// El binario de Python se toma de  PYTHON_BIN  (default: python3).

import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PY = process.env.PYTHON_BIN || "python3";

function getFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

// Ejecuta y enmarca la salida de forma uniforme. Devuelve el exit code.
function frame(bin, cmdArgs, timeoutSec, opts = {}) {
  const timeoutMs = Math.max(1, Number(timeoutSec) || 30) * 1000;
  const r = spawnSync(bin, cmdArgs, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    input: opts.input,
  });

  if (r.error && r.error.code === "ENOENT") {
    console.error(`ERROR: no se encontró "${bin}". ¿Está Python instalado y en el PATH?`);
    return 127;
  }
  if (r.error && r.error.code === "ETIMEDOUT") {
    if (r.stdout) process.stdout.write(r.stdout);
    console.error(`\n─── TIMEOUT ───\nEl proceso superó el límite de ${timeoutSec || 30}s y fue terminado.`);
    console.error("Posible loop infinito o espera de input. Revisá el código.");
    return 124;
  }

  const out = r.stdout || "";
  const err = r.stderr || "";
  if (out) { console.log("─── STDOUT ───"); process.stdout.write(out.endsWith("\n") ? out : out + "\n"); }
  if (err) { console.log("─── STDERR ───"); process.stderr.write(err.endsWith("\n") ? err : err + "\n"); }
  if (!out && !err) console.log("(sin salida)");
  console.log(`─── exit code: ${r.status} ───`);
  return r.status ?? 1;
}

function cmdRun(args) {
  const timeout = getFlag(args, "timeout");
  const [file, ...rest] = args;
  if (!file) throw new Error("Uso: run <archivo.py> [args...] [--timeout <seg>]");
  if (!existsSync(file)) throw new Error(`No existe el archivo: ${file}`);
  return frame(PY, [file, ...rest], timeout);
}

function cmdSnippet(args) {
  const timeout = getFlag(args, "timeout");
  let code = "";
  try {
    code = readFileSync(0, "utf8"); // STDIN (fd 0)
  } catch {
    code = "";
  }
  if (!code.trim()) throw new Error("No recibí código por STDIN. Ej.: echo 'print(1)' | node runpy.js snippet");
  const dir = mkdtempSync(join(tmpdir(), "devassist-"));
  const tmp = join(dir, "snippet.py");
  writeFileSync(tmp, code, "utf8");
  try {
    return frame(PY, [tmp], timeout);
  } finally {
    try { unlinkSync(tmp); } catch { /* noop */ }
  }
}

function hasPytest() {
  const r = spawnSync(PY, ["-m", "pytest", "--version"], { encoding: "utf8", timeout: 10000 });
  return !r.error && r.status === 0;
}

function cmdTest(args) {
  const timeout = getFlag(args, "timeout") || "120";
  const ruta = args[0] || ".";
  if (hasPytest()) {
    console.log(`(pytest detectado) corriendo: ${PY} -m pytest ${ruta} -v --tb=short`);
    return frame(PY, ["-m", "pytest", ruta, "-v", "--tb=short"], timeout);
  }
  console.log(`(pytest no disponible) corriendo: ${PY} -m unittest discover`);
  return frame(PY, ["-m", "unittest", "discover", "-s", ruta === "." ? "." : ruta], timeout);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  let code = 0;
  switch (cmd) {
    case "run": code = cmdRun(args); break;
    case "snippet": code = cmdSnippet(args); break;
    case "test": code = cmdTest(args); break;
    default:
      console.log("Comandos: run <archivo.py> | snippet (código por STDIN) | test [ruta]");
      process.exit(cmd ? 1 : 0);
  }
  process.exit(code);
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
