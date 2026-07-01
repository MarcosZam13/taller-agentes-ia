# Guía del Facilitador — Taller Agentes IA con OpenClaw

Guía completa para replicar y facilitar el taller. Incluye agenda, preparación técnica, troubleshooting en vivo y contexto de cada caso.

---

## Resumen del taller

**Duración:** 3–4 horas  
**Audiencia:** Desarrolladores con experiencia básica-intermedia  
**Herramienta central:** [OpenClaw](https://docs.openclaw.ai) + OpenRouter (gpt-4o-mini)  
**Idioma:** Español (castellano centroamericano)

### Lo que los participantes van a construir

| # | Caso | Tiempo | Skill | Lo que aprenden |
|---|---|---|---|---|
| 1 | Rastreador de gastos | 25–35 min | `expense-tracker` | Skills, lenguaje natural → datos, ciclos de confirmación |
| 2 | Second Brain con Obsidian | 25–35 min | `second-brain` | Gestión de conocimiento, Markdown como backend de IA |
| 3 | Extractor de PDFs | 25–35 min | `pdf-extractor` | Documentos → datos estructurados, pdftotext + LLM |
| 4 | Dev Assistant que ejecuta código | 25–35 min | `dev-assistant` | Agentes que hacen cosas reales, ciclo debug→fix→verificar |

---

## Agenda sugerida

```
00:00  Bienvenida y contexto (15 min)
       → Por qué agentes IA, qué es OpenClaw, demo del vault en vivo
       
00:15  Setup inicial en las máquinas (20 min)
       → clone + .env + install.sh (chatbot base) + check.js
       → probar el chatbot: conversa pero NO ejecuta acciones todavía
       
00:35  Caso 1: Finanzas (35 min)
       → bash casos/finanzas/install.sh → expense-tracker
       → registrar gastos, presupuestos (ahora sí EJECUTA)
       
01:10  DESCANSO (10 min)

01:20  Caso 2: Second Brain (30 min)
       → notas Obsidian por chat, conectar ideas

01:50  Caso 3: PDF Extractor (30 min)
       → procesar facturas, extraer tablas, exportar CSV

02:20  Caso 4: Dev Assistant (35 min)
       → ejecutar código, analizar errores, correr tests

02:55  Cierre y Q&A (15 min)
       → próximos pasos, personalizar los agentes

03:10  Fin
```

---

## Preparación antes del taller (facilitador)

### 1 día antes

- [ ] Clonar el repo y correr `bash setup/install.sh` en tu máquina
- [ ] Verificar `node setup/check.js` — todo verde
- [ ] Instalar y probar los 4 casos: `bash casos/<caso>/install.sh` con las frases del README de cada uno
- [ ] Preparar PDFs de ejemplo para el caso 3 (facturas, contratos)
- [ ] Si usás la Raspberry Pi para la demo/dashboard: `bash setup/pi-setup.sh` (instala los 4 casos + relay + Cloudflare Tunnel en un solo comando)

### 30 minutos antes

- [ ] Arrancar gateway: `systemctl --user start openclaw-gateway.service`
- [ ] Arrancar vault dashboard: `bash setup/open-vault.sh`
- [ ] Verificar que el vault muestra ONLINE (punto verde en la esquina)
- [ ] Proyectar el vault dashboard en la pantalla grande
- [ ] Preparar un bot de Telegram de demostración para la apertura

### Durante el setup de participantes

Cada participante necesita:
1. **OpenRouter API key** (la key compartida del taller, o la propia de [openrouter.ai](https://openrouter.ai))
2. **Bot de Telegram** (opcional para el taller básico)
3. **Repositorio clonado** con `.env` completo

```bash
# Paso 1 — chatbot base (todos)
git clone https://github.com/MarcosZam13/taller-agentes-ia.git
cd taller-agentes-ia
cp .env.example .env
nano .env   # OPENROUTER_API_KEY es lo obligatorio
bash setup/install.sh
node setup/check.js

# Paso 2 — cada participante elige UN caso y le da una herramienta
bash casos/finanzas/install.sh        # o second-brain / pdf-extractor / dev-assistant
```

> **Truco pedagógico:** hacé que prueben el bot ANTES del paso 2. Verán que solo
> conversa. Después del instalador del caso, el mismo bot ejecuta acciones reales.
> Esa es la demostración de "chatbot vs. agente con herramientas".

---

## La demo de apertura (el momento "wow")

El vault dashboard es la herramienta visual para abrir el taller con impacto. Mostrás en la pantalla grande el panel con los 4 agentes, y mientras hablás, vas enviando mensajes al agente desde Telegram (en tu celular) — los participantes ven en tiempo real cómo los cuartos se activan.

**Flujo recomendado:**
1. Abrir el vault: `bash setup/open-vault.sh`
2. Proyectar el vault en la pantalla
3. Desde tu celular en Telegram, enviar: `gasté 8500 en el almuerzo`
4. La sala ve el cuarto FINANZAS encenderse con animación
5. Preguntar: "¿Cómo creen que funciona esto?" → abrir la discusión

---

## Conceptos clave para explicar

### ¿Qué es un agente de IA?

Un programa que usa un LLM para *tomar decisiones* sobre qué hacer con un input, en lugar de solo generar texto. La diferencia con un chatbot normal: el agente puede ejecutar acciones (guardar datos, leer archivos, correr código).

### ¿Qué es una Skill en OpenClaw?

Un archivo Markdown (SKILL.md) que se inyecta como system prompt al modelo. Define el dominio del agente — qué sabe hacer, cómo almacenar datos, qué confirmaciones pedir. Es el "manual de instrucciones" del agente escrito en lenguaje natural.

```
skills/expense-tracker/SKILL.md → el agente entiende gastos en colones
skills/second-brain/SKILL.md    → el agente entiende notas de Obsidian
```

### El ciclo de un mensaje

```
Usuario escribe → Gateway recibe → LLM procesa con SKILL.md como contexto
→ Agente decide acción → Ejecuta (guardar, leer, correr código)
→ Responde al usuario
```

### ¿Por qué gpt-4o-mini (OpenRouter)?

Las skills de los casos dependen de **tool-calling nativo**: el modelo tiene que
emitir la llamada a la herramienta como una estructura que el gateway ejecuta.
`gpt-4o-mini` lo hace bien, es barato y rápido — por eso es el modelo validado del
taller.

> **Ojo con Groq/Llama:** el Llama de Groq responde rápido, pero emite las llamadas
> a herramientas **como texto** (te devuelve un JSON crudo en el chat en vez de
> ejecutar). Sirve para el chatbot pelado, pero **rompe los casos con herramientas**.
> Fue el bug original de "solo me devuelve el JSON y no hace nada". Por eso el
> allowlist de modelos fuerza gpt-4o-mini.

---

## Errores comunes en el taller y cómo resolverlos

| Síntoma | Causa | Solución en vivo |
|---|---|---|
| `openclaw: command not found` | PATH no actualizado | `source ~/.bashrc` o nuevo terminal |
| Gateway no inicia en puerto 18789 | Puerto ocupado | `openclaw gateway run --force` |
| Vault dashboard muestra OFFLINE | Relay no está corriendo | `bash setup/open-vault.sh` |
| Bot no responde en Telegram | Gateway caído o token expirado | `node setup/check.js` |
| Error 429 (rate limit) | Muchas requests seguidas | Esperar 60s y reintentar |
| El agente responde JSON crudo / solo texto | Modelo equivocado (Llama) o caso sin instalar | Confirmar OpenRouter+gpt-4o-mini (`node setup/apply-config.mjs`) y correr `bash casos/<caso>/install.sh` |
| Skill no reconocida | El caso no se instaló | `bash casos/<caso>/install.sh` (no `setup/install.sh` — ese es solo el chatbot) |
| `pdftotext: command not found` (Caso 3) | poppler-utils no instalado | `sudo pacman -S poppler` (Arch) / `sudo apt install poppler-utils` (Ubuntu) |
| `python3: command not found` (Caso 4) | Python no instalado | `sudo pacman -S python` / `sudo apt install python3` |

---

## Personalización por audiencia

### Si la audiencia es muy técnica
- Mostrar el contenido de un SKILL.md en vivo y editarlo
- Mostrar cómo el agente toma decisiones viendo los logs del gateway
- Desafío extra: crear una skill nueva desde cero

### Si la audiencia es mixta (técnicos + no técnicos)
- Enfocarse en los casos 1 y 2 (más visuales, menos setup)
- El vault dashboard es clave para los no técnicos — les muestra que "algo está pasando"
- Pasar el caso 4 como opcional al final

### Si el tiempo es limitado (90 min)
- Solo casos 1 y 2
- Setup grupal: un participante comparte pantalla
- Dejar los otros casos como tarea

---

## Estructura del repositorio

```
taller-agentes-ia/
├── README.md                    # Inicio rápido
├── INSTALL.md                   # Instalación en Linux / Windows / Raspberry Pi
├── TALLER.md                    # Esta guía (para el facilitador)
├── AGENTS.md                    # Instrucciones base del agente (workspace)
├── .env.example                 # Template de variables de entorno
├── config/
│   └── openclaw.json            # Config completa de OpenClaw (plantilla)
├── setup/
│   ├── install.sh               # Instalación global (chatbot base, sin skills)
│   ├── install-case.mjs         # Motor compartido de los instaladores por caso
│   ├── pi-setup.sh              # Todo-en-uno para la Pi del facilitador
│   ├── check.js                 # Verificación del entorno
│   ├── apply-config.mjs         # Aplica config de proveedores al gateway
│   ├── open-dashboard.sh        # Abre el dashboard de OpenClaw con auth
│   └── open-vault.sh            # Arranca relay + vault dashboard
├── skills/                      # Las 4 skills del taller
│   ├── expense-tracker/SKILL.md
│   ├── second-brain/SKILL.md
│   ├── pdf-extractor/SKILL.md
│   └── dev-assistant/SKILL.md
├── casos/                       # Cada caso: guía (README) + instalador (install.sh/.ps1)
│   ├── finanzas/                # Caso 1 — README + install.sh/.ps1
│   ├── second-brain/            # Caso 2
│   ├── pdf-extractor/           # Caso 3 (necesita poppler)
│   └── dev-assistant/           # Caso 4 (necesita python3)
└── demo/
    └── vault/
        ├── index.html           # Vault dashboard (panel visual)
        ├── relay.mjs            # Relay WebSocket → HTTP (datos reales)
        └── package.json         # Dependencia ws para el relay
```

---

## Recursos adicionales

- [Documentación OpenClaw](https://docs.openclaw.ai)
- [ClawHub — Skills y plugins de la comunidad](https://clawhub.ai)
- [OpenRouter — API keys y modelos](https://openrouter.ai)
- [Obsidian — Para el caso Second Brain](https://obsidian.md)
