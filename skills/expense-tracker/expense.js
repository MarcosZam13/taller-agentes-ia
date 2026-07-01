#!/usr/bin/env node
// expense.js — Motor de persistencia del rastreador de gastos (₡ CRC).
//
// El agente NO edita el JSON a mano: traduce tu lenguaje natural a un comando
// y este script hace el trabajo de forma determinista. Así funciona igual con
// cualquier modelo (chico o grande).
//
// Uso:
//   node expense.js add <monto> <categoria> <descripcion...> [--fecha YYYY-MM-DD]
//   node expense.js summary [YYYY-MM]            # resumen por categoría (default: mes actual)
//   node expense.js list [n]                     # últimos n gastos (default 10)
//   node expense.js budget-set <categoria> <monto>
//   node expense.js budget-status [categoria]
//   node expense.js export [YYYY-MM]             # genera CSV, imprime la ruta
//
// Los datos viven en  <dir-del-script>/data/gastos.json  (ruta estable).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const DB = join(DATA_DIR, "gastos.json");

const CATEGORIAS = [
  "comida", "transporte", "servicios", "salud",
  "entretenimiento", "educacion", "ropa", "hogar", "otro",
];

function load() {
  if (!existsSync(DB)) return { gastos: [], presupuestos: {} };
  try {
    const d = JSON.parse(readFileSync(DB, "utf8"));
    return { gastos: d.gastos ?? [], presupuestos: d.presupuestos ?? {} };
  } catch {
    return { gastos: [], presupuestos: {} };
  }
}

function save(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB, JSON.stringify(db, null, 2) + "\n", "utf8");
}

// ₡ 1.234.567 con separadores de miles
const fmt = (n) => "₡" + Math.round(n).toLocaleString("es-CR");
// Fecha local YYYY-MM-DD (NO UTC: toISOString daría el día equivocado de noche
// en zonas detrás de UTC, ej. Costa Rica UTC-6).
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mesDe = (fecha) => fecha.slice(0, 7);

function parseMonto(s) {
  // "8.500", "8,500", "₡8500", "12.400" -> número
  const limpio = String(s).replace(/[₡$\s]/g, "").replace(/[.,](?=\d{3}\b)/g, "");
  const n = Number(limpio.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Monto inválido: "${s}"`);
  return n;
}

function normCategoria(c) {
  const x = String(c || "").toLowerCase().trim();
  if (CATEGORIAS.includes(x)) return x;
  return "otro";
}

function getFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function cmdAdd(args) {
  const fecha = getFlag(args, "fecha") || hoy();
  const [monto, categoria, ...desc] = args;
  if (monto == null || categoria == null) {
    throw new Error("Uso: add <monto> <categoria> <descripcion...> [--fecha YYYY-MM-DD]");
  }
  const db = load();
  const gasto = {
    id: String(Date.now()),
    fecha,
    monto: parseMonto(monto),
    moneda: "CRC",
    categoria: normCategoria(categoria),
    descripcion: desc.join(" ").trim() || "(sin descripción)",
  };
  db.gastos.push(gasto);
  save(db);
  console.log(`OK Registrado: ${fmt(gasto.monto)} — ${gasto.categoria} — ${gasto.descripcion} (${gasto.fecha})`);
}

function cmdSummary(args) {
  const mes = args[0] || mesDe(hoy());
  const db = load();
  const delMes = db.gastos.filter((g) => mesDe(g.fecha) === mes);
  if (delMes.length === 0) { console.log(`Sin gastos registrados en ${mes}.`); return; }
  const porCat = {};
  let total = 0;
  for (const g of delMes) { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto; total += g.monto; }
  const filas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  console.log(`Resumen ${mes}  (${delMes.length} gastos)`);
  console.log("─".repeat(40));
  for (const [cat, monto] of filas) {
    const pct = ((monto / total) * 100).toFixed(0);
    console.log(`${cat.padEnd(16)} ${fmt(monto).padStart(12)}   ${pct}%`);
  }
  console.log("─".repeat(40));
  console.log(`${"TOTAL".padEnd(16)} ${fmt(total).padStart(12)}`);
}

function cmdList(args) {
  const n = Number(args[0]) || 10;
  const db = load();
  const ult = db.gastos.slice(-n).reverse();
  if (ult.length === 0) { console.log("Sin gastos registrados todavía."); return; }
  for (const g of ult) console.log(`${g.fecha}  ${fmt(g.monto).padStart(12)}  ${g.categoria.padEnd(14)} ${g.descripcion}`);
}

function cmdBudgetSet(args) {
  const [categoria, monto] = args;
  if (categoria == null || monto == null) throw new Error("Uso: budget-set <categoria> <monto>");
  const db = load();
  const cat = normCategoria(categoria);
  db.presupuestos[cat] = parseMonto(monto);
  save(db);
  console.log(`OK Presupuesto de ${cat}: ${fmt(db.presupuestos[cat])} / mes`);
}

function cmdBudgetStatus(args) {
  const db = load();
  const mes = mesDe(hoy());
  const cats = args[0] ? [normCategoria(args[0])] : Object.keys(db.presupuestos);
  if (cats.length === 0) { console.log("No hay presupuestos configurados. Usá: budget-set <categoria> <monto>"); return; }
  for (const cat of cats) {
    const limite = db.presupuestos[cat];
    if (!limite) { console.log(`${cat}: sin presupuesto configurado`); continue; }
    const gastado = db.gastos
      .filter((g) => g.categoria === cat && mesDe(g.fecha) === mes)
      .reduce((s, g) => s + g.monto, 0);
    const pct = (gastado / limite) * 100;
    const llenas = Math.min(10, Math.round(pct / 10));
    const barra = "█".repeat(llenas) + "░".repeat(10 - llenas);
    const queda = limite - gastado;
    console.log(`${cat}: ${fmt(gastado)} / ${fmt(limite)} ${barra} ${pct.toFixed(0)}% — ${queda >= 0 ? "quedan " + fmt(queda) : "excedido " + fmt(-queda)}`);
  }
}

function cmdExport(args) {
  const mes = args[0] || null;
  const db = load();
  const datos = mes ? db.gastos.filter((g) => mesDe(g.fecha) === mes) : db.gastos;
  const out = join(DATA_DIR, `gastos${mes ? "-" + mes : ""}.csv`);
  const head = "fecha,monto,moneda,categoria,descripcion";
  const rows = datos.map((g) => `${g.fecha},${g.monto},${g.moneda},${g.categoria},"${(g.descripcion || "").replace(/"/g, '""')}"`);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(out, [head, ...rows].join("\n") + "\n", "utf8");
  console.log(`OK CSV exportado (${datos.length} filas): ${out}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "add": cmdAdd(args); break;
    case "summary": cmdSummary(args); break;
    case "list": cmdList(args); break;
    case "budget-set": cmdBudgetSet(args); break;
    case "budget-status": cmdBudgetStatus(args); break;
    case "export": cmdExport(args); break;
    default:
      console.log("Comandos: add | summary | list | budget-set | budget-status | export");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
