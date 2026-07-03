#!/usr/bin/env node
// expense.js — Motor de persistencia del rastreador de gastos (₡ CRC).
//
// El agente NO edita el JSON a mano: traduce tu lenguaje natural a un comando
// y este script hace el trabajo de forma determinista. Así funciona igual con
// cualquier modelo (chico o grande).
//
// Uso:
//   node expense.js add <monto> <categoria> <descripcion...> [--fecha YYYY-MM-DD]
//   node expense.js income <monto> <descripcion...> [--fecha YYYY-MM-DD]   # registra un INGRESO
//   node expense.js balance [YYYY-MM]            # ingresos − gastos del mes = disponible
//   node expense.js summary [YYYY-MM]            # resumen por categoría (default: mes actual)
//   node expense.js list [n] [--mes YYYY-MM]     # últimos n gastos; --mes filtra por mes
//   node expense.js search <texto...>            # busca por descripción/categoría: última compra, hace cuánto y cada cuánto
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
  if (!existsSync(DB)) return { gastos: [], ingresos: [], presupuestos: {} };
  try {
    const d = JSON.parse(readFileSync(DB, "utf8"));
    return { gastos: d.gastos ?? [], ingresos: d.ingresos ?? [], presupuestos: d.presupuestos ?? {} };
  } catch {
    return { gastos: [], ingresos: [], presupuestos: {} };
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
// Días entre dos fechas YYYY-MM-DD (usa UTC para las DOS: al restar se cancela y no
// hay corrimiento por zona horaria). Positivo si b es posterior a a.
const diasEntre = (aStr, bStr) => {
  const [ay, am, ad] = aStr.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = bStr.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};
// "hace 3 días" / "hoy" / "ayer" a partir de una fecha pasada.
const haceTexto = (fecha) => {
  const d = diasEntre(fecha, hoy());
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer (hace 1 día)";
  return `hace ${d} días`;
};

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

function cmdIncome(args) {
  const fecha = getFlag(args, "fecha") || hoy();
  const [monto, ...desc] = args;
  if (monto == null) throw new Error("Uso: income <monto> <descripcion...> [--fecha YYYY-MM-DD]");
  const db = load();
  const ingreso = {
    id: String(Date.now()),
    fecha,
    monto: parseMonto(monto),
    moneda: "CRC",
    descripcion: desc.join(" ").trim() || "(sin descripción)",
  };
  db.ingresos.push(ingreso);
  save(db);
  console.log(`OK Ingreso registrado: ${fmt(ingreso.monto)} — ${ingreso.descripcion} (${ingreso.fecha})`);
}

// balance del mes = ingresos − gastos = lo que queda disponible para gastar.
function cmdBalance(args) {
  const mes = args[0] || mesDe(hoy());
  const db = load();
  const ingresos = db.ingresos.filter((i) => mesDe(i.fecha) === mes).reduce((s, i) => s + i.monto, 0);
  const gastos = db.gastos.filter((g) => mesDe(g.fecha) === mes).reduce((s, g) => s + g.monto, 0);
  const disponible = ingresos - gastos;
  console.log(`Balance ${mes}`);
  console.log("─".repeat(40));
  console.log(`${"Ingresos".padEnd(16)} ${fmt(ingresos).padStart(12)}`);
  console.log(`${"Gastos".padEnd(16)} ${("-" + fmt(gastos)).padStart(12)}`);
  console.log("─".repeat(40));
  const etiqueta = disponible >= 0 ? "Disponible" : "Sobregiro";
  console.log(`${etiqueta.padEnd(16)} ${fmt(disponible).padStart(12)}`);
  if (ingresos === 0) console.log("(no hay ingresos registrados este mes — registralos con: income <monto> <desc>)");
}

function cmdSummary(args) {
  const mes = args[0] || mesDe(hoy());
  const db = load();
  const delMes = db.gastos.filter((g) => mesDe(g.fecha) === mes);
  const ingresosMes = db.ingresos.filter((i) => mesDe(i.fecha) === mes).reduce((s, i) => s + i.monto, 0);
  if (delMes.length === 0 && ingresosMes === 0) { console.log(`Sin movimientos registrados en ${mes}.`); return; }
  const porCat = {};
  let total = 0;
  for (const g of delMes) { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto; total += g.monto; }
  const filas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  console.log(`Resumen ${mes}  (${delMes.length} gastos)`);
  console.log("─".repeat(40));
  for (const [cat, monto] of filas) {
    const pct = total ? ((monto / total) * 100).toFixed(0) : "0";
    console.log(`${cat.padEnd(16)} ${fmt(monto).padStart(12)}   ${pct}%`);
  }
  console.log("─".repeat(40));
  console.log(`${"TOTAL GASTOS".padEnd(16)} ${fmt(total).padStart(12)}`);
  // Si hay ingresos en el mes, mostrar también ingresos y disponible (ingresos − gastos).
  if (ingresosMes > 0) {
    console.log(`${"INGRESOS".padEnd(16)} ${fmt(ingresosMes).padStart(12)}`);
    const disp = ingresosMes - total;
    console.log(`${(disp >= 0 ? "DISPONIBLE" : "SOBREGIRO").padEnd(16)} ${fmt(disp).padStart(12)}`);
  }
}

function cmdList(args) {
  const mes = getFlag(args, "mes"); // --mes YYYY-MM filtra por mes; si no, todos
  const n = Number(args[0]) || (mes ? 100 : 10);
  const db = load();
  let gastos = db.gastos;
  if (mes) gastos = gastos.filter((g) => mesDe(g.fecha) === mes);
  const ult = gastos.slice(-n).reverse();
  if (ult.length === 0) {
    console.log(mes ? `Sin gastos registrados en ${mes}.` : "Sin gastos registrados todavía.");
    return;
  }
  if (mes) console.log(`Gastos de ${mes}  (${ult.length}):`);
  let total = 0;
  for (const g of ult) {
    total += g.monto;
    console.log(`${g.fecha}  ${fmt(g.monto).padStart(12)}  ${g.categoria.padEnd(14)} ${g.descripcion}`);
  }
  if (mes) console.log(`${"".padEnd(12)}${fmt(total).padStart(12)}  (total ${mes})`);
}

// search <texto> — encuentra gastos cuya descripción o categoría contenga el texto,
// del más reciente al más viejo. Responde "¿cuándo compré X por última vez?" y
// "¿cada cuánto lo compro?" (intervalo entre las dos últimas compras).
function cmdSearch(args) {
  const query = args.join(" ").trim().toLowerCase();
  if (!query) throw new Error("Uso: search <texto...>");
  const db = load();
  const matches = db.gastos
    .filter((g) =>
      (g.descripcion || "").toLowerCase().includes(query) ||
      (g.categoria || "").toLowerCase().includes(query))
    .sort((a, b) => b.fecha.localeCompare(a.fecha)); // más reciente primero
  if (matches.length === 0) {
    console.log(`Sin gastos que coincidan con "${query}". (Solo se conoce lo que se registró.)`);
    return;
  }
  const ult = matches[0];
  console.log(`Última compra que coincide con "${query}": ${ult.fecha} — ${fmt(ult.monto)} — ${ult.descripcion} (${haceTexto(ult.fecha)})`);
  if (matches.length >= 2) {
    const prev = matches[1];
    const duro = diasEntre(prev.fecha, ult.fecha);
    console.log(`Compra anterior: ${prev.fecha} — ${fmt(prev.monto)} — ${prev.descripcion} (pasaron ${duro} día${duro === 1 ? "" : "s"} entre esas dos)`);
  }
  console.log("─".repeat(40));
  console.log(`${matches.length} compra(s) que coinciden:`);
  let total = 0;
  for (const g of matches) {
    total += g.monto;
    console.log(`${g.fecha}  ${fmt(g.monto).padStart(12)}  ${g.categoria.padEnd(14)} ${g.descripcion}`);
  }
  console.log(`${"".padEnd(12)}${fmt(total).padStart(12)}  (total ${matches.length} compra${matches.length === 1 ? "" : "s"})`);
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
    case "income": case "ingreso": cmdIncome(args); break;
    case "balance": cmdBalance(args); break;
    case "summary": cmdSummary(args); break;
    case "list": cmdList(args); break;
    case "search": case "buscar": cmdSearch(args); break;
    case "budget-set": cmdBudgetSet(args); break;
    case "budget-status": cmdBudgetStatus(args); break;
    case "export": cmdExport(args); break;
    default:
      console.log("Comandos: add | income | balance | summary | list | search | budget-set | budget-status | export");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
