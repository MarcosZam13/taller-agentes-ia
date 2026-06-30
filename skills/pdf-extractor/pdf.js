#!/usr/bin/env node
// pdf.js — Motor del extractor de PDFs.
//
// Hace de forma determinista las dos partes "mecánicas" del trabajo:
//   1. extraer el texto del PDF (envuelve pdftotext, con errores claros), y
//   2. guardar el CSV final en una ruta estable, con escape correcto.
// La *interpretación* (qué es una tabla, qué campos importan) la hace el agente
// leyendo el texto; pero el agente NUNCA escribe el .csv a mano — lo pasa por
// este script para que el archivo quede siempre bien formado.
//
// Uso:
//   node pdf.js text <archivo.pdf>           # imprime el texto (pdftotext -layout)
//   node pdf.js info <archivo.pdf>            # metadatos (páginas, título)
//   node pdf.js save-csv <nombre>            # lee CSV de STDIN y lo guarda en exports/
//
// Ejemplo de guardado:  printf 'a,b\n1,2\n' | node pdf.js save-csv factura
// Los CSV se guardan en  <dir-del-script>/exports/YYYY-MM-DD_<nombre>.csv

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORTS = join(HERE, "exports");
const hoy = () => new Date().toISOString().slice(0, 10);

const INSTALL_HINT =
  'pdftotext no está instalado. Instalá poppler-utils:\n' +
  '  Linux/Pi: sudo apt install poppler-utils\n' +
  '  Mac:      brew install poppler\n' +
  '  Windows:  https://github.com/oschwartz10612/poppler-windows/releases';

function requirePdf(pdfPath) {
  if (!pdfPath) throw new Error("Falta la ruta del PDF.");
  const full = resolve(pdfPath);
  if (!existsSync(full)) throw new Error(`No existe el archivo: ${full}`);
  if (!full.toLowerCase().endsWith(".pdf")) {
    console.error(`AVISO: "${pdfPath}" no termina en .pdf — intento igual.`);
  }
  return full;
}

function runTool(bin, toolArgs) {
  try {
    return execFileSync(bin, toolArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (e.code === "ENOENT") throw new Error(INSTALL_HINT);
    // pdftotext devolvió output pero con código != 0 — devolvemos lo que haya.
    if (e.stdout) return e.stdout;
    throw new Error(`${bin} falló: ${e.message}`);
  }
}

function cmdText(args) {
  const pdf = requirePdf(args[0]);
  const text = runTool("pdftotext", ["-layout", pdf, "-"]);
  if (!text || !text.trim()) {
    throw new Error(
      "El PDF no tiene texto extraíble (vacío). Suele ser un PDF escaneado " +
      "(imágenes) o protegido. Para escaneados se necesita OCR (ej. tesseract)."
    );
  }
  process.stdout.write(text);
}

function cmdInfo(args) {
  const pdf = requirePdf(args[0]);
  // pdfinfo viene en el mismo paquete poppler-utils que pdftotext.
  const info = runTool("pdfinfo", [pdf]);
  process.stdout.write(info);
}

function cmdSaveCsv(args) {
  const nombre = (args[0] || "export").replace(/[^\w.-]+/g, "_");
  let csv = "";
  try {
    csv = readFileSync(0, "utf8"); // STDIN
  } catch {
    csv = "";
  }
  if (!csv.trim()) {
    throw new Error('No recibí contenido CSV por STDIN. Ej.: printf "a,b\\n1,2\\n" | node pdf.js save-csv ' + nombre);
  }
  mkdirSync(EXPORTS, { recursive: true });
  const out = join(EXPORTS, `${hoy()}_${nombre}.csv`);
  const normalized = csv.replace(/\r?\n/g, "\n").replace(/\n*$/, "\n");
  writeFileSync(out, normalized, "utf8");
  const filas = normalized.trim().split("\n").length;
  console.log(`OK CSV guardado (${filas} líneas incl. encabezado): ${out}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "text": cmdText(args); break;
    case "info": cmdInfo(args); break;
    case "save-csv": cmdSaveCsv(args); break;
    default:
      console.log("Comandos: text <pdf> | info <pdf> | save-csv <nombre> (CSV por STDIN)");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
