#!/usr/bin/env node
// brain.js — Motor del "segundo cerebro" sobre un vault Markdown (estilo Obsidian).
//
// El agente NO edita los .md a mano: traduce tu lenguaje natural a un comando y
// este script hace el trabajo de forma determinista (frontmatter consistente,
// nombres de archivo limpios, links [[wiki]], búsqueda). Así funciona igual con
// cualquier modelo (chico o grande) y nunca corrompe una nota.
//
// Uso:
//   node brain.js new "<titulo>" [--tags a,b] [--body "<texto>"] [--due "YYYY-MM-DD[ HH:MM]"] [--daily] [--force]
//   node brain.js append "<titulo|archivo>" "<texto>"
//   node brain.js search <texto...>            # busca en título y contenido
//   node brain.js list [n]                      # últimas n notas (default 10)
//   node brain.js agenda [tag]                  # citas/pagos/pendientes futuros (por fecha --due)
//   node brain.js pendientes                    # pendientes SIN fecha (todo/tarea/pendiente, no hechos)
//   node brain.js done "<titulo|archivo>"       # marca una nota como hecha (sale de agenda/pendientes)
//   node brain.js due "<titulo|archivo>" "<YYYY-MM-DD[ HH:MM]>"  # pone/cambia la fecha (reprograma)
//   node brain.js read "<titulo|archivo>"
//   node brain.js link "<nota>" "<nota-destino>"   # agrega [[destino]] en Conexiones
//   node brain.js tags                          # lista tags con conteo
//
// El vault por defecto es  <dir-del-script>/data/vault  (self-contained, listo
// para el taller). Para usar un vault real de Obsidian, exportá OBSIDIAN_VAULT
// con la ruta, o pasá  --vault <ruta>  en cualquier comando.

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function getFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}
function getBool(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

// El --vault se resuelve antes que nada para que aplique a todos los comandos.
const rawArgs = process.argv.slice(2);
const VAULT = getFlag(rawArgs, "vault")
  || process.env.OBSIDIAN_VAULT
  || join(HERE, "data", "vault");

// Fecha local YYYY-MM-DD (NO UTC: toISOString daría el día equivocado de noche
// en zonas detrás de UTC, ej. Costa Rica UTC-6).
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function ensureVault() {
  mkdirSync(VAULT, { recursive: true });
}

// "Mi Idea: notas!" -> "Mi Idea notas"  (nombre de archivo limpio, sin extensión)
function slugTitle(t) {
  return String(t).trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function listNotes() {
  ensureVault();
  return readdirSync(VAULT)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => ({ file: f, path: join(VAULT, f), mtime: statSync(join(VAULT, f)).mtimeMs }));
}

// Normaliza para comparar: mismo slug que en el nombre de archivo, en minúscula.
// Así "Idea: app de recetas" matchea el archivo "Idea app de recetas.md" aunque
// la puntuación se haya removido al guardar.
const normRef = (x) => slugTitle(String(x).replace(/\.md$/i, "")).toLowerCase();

// Resuelve "titulo" o "archivo.md" a una nota existente (match exacto o por inclusión).
function resolveNote(ref) {
  const notes = listNotes();
  const want = normRef(ref);
  let hit = notes.find((n) => normRef(n.file) === want);
  if (!hit) hit = notes.find((n) => normRef(n.file).includes(want));
  return hit || null;
}

function cmdNew(args) {
  const tags = getFlag(args, "tags");
  const body = getFlag(args, "body");
  const due = getFlag(args, "due");
  const daily = getBool(args, "daily");
  const force = getBool(args, "force");
  const titulo = args.join(" ").trim();
  if (!titulo) throw new Error('Uso: new "<titulo>" [--tags a,b] [--body "<texto>"] [--due "YYYY-MM-DD[ HH:MM]"] [--daily]');

  const slug = slugTitle(titulo);
  const fileName = (daily ? `${hoy()} ${slug}` : slug) + ".md";
  const fullPath = join(VAULT, fileName);
  if (existsSync(fullPath) && !force) {
    throw new Error(`Ya existe "${fileName}". Usá append para agregarle, o --force para reemplazar.`);
  }

  const tagList = (tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const fm = [
    "---",
    `fecha: ${hoy()}`,
    `tags: [${tagList.join(", ")}]`,
    // "vence" = fecha del evento (cita/pago/pendiente). Es lo que lee `agenda` para
    // ordenar y filtrar lo próximo. Se guarda tal cual la pasó el agente (--due).
    ...(due ? [`vence: ${String(due).trim()}`] : []),
    "---",
    "",
    `# ${titulo}`,
    "",
    (body || "").trim(),
    "",
    "## Conexiones",
    "",
  ].join("\n");

  ensureVault();
  writeFileSync(fullPath, fm.replace(/\n{3,}/g, "\n\n"), "utf8");
  console.log(`OK Nota creada: ${fileName}`);
  console.log(`   Ruta: ${fullPath}`);
}

function cmdAppend(args) {
  const [ref, ...rest] = args;
  const texto = rest.join(" ").trim();
  if (!ref || !texto) throw new Error('Uso: append "<titulo|archivo>" "<texto>"');
  const note = resolveNote(ref);
  if (!note) throw new Error(`No encontré ninguna nota que coincida con "${ref}".`);
  const prev = readFileSync(note.path, "utf8").replace(/\s+$/, "");
  writeFileSync(note.path, `${prev}\n\n${texto}\n`, "utf8");
  console.log(`OK Agregado a ${note.file}`);
}

function cmdSearch(args) {
  const query = args.join(" ").trim().toLowerCase();
  if (!query) throw new Error("Uso: search <texto...>");
  const notes = listNotes();
  let encontradas = 0;
  for (const n of notes) {
    const content = readFileSync(n.path, "utf8");
    const tituloMatch = n.file.toLowerCase().includes(query);
    const lines = content.split("\n");
    const hits = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.toLowerCase().includes(query));
    if (!tituloMatch && hits.length === 0) continue;
    encontradas++;
    console.log(`\n[[${n.file.replace(/\.md$/, "")}]]`);
    for (const { l, i } of hits.slice(0, 3)) {
      console.log(`  L${i + 1}: ${l.trim().slice(0, 100)}`);
    }
    if (tituloMatch && hits.length === 0) console.log("  (coincide el título)");
  }
  if (encontradas === 0) console.log(`Sin resultados para "${query}".`);
  else console.log(`\n${encontradas} nota(s) coinciden.`);
}

function cmdList(args) {
  const n = Number(args[0]) || 10;
  const notes = listNotes().sort((a, b) => b.mtime - a.mtime).slice(0, n);
  if (notes.length === 0) { console.log("El vault está vacío. Creá una nota con: new \"<titulo>\""); return; }
  for (const note of notes) {
    const m = new Date(note.mtime);
    const fecha = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
    console.log(`${fecha}  ${note.file.replace(/\.md$/, "")}`);
  }
}

// Lee el frontmatter YAML mínimo de una nota (tags, vence). Solo lo que precisa
// `agenda`; no es un parser YAML completo (el vault lo escribe este mismo script).
function parseFront(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = m ? m[1] : "";
  const tagsM = fm.match(/^tags:\s*\[(.*?)\]/m);
  const venceM = fm.match(/^vence:\s*(.+)$/m);
  const estadoM = fm.match(/^estado:\s*(.+)$/m);
  return {
    tags: tagsM ? tagsM[1].split(",").map((t) => t.trim()).filter(Boolean) : [],
    vence: venceM ? venceM[1].trim() : null,
    estado: estadoM ? estadoM[1].trim().toLowerCase() : null,
  };
}

// Tags que marcan un "pendiente" (algo por hacer), para `pendientes` y `agenda`.
const TAGS_PENDIENTE = ["pendiente", "pendientes", "tarea", "tareas", "todo", "por-hacer"];
const esHecho = (estado) => estado === "hecho" || estado === "listo" || estado === "done";

// agenda [tag] — vista de todo lo que tiene fecha y sigue abierto (no marcado hecho):
//   ⚠️ Atrasados: `vence:` ya pasó pero nunca se marcó `done` → sigue apareciendo
//                 hasta que lo marques hecho o le pongas fecha nueva (`due`).
//   Agenda:       `vence:` es HOY o futura ("lo que se viene").
// Ordenadas por fecha. Un tag opcional filtra (ej. `agenda pago`). `--all` incluye
// también las ya hechas.
function cmdAgenda(args) {
  const all = getBool(args, "all"); // incluir también las marcadas hechas
  const tagFilter = (args[0] || "").trim().toLowerCase();
  const hoyStr = hoy();
  const atrasados = [], proximos = [];
  for (const n of listNotes()) {
    const { tags, vence, estado } = parseFront(readFileSync(n.path, "utf8"));
    if (!vence) continue;
    if (!all && esHecho(estado)) continue; // ya se hizo → fuera (salvo --all)
    if (tagFilter && !tags.map((t) => t.toLowerCase()).includes(tagFilter)) continue;
    const fechaVence = vence.slice(0, 10); // parte YYYY-MM-DD para comparar/ordenar
    const item = { vence, titulo: n.file.replace(/\.md$/, ""), tags };
    (fechaVence < hoyStr ? atrasados : proximos).push(item);
  }
  const byFecha = (a, b) => a.vence.localeCompare(b.vence);
  atrasados.sort(byFecha); proximos.sort(byFecha);
  const etiqueta = tagFilter ? ` (tag: ${tagFilter})` : "";
  const linea = (it) => `${it.vence}  ${it.titulo}${it.tags.length ? `  [${it.tags.join(", ")}]` : ""}`;

  if (atrasados.length === 0 && proximos.length === 0) {
    console.log(`No hay nada agendado${etiqueta} de hoy en adelante.`);
    return;
  }
  if (atrasados.length) {
    console.log(`⚠️ Atrasados${etiqueta} — ${atrasados.length} (vencidos sin marcar hecho):`);
    for (const it of atrasados) console.log(linea(it));
    if (proximos.length) console.log("");
  }
  if (proximos.length) {
    console.log(`Agenda${etiqueta} — ${proximos.length} ítem(s):`);
    for (const it of proximos) console.log(linea(it));
  } else if (atrasados.length) {
    console.log(`\nNo hay nada agendado${etiqueta} de hoy en adelante.`);
  }
}

// pendientes — notas por hacer SIN fecha (`vence:` ausente) que NO están hechas y
// llevan un tag de pendiente (pendiente/tarea/todo…). Es la lista de "cosas que
// quiero/tengo que hacer pero sin día fijo" (ej. "comprar PS5"): no salen en
// `agenda` (que pide fecha), así que se muestran aparte en el resumen diario.
function cmdPendientes() {
  const items = [];
  for (const n of listNotes()) {
    const { tags, vence, estado } = parseFront(readFileSync(n.path, "utf8"));
    if (vence) continue;            // con fecha → es asunto de `agenda`
    if (esHecho(estado)) continue;  // ya se hizo
    const tl = tags.map((t) => t.toLowerCase());
    if (!tl.some((t) => TAGS_PENDIENTE.includes(t))) continue;
    items.push({ titulo: n.file.replace(/\.md$/, ""), tags, mtime: n.mtime });
  }
  items.sort((a, b) => b.mtime - a.mtime); // más recientes primero
  if (items.length === 0) {
    console.log("No hay pendientes sin fecha.");
    return;
  }
  console.log(`Pendientes sin fecha — ${items.length}:`);
  for (const it of items) {
    const tagStr = it.tags.length ? `  [${it.tags.join(", ")}]` : "";
    console.log(`- ${it.titulo}${tagStr}`);
  }
}

// done — marca una nota como hecha (estado: hecho en el frontmatter). Deja de
// aparecer en `agenda` y en `pendientes`. Idempotente.
function cmdDone(args) {
  const ref = args.join(" ").trim();
  if (!ref) throw new Error('Uso: done "<titulo|archivo>"');
  const note = resolveNote(ref);
  if (!note) throw new Error(`No encontré ninguna nota que coincida con "${ref}".`);
  let content = readFileSync(note.path, "utf8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    let fm = fmMatch[1];
    if (/^estado:\s*.+$/m.test(fm)) {
      fm = fm.replace(/^estado:\s*.+$/m, "estado: hecho");
    } else {
      fm = fm + "\nestado: hecho";
    }
    content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${fm}\n---`);
  } else {
    // Nota sin frontmatter (rara): le anteponemos uno mínimo.
    content = `---\nfecha: ${hoy()}\ntags: []\nestado: hecho\n---\n\n${content}`;
  }
  writeFileSync(note.path, content, "utf8");
  console.log(`OK Marcada como hecha: ${note.file}`);
}

// due — pone o cambia la fecha (`vence:`) de una nota. Sirve para reprogramar algo
// atrasado ("moveme el pago para el 15") sin perder la nota, o para ponerle fecha a
// un pendiente que no la tenía. Si además estaba marcada hecha, la reabre.
function cmdDue(args) {
  const nuevaFecha = getFlag(args, "due") || args[1] || "";
  const ref = (args[0] || "").trim();
  const fecha = String(nuevaFecha).trim();
  if (!ref || !fecha) throw new Error('Uso: due "<titulo|archivo>" "YYYY-MM-DD[ HH:MM]"');
  const note = resolveNote(ref);
  if (!note) throw new Error(`No encontré ninguna nota que coincida con "${ref}".`);
  let content = readFileSync(note.path, "utf8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error(`La nota "${note.file}" no tiene frontmatter para ponerle fecha.`);
  let fm = fmMatch[1];
  fm = /^vence:\s*.+$/m.test(fm) ? fm.replace(/^vence:\s*.+$/m, `vence: ${fecha}`) : `${fm}\nvence: ${fecha}`;
  // Al reprogramar, dejar de considerarla hecha (se vuelve a agendar).
  fm = fm.replace(/^estado:\s*.+\n?/m, "");
  content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${fm.replace(/\n{2,}/g, "\n")}\n---`);
  writeFileSync(note.path, content, "utf8");
  console.log(`OK Reprogramada: ${note.file} → vence ${fecha}`);
}

function cmdRead(args) {
  const ref = args.join(" ").trim();
  if (!ref) throw new Error('Uso: read "<titulo|archivo>"');
  const note = resolveNote(ref);
  if (!note) throw new Error(`No encontré ninguna nota que coincida con "${ref}".`);
  console.log(`# Fuente: ${note.file}\n`);
  console.log(readFileSync(note.path, "utf8"));
}

function cmdLink(args) {
  const [refA, refB] = args;
  if (!refA || !refB) throw new Error('Uso: link "<nota>" "<nota-destino>"');
  const a = resolveNote(refA);
  if (!a) throw new Error(`No encontré la nota origen "${refA}".`);
  const destino = (resolveNote(refB)?.file || slugTitle(refB) + ".md").replace(/\.md$/, "");
  let content = readFileSync(a.path, "utf8");
  const linkLine = `- [[${destino}]]`;
  if (content.includes(`[[${destino}]]`)) {
    console.log(`OK ${a.file} ya enlazaba a [[${destino}]].`);
    return;
  }
  if (/^##\s+Conexiones\s*$/m.test(content)) {
    content = content.replace(/(^##\s+Conexiones\s*$)/m, `$1\n${linkLine}`);
  } else {
    content = content.replace(/\s*$/, "") + `\n\n## Conexiones\n${linkLine}\n`;
  }
  writeFileSync(a.path, content, "utf8");
  console.log(`OK ${a.file} ahora enlaza a [[${destino}]].`);
}

function cmdTags() {
  const notes = listNotes();
  const counts = {};
  for (const n of notes) {
    const content = readFileSync(n.path, "utf8");
    const m = content.match(/^tags:\s*\[(.*?)\]/m);
    if (!m) continue;
    for (const t of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  const filas = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (filas.length === 0) { console.log("Ninguna nota tiene tags todavía."); return; }
  for (const [tag, count] of filas) console.log(`${String(count).padStart(3)}  #${tag}`);
}

// summary — el "resumen diario": junta `agenda` (con fecha + ⚠️ atrasados) y
// `pendientes` (sin fecha) en una sola vista. Es lo que pide el usuario cuando
// dice "generame el resumen diario / qué tengo hoy / qué hay pendiente". Ignora
// a propósito cualquier flag extra (ej. `--mes`): el resumen es siempre el estado
// abierto actual del vault, no un rango.
function cmdSummary() {
  console.log(`Resumen diario — ${hoy()}\n`);
  console.log("— Agenda (con fecha) —");
  cmdAgenda([]);
  console.log("\n— Pendientes (sin fecha) —");
  cmdPendientes();
}

const [cmd, ...args] = rawArgs;
try {
  switch (cmd) {
    case "new": cmdNew(args); break;
    case "append": cmdAppend(args); break;
    case "search": cmdSearch(args); break;
    case "list": cmdList(args); break;
    case "agenda": cmdAgenda(args); break;
    case "pendientes": cmdPendientes(); break;
    case "summary":
    case "resumen":
    case "brief": cmdSummary(); break;
    case "done": cmdDone(args); break;
    case "due": cmdDue(args); break;
    case "read": cmdRead(args); break;
    case "link": cmdLink(args); break;
    case "tags": cmdTags(); break;
    default:
      console.log("Comandos: new | append | search | list | agenda | pendientes | summary | done | due | read | link | tags");
      console.log(`Vault actual: ${VAULT}`);
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
