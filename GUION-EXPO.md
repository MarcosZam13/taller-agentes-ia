# Guion de la expo — Taller "Agentes de IA desde cero" (4 horas)

Run-of-show práctico para los **3 facilitadores** (Marcos, María, Mario). Basado en
el documento formal entregado, **ajustado a la tecnología real del taller** (OpenRouter
+ gpt-4o-mini, instaladores por script, Pi como servidor del dashboard).

> **Regla de oro:** 4 horas es el techo. La vez pasada nos pasamos "por un poquito",
> así que este guion mete **20 min de colchón** + **10 min de descanso** y recorta la
> instalación (ahora es por script, mucho más rápida). Si un bloque se atrasa, se come
> del colchón, no del siguiente.

---

## Presupuesto de tiempo (240 min exactos)

| # | Bloque | Responsable | Tiempo | Acumulado |
|---|---|---|---|---|
| 1 | Contexto + demo en vivo | Marcos | 25 min | 0:25 |
| 2 | Arquitectura del agente (Jarvis) | María | 30 min | 0:55 |
| 3 | Instalación → **chatbot pelado** | Mario (los 3 apoyan) | 45 min | 1:40 |
| — | **Descanso** | — | 10 min | 1:50 |
| 4 | Activar el caso → **hands-on** | Todos | 60 min | 2:50 |
| 5 | IA local + N8N + futuro | Marcos | 25 min | 3:15 |
| 6 | Cierre: multiagente + Q&A | Todos | 25 min | 3:40 |
| — | **Colchón de errores / buffer** | — | 20 min | 4:00 |

> El colchón está al final a propósito: si sobra, es Q&A/networking extra; si los
> bloques 3-4 se atrasaron, ya lo fuiste consumiendo y cerrás en hora igual.

---

## Bloque 1 — Contexto + demo en vivo (Marcos · 25 min)

**Objetivo:** enganchar antes de tecnicismos. Que vean un agente *haciendo cosas* ya.

**Puntos clave (10 min):**
- Panorama IA 2026: de "chatear" a "hacer". El salto de chatbot → agente.
- **Chatbot vs. agente** (la idea central del taller): un chatbot *responde*; un agente
  *planifica, decide y ejecuta acciones sobre herramientas reales*.
- Qué van a lograr hoy: su propio agente por Telegram, con una herramienta real.

**Demo en vivo (12 min):** el dashboard `vault.gymbase.fit` proyectado.
- Desde tu celular, por Telegram, mandás: `gasté 8500 en el almuerzo` → se enciende
  el cuarto **FINANZAS**.
- `anotá que hoy arranqué el taller` → **CEREBRO**. `resumen de mis gastos` → FINANZAS.
- Pregunta a la sala: *"¿cómo creen que hace esto?"* → puente al bloque 2.

**Manejo de errores:**
- Si el internet o el túnel fallan, el dashboard tiene **modo simulación** (los cuartos
  se animan solos). Igual sirve para explicar. Ten un video corto de respaldo por si acaso.
- Ten el bot ya abierto y probado 10 min antes (ver checklist de la guía de la Pi).

---

## Bloque 2 — Arquitectura del agente (María · 30 min)

**Objetivo:** el modelo mental. Sin código todavía.

**La metáfora Jarvis:**
- **LLM = cerebro** (razona y decide, pero no hace nada solo).
- **Herramientas = manos** (ejecutar código, leer PDF, guardar datos).
- **Memoria = contexto** (lo que recuerda de la conversación).

**Conceptos a soltar (con lenguaje simple):**
- **LLM, tokens y contexto:** el modelo lee/escribe en *tokens*; la *ventana de contexto*
  es cuánto "recuerda" de golpe. Analogía: memoria de trabajo limitada.
- **El loop de decisión:** `recibir → decidir → actuar → observar → responder`.
  Dibujalo. Es lo que separa un agente de un chatbot.
- **Herramientas (tools):** cómo el LLM "pide" ejecutar algo y el sistema lo corre de verdad.
- **Memoria vs. contexto:** el agente puede guardar cosas (archivos, notas) y traerlas
  después — no todo vive en la ventana de contexto.

**Gancho para el bloque 3:** "ahora cada uno va a levantar el cerebro (el LLM) — pero
sin manos todavía. Un chatbot. Después le damos las manos."

**Manejo de errores:** bloque sin dependencias técnicas → es el bloque "seguro" para
recuperar tiempo si el bloque 1 se atrasó (se puede comprimir a 20 min).

---

## Bloque 3 — Instalación → chatbot pelado (Mario, los 3 apoyan · 45 min)

**Objetivo:** cada participante con un **chatbot** funcionando por Telegram. Todavía
NO ejecuta acciones — eso es a propósito (contraste pedagógico).

**Paso a paso (guiado desde el proyector):**
1. Prerrequisitos listos (los pidieron de antemano): Node 22, key de OpenRouter del
   taller, bot de Telegram + su ID.
2. `git clone` → `cp .env.example .env` → pegar `OPENROUTER_API_KEY` + Telegram.
3. `bash setup/install.sh` (Windows: en Git Bash).
4. `node setup/check.js` → todo verde.
5. **Probar el bot:** le escriben y responde. **"Fíjense: conversa, pero si le piden
   registrar un gasto, solo habla, no lo hace."** ← este es el momento clave.

**Reparto de sala (3 facilitadores):** uno conduce desde el proyector, los otros dos
caminan entre mesas resolviendo errores. Divídanse por zonas.

**Manejo de errores (los típicos — tenerlos a mano):**
| Error | Fix rápido |
|---|---|
| `command not found: openclaw` / `node` | cerrar y reabrir terminal, o `source ~/.bashrc` |
| `EACCES` al instalar | repetir el paso de npm prefix sin sudo |
| Windows corre en PowerShell y falla | usar **Git Bash**, no PowerShell, para los `bash setup/...` |
| Bot no responde | revisar token/ID en `.env`, luego `node setup/apply-config.mjs` |
| Responde JSON crudo | el modelo no es gpt-4o-mini → confirmar OpenRouter |

> Con los scripts esto debería cerrar en 30-35 min; los 45 incluyen margen para los
> rezagados. Si va rápido, arrancan el descanso antes.

---

## Descanso (10 min)

Café. Los facilitadores aprovechan para destrabar a quien quedó atrás en la instalación.

---

## Bloque 4 — Activar el caso → hands-on (Todos · 60 min)

**Objetivo:** el momento "wow". El mismo bot que solo conversaba ahora **ejecuta**.

**Arranque conjunto (10 min):**
- Cada quien elige **un** caso y corre **un** comando:
  - `bash casos/finanzas/install.sh` — registrar gastos
  - `bash casos/second-brain/install.sh` — notas / segundo cerebro
  - `bash casos/pdf-extractor/install.sh` — leer PDFs (necesita poppler)
  - `bash casos/dev-assistant/install.sh` — ejecutar Python (necesita python3)
- **Vuelven a Telegram y prueban lo mismo de antes** → ahora sí lo hace.
  *"Le dimos las manos."* Este contraste es el corazón del taller.

**Trabajo individual (45 min):** cada uno sigue el README de su caso
(`casos/<caso>/README.md`), que trae frases de prueba paso a paso. Los facilitadores
rotan por mesas.

**Puente a "memoria" (5 min, en vivo):** mostrar que si guardás algo hoy, el agente
lo estampa con la fecha del día. (Nota honesta: sabe *cuándo* se lo dijiste, pero por
ahora no razona bien "el finde pasado" solo — buen pie para hablar de mejoras.)

**Manejo de errores:**
- `pdf-extractor` sin `poppler` o `dev-assistant` sin `python3`: instalarlos y re-correr
  el instalador del caso (es idempotente).
- Si alguien se traba, que se sume a un caso más simple (finanzas o second-brain).
- **Los facilitadores tienen los 4 casos instalados** en sus máquinas para demostrar
  cualquiera en el proyector.

---

## Bloque 5 — IA local + N8N + futuro (Marcos · 25 min)

**Objetivo:** ampliar horizonte. Todo esto se **explica**, no se instala (para no comer tiempo).

- **IA local (Ollama):** se puede correr un LLM en tu propia máquina/servidor, sin
  nube, sin exponer datos. Soberanía tecnológica. *Nota:* la Pi de la demo hoy usa
  OpenRouter (no IA local) por simplicidad — pero se explica que el mismo agente
  podría apuntar a un modelo local con Ollama. (Opcional: mini-demo de Ollama en una
  laptop si hay tiempo y batería de colchón.)
- **Automatización con N8N:** conectar el agente a flujos (webhooks, correos, hojas de
  cálculo, cron). Ejemplo: "cada vez que llega una factura por email, el agente la
  extrae y la registra". No se hace hoy, se muestra el potencial.
- **Privacidad y costo:** nube vs. local, cuándo conviene cada uno.

**Manejo de errores:** bloque de charla → si vas atrasado, este se comprime a 15 min
sin perder nada esencial.

---

## Bloque 6 — Cierre: multiagente + Q&A (Todos · 25 min)

- **Arquitecturas multi-agente:** varios agentes especializados que colaboran (uno
  investiga, otro escribe, otro ejecuta). La frontera activa. El dashboard con 4
  cuartos es una metáfora visual de esto.
- **Casos empresariales:** soporte, operaciones, análisis de documentos, dev.
- **Recursos curados:** el repo del taller, docs de OpenClaw, ReAct/Toolformer (papers
  del documento), comunidades.
- **Q&A + networking.**

---

## Colchón de errores / buffer (20 min)

No es un bloque con contenido: es el margen para que los atrasos de instalación no
tiren la hora de cierre. Si no se usó, se convierte en más Q&A o en ayudar a que todos
dejen su agente 100% funcionando antes de irse.

---

## ⚠️ Cambios que hay que actualizar en el documento formal de Word

El doc entregado quedó desalineado con la tecnología real. Antes de volver a
presentarlo/entregarlo, corregir:

1. **Proveedor y modelo:** dice "API de Groq (LLaMA 3)". Hoy el taller usa **OpenRouter
   + gpt-4o-mini** (el Llama de Groq emite las llamadas a herramientas como texto y
   rompe las skills). Actualizar objetivos, materiales y requisitos.
2. **El 4º caso:** el doc lista "Gestión de proyectos". El caso real implementado es
   **PDF Extractor** (leer PDFs → datos). Cambiarlo (o aclarar que son finanzas,
   second brain, pdf-extractor, dev-assistant).
3. **Node.js:** el doc pide v18. El repo requiere **Node 22+**.
4. **IA local en la Pi:** el doc promete "demo de modelo local con Ollama en la Pi".
   La Pi hoy **no** corre IA local (usa OpenRouter). Reformular ese bloque como
   *explicación* de IA local (+ demo opcional en laptop), no demo en la Pi.
5. **Materiales:** "cuenta en Groq" → **key de OpenRouter** (o la key compartida del taller).
6. **Instalación en dos pasos:** mencionar que primero se levanta un chatbot y luego se
   activa el caso (es lo que hace el contraste pedagógico).

> La agenda de 6 bloques y los tiempos del doc siguen siendo válidos; lo que cambia es
> el stack. Este guion ya refleja todo lo anterior.
