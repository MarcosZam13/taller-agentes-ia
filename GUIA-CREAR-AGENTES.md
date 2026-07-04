# Guía: Crear y modificar agentes 🛠️

Esta guía es la parte **formativa** del taller. Hasta ahora instalaste el chatbot
pelado y los 4 casos ya hechos. Acá aprendés **cómo están hechos por dentro** para
poder **modificarlos** y **crear los tuyos**: darles personalidad, herramientas y
conocimiento.

> **Idea central del taller:** un **chatbot** solo conversa; un **agente** además
> **actúa** — corre scripts, consulta datos, ejecuta comandos. La diferencia no es el
> modelo, es que le damos **herramientas** y **reglas de cuándo usarlas**.

Todo lo que ves acá funciona con `gpt-4o-mini` (un modelo chico) porque el trabajo
"difícil" lo hacen scripts deterministas, no el modelo. Ese es el patrón clave.

---

## 0. Antes de empezar

Necesitás el chatbot base ya instalado (`bash setup/install.sh`). Para probar tus
cambios sin Telegram, usá el agente local:

```bash
openclaw agent --local --agent main --session-id prueba --message "hola" --json
```

Y para ver el estado del agente:

```bash
openclaw config get agents.defaults.skills   # qué skills tiene cargadas
```
Y dentro del chat (Telegram o `openclaw agent`): escribí **`/skills`** para ver las
skills y herramientas activas.

---

## 1. Los 3 ingredientes de un agente

| Ingrediente | Qué es | Dónde vive |
|---|---|---|
| 🧠 **Personalidad** | Quién es, cómo habla, qué reglas sigue (el *system prompt*) | `AGENTS.md` y el cuerpo de cada `SKILL.md` |
| 🔧 **Herramientas** | Lo que puede *hacer*: correr scripts (`exec`), leer archivos, etc. | `tools` en `openclaw.json` |
| 📚 **Conocimiento / memoria** | Los datos con los que trabaja (gastos, notas…) | El **motor `.js`** de cada skill + su carpeta `data/` |

Un **chatbot pelado** tiene personalidad pero `tools: {}` (sin `exec`) → solo puede
hablar. Un **agente** tiene `exec` habilitado + skills → puede actuar.

---

## 2. Anatomía: dónde vive cada cosa

Hay **dos lugares** y es importante no confundirlos:

**a) El repo** (la *fuente*, lo que editás y subís a git):
```
taller-agentes-ia/
├── AGENTS.md                    ← personalidad base + tabla de routing
├── skills/<skill>/
│   ├── SKILL.md                 ← prompt de la skill (cómo se comporta)
│   ├── <motor>.js               ← el trabajo determinista (persistencia, cálculos)
│   └── data/                    ← datos de ejemplo
├── casos/<caso>/install.sh      ← "empaqueta" una skill como caso instalable
└── setup/
    ├── install.sh               ← instalador global (chatbot pelado)
    ├── apply-config.mjs         ← genera openclaw.json (modelo, tools baseline)
    └── install-case.mjs         ← activa UN caso (copia skill + parcha config/AGENTS.md)
```

**b) El agente instalado** (lo que el gateway realmente usa, en tu `$HOME`):
```
~/.openclaw/
├── openclaw.json                ← config viva: modelo, tools, skills del agente
└── workspace/
    ├── AGENTS.md                ← personalidad viva (copia parchada del repo)
    └── skills/<skill>/          ← skills copiadas acá (SKILL.md + motor + data)
```

> Regla mental: **editás en el repo → un instalador lo copia al `~/.openclaw/workspace`**.
> Para experimentos rápidos podés editar directo en el workspace, pero se pierde si
> reinstalás. Lo "de verdad" va en el repo.

Cuando cambiás algo en el workspace o en la config, **el gateway recarga solo**
(*hybrid reload*). No hace falta reiniciar nada.

---

## 3. La PERSONALIDAD — `AGENTS.md`

`~/.openclaw/workspace/AGENTS.md` es el *system prompt* base: OpenClaw se lo pasa al
modelo en cada conversación. Mirá las secciones que ya tiene:

- **Identidad** — quién es el agente ("Sos un asistente práctico para el taller…").
- **Idioma** — responder en español, usar "vos".
- **Comportamiento** — respuestas cortas, preguntar si hay duda, no inventar.
- **Reglas de routing** — la tabla que le dice *qué ejecutar* para cada pedido.

### 🏋️ Ejercicio 1 — Cambiale la personalidad (5 min)

Abrí el AGENTS.md del workspace y cambiá el tono:

```bash
nano ~/.openclaw/workspace/AGENTS.md
```

Por ejemplo, en la sección **Identidad**, agregá:
`"Hablás como pirata caribeño, pero seguís siendo preciso con los datos."`

Guardá y probá:
```bash
openclaw agent --local --agent main --session-id pirata --message "hola, cómo andás?"
```

Deberías notar el cambio de tono **sin tocar código**. Eso es el poder del system
prompt. (Después dejalo como estaba, o pasá el cambio al `AGENTS.md` del repo si te gustó.)

---

## 4. Las HERRAMIENTAS — `tools` en `openclaw.json`

Acá está la diferencia chatbot vs. agente. En la config:

```jsonc
// chatbot pelado (instalador global)
"tools": {}

// agente con herramientas (lo activa el primer caso)
"tools": {
  "exec": { "security": "full", "ask": "off" },   // puede correr comandos de shell
  "deny": [ "write", "create_goal", "memory_search", ... ]  // lo que NO puede usar
}
```

- **`exec`** es *la* herramienta clave: deja al agente correr `node …/expense.js add …`,
  `date`, `python3`, etc. Sin `exec`, las skills no pueden actuar.
- **`deny`** es igual de importante: le **prohíbe** atajos que arruinan el caso. Sin la
  deny list, el modelo tiende a "guardar en memoria" o "crear un goal" en vez de correr
  el script. Denegando `write`, `create_goal`, `memory_search`, etc., lo **forzás** a
  usar la herramienta correcta. *(Ver `BASE_DENY` en `setup/install-case.mjs`.)*
- **Tools nativas**: OpenClaw trae algunas (`pdf`, `write`, memoria de embeddings…). A
  veces conviene **denegarlas** para que el agente use *tu* script. Ejemplo real: el caso
  `pdf-extractor` deniega la tool nativa `pdf` (`extraDeny: ["pdf"]`) para forzar la vía
  `exec → pdf.js`.

### 🏋️ Ejercicio 2 — Ver la línea entre chatbot y agente (5 min)

```bash
# Ver el estado actual de tools
openclaw config get tools
```
- **Con un caso instalado** verás `exec` habilitado → pedile "gasté 5000 en café" y lo
  **registra**.
- **Reseteá al chatbot pelado** corriendo el instalador global (borra `tools` → `{}`):
  ```bash
  bash setup/install.sh
  ```
  Ahora "gasté 5000 en café" solo obtiene una respuesta de texto: **no actúa**.
- **Reactivá** un caso para recuperar `exec`:
  ```bash
  bash casos/finanzas/install.sh
  ```

Esa diferencia — poder **actuar** vs. solo **conversar** — es exactamente lo que separa
un agente de un chatbot.

---

## 5. Anatomía de una SKILL

Una skill son **dos archivos** en `skills/<skill>/`:

### a) `SKILL.md` — el "cómo se comporta"
Tiene *frontmatter* (metadatos) y un cuerpo (el prompt de la skill):

```markdown
---
name: expense-tracker
description: Registra y analiza gastos personales en colones (₡)…
user-invocable: true
metadata:
  { "openclaw": { "emoji": "💰", "always": true, "requires": { "bins": ["node"] } } }
---

# Expense Tracker — Control de Gastos

Sos un asistente financiero para Costa Rica…

## Comandos disponibles
| Intención del usuario | Comando a ejecutar |
|---|---|
| Registrar un **gasto** | `node {baseDir}/expense.js add <monto> <categoria> "<desc>"` |
…
```

Puntos clave del `SKILL.md`:
- **`name`** debe coincidir con el nombre de la carpeta.
- **`description`** ayuda al agente a decidir cuándo usar la skill.
- **`{baseDir}`** es un placeholder que OpenClaw reemplaza por la ruta real de la skill.
- El cuerpo es un mini system prompt **solo para esta skill**: le dice al agente qué
  comando correr para cada intención, con ejemplos. Cuanto más claro y con "disparadores"
  explícitos, mejor funciona con modelos chicos.

### b) El motor `.js` — el "trabajo de verdad"
Determinista, sin IA. Recibe un comando por argumentos, hace el trabajo, e imprime una
línea que empieza con `OK …` o `ERROR: …`. Patrón (de `expense.js`):

```js
const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case "add":     cmdAdd(args);     break;   // → console.log(`OK Registrado: …`)
  case "summary": cmdSummary(args); break;
  // …
  default: console.log("ERROR: comando desconocido"); process.exit(1);
}
```

Los datos se guardan en `skills/<skill>/data/` (JSON), no en la "memoria" del modelo.
Por eso el agente **no alucina**: su única fuente es lo que el script imprime.

### 🏋️ Ejercicio 3 — Agregale un comando a una skill (15 min)

Meta: agregar `top` a finanzas → "¿en qué categoría gasto más?".

1. **Editá el motor** `skills/expense-tracker/expense.js`:
   ```js
   function cmdTop() {
     const db = load();
     const porCat = {};
     for (const g of db.gastos) porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto;
     const orden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
     if (!orden.length) return console.log("OK Sin gastos registrados todavía.");
     const [cat, monto] = orden[0];
     console.log(`OK Tu categoría más cara es "${cat}" con ${fmt(monto)}.`);
   }
   ```
   Y agregá el caso al `switch`:
   ```js
   case "top": cmdTop(); break;
   ```

2. **Probá el motor a mano** (sin el agente):
   ```bash
   node skills/expense-tracker/expense.js top
   ```

3. **Enseñale al agente** que existe. Agregá una fila de routing en **dos** lados:
   - En `skills/expense-tracker/SKILL.md` (tabla de comandos), y
   - En la lista `routing` del caso `finanzas` en `setup/install-case.mjs`:
     ```js
     "| pregunta **en qué categoría gasta más** (\"en qué se me va la plata\") | `node ~/.openclaw/workspace/skills/expense-tracker/expense.js top` |",
     ```

4. **Reinstalá el caso** para copiar los cambios al workspace y parchar AGENTS.md:
   ```bash
   bash casos/finanzas/install.sh
   ```

5. Probá en el chat: *"¿en qué se me va la plata?"* → el agente corre `expense.js top`.

---

## 6. Crear una SKILL nueva desde cero

Ejemplo mínimo: una skill **`conversor`** que pasa dólares a colones.

**1. Creá la carpeta y el motor** `skills/conversor/convertir.js`:
```js
#!/usr/bin/env node
const TASA = 520; // ₡ por US$ (ejemplo)
const [cmd, monto] = process.argv.slice(2);
if (cmd === "usd" && monto) {
  const crc = Number(monto) * TASA;
  console.log(`OK US$${monto} = ₡${crc.toLocaleString("es-CR")}`);
} else {
  console.log("ERROR: uso: convertir.js usd <monto>");
  process.exit(1);
}
```

**2. Creá el `SKILL.md`** `skills/conversor/SKILL.md`:
````markdown
---
name: conversor
description: Convierte montos de dólares (US$) a colones (₡).
user-invocable: true
metadata:
  { "openclaw": { "emoji": "💵", "always": true, "requires": { "bins": ["node"] } } }
---

# Conversor US$ → ₡

Si el usuario pide convertir dólares a colones ("cuánto son 20 dólares"), tu única
acción es ejecutar con `exec`:

```
node {baseDir}/convertir.js usd <monto>
```

Reportá exactamente lo que imprime el script (empieza con `OK`).
````

**3. Registrala a mano** (para probar rápido, sin hacer un caso todavía):
```bash
# copiar la skill al workspace del agente
cp -r skills/conversor ~/.openclaw/workspace/skills/
# agregar "conversor" a agents.defaults.skills (y al agente "main") en la config
nano ~/.openclaw/openclaw.json
#   → en agents.defaults.skills:  [ "expense-tracker", "conversor" ]   (sumá, no reemplaces)
```
> `exec` ya tiene que estar activo. Si aún no instalaste ningún caso, corré primero
> `bash casos/finanzas/install.sh` (o cualquiera) para que la config habilite `exec`.

**4. Probá:** *"cuánto son 20 dólares"* → el agente corre `convertir.js usd 20`.

> El camino **limpio** para registrar una skill es empaquetarla como caso (sección 7):
> `install-case.mjs` hace estos pasos por vos y sin errores. La registración a mano es
> solo para entender qué pasa por dentro.

> Ese es el ciclo completo de una skill: **SKILL.md (cómo) + motor .js (qué) + registrarla
> (config + workspace)**. Todo lo demás son variaciones de esto.

---

## 7. Empaquetar tu skill como un CASO instalable

Para que tu skill se instale con **un comando** (como los 4 casos), hay que agregarla al
manifiesto de casos:

**1. Agregá una entrada a `CASES` en `setup/install-case.mjs`:**
```js
conversor: {
  skill: "conversor",
  label: "Conversor de monedas 💵",
  requires: [],                 // binarios que necesita (ej. python3); [] si solo node
  routing: [
    "| pide **convertir dólares a colones** (\"cuánto son X dólares\") | `node ~/.openclaw/workspace/skills/conversor/convertir.js usd <monto>` |",
  ],
  // extraDeny: ["pdf"],        // opcional: denegar tools nativas que compitan
},
```

**2. Creá `casos/conversor/install.sh`** (copiá el de otro caso, son 2 líneas útiles):
```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$REPO_DIR/setup/install-case.mjs" conversor
```

**3. Instalalo como cualquier caso:**
```bash
bash casos/conversor/install.sh
```

`install-case.mjs` hace todo solo (y es **idempotente**): copia la skill al workspace,
la agrega a `agents.defaults.skills`, activa `exec` + la deny list, e inserta tus filas
de routing en `AGENTS.md` entre los marcadores `<!-- TALLER:CASOS:START/END -->`.

---

## 8. Recargar, verificar y debuggear

- **Recarga:** el gateway recarga solo al cambiar config o workspace (*hybrid reload*).
  Si dudás: `systemctl --user restart openclaw-gateway` (en la Pi) o reiniciá el `openclaw`.
- **Verificar skills cargadas:** `openclaw config get agents.defaults.skills`
- **Ver todas las tools/skills en el chat:** `/skills`
- **Probar el motor aislado** (clave para debuggear): corré el `.js` a mano y mirá que
  imprima `OK …`. Si el script anda solo pero el agente no lo usa, el problema está en el
  **prompt/routing** (SKILL.md o AGENTS.md), no en el código.
- **El agente "no ejecuta" y responde texto:** casi siempre es (a) `exec` deshabilitado,
  (b) falta la fila de routing, o (c) el modelo no es `gpt-4o-mini` (otros no hacen
  tool-calling nativo y rompen las skills — ver `setup/apply-config.mjs`).
- **Ver la actividad en vivo:** el dashboard (`https://vault.gymbase.fit`) muestra qué
  skill ejecutó el agente en cada mensaje.

---

## 9. Cheatsheet

```bash
# Probar el agente sin Telegram
openclaw agent --local --agent main --session-id x --message "…" --json

# Estado
openclaw config get agents.defaults.skills
openclaw config get tools
/skills                                   # dentro del chat

# Instalar / reinstalar un caso (idempotente)
bash casos/<caso>/install.sh

# Volver al chatbot pelado (resetea el agente)
bash setup/install.sh

# Probar un motor de skill aislado
node skills/<skill>/<motor>.js <comando> [args]
```

**Los 4 archivos que tocás para crear/modificar un agente:**
1. `AGENTS.md` → personalidad + routing global
2. `skills/<skill>/SKILL.md` → cómo se comporta la skill
3. `skills/<skill>/<motor>.js` → qué hace de verdad
4. `setup/install-case.mjs` → para empaquetarla como caso instalable

Con eso ya podés construir tu propio agente. **El resto es imaginación** (y buenos
prompts). 🚀
