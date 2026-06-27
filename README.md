# Taller de Agentes IA con OpenClaw

Repositorio del taller dictado en El Salvador, julio 2026.
Construimos 4 agentes reales usando [OpenClaw](https://docs.openclaw.ai) y Groq (Llama 3.1 70B).

## Plataformas probadas

| Plataforma | Estado |
|---|---|
| CachyOS / Arch Linux | ✅ Principal |
| Ubuntu / Debian | ✅ Probado |
| Raspberry Pi 4 (Raspbian) | ✅ Probado |
| Windows 11 (WSL2) | ✅ Probado |

---

## Setup inicial

**Tiempo total estimado: 10–15 minutos**

> 👋 **¿Sos participante del taller?** Seguí la [**Guía del participante**](GUIA-PARTICIPANTE.md):
> instalación local simple para Windows y Linux, paso a paso, sin nada de servidores ni nube.

### Prerequisitos

- **Node.js 22+** — instalar con [fnm](https://github.com/Schniz/fnm): `curl -fsSL https://fnm.vercel.app/install | bash`
- **Groq API key** — gratis en [console.groq.com](https://console.groq.com) → API Keys (2 min)
- **Bot de Telegram** (opcional) — crear con [@BotFather](https://t.me/BotFather)

### Instalación

```bash
# 1. Clonar
git clone https://github.com/MarcosZam13/taller-agentes-ia.git
cd taller-agentes-ia

# 2. Configurar credenciales
cp .env.example .env
nano .env   # completar al menos GROQ_API_KEY

# 3. Instalar todo
bash setup/install.sh

# 4. Verificar
node setup/check.js

# 5. Abrir el vault dashboard (demo visual)
bash setup/open-vault.sh
```

---

## Vault Dashboard

El vault es el panel visual del taller — muestra los 4 agentes en tiempo real con pixel art y datos reales del gateway.

```bash
bash setup/open-vault.sh
```

Proyectalo en la pantalla grande durante la demo de apertura y mientras los participantes trabajan.

---

## Casos de uso

### Caso 1 — Finanzas Personales ✅
**Tiempo:** 25–35 min | [`casos/finanzas/README.md`](casos/finanzas/README.md)

Rastreador de gastos en colones (₡ CRC). Registro por lenguaje natural, resúmenes por categoría, presupuestos mensuales.

**Skill:** `expense-tracker` | **Lo que aprendés:** Skills, lenguaje natural → datos estructurados, ciclos de confirmación

**Frases de prueba:**
```
gasté 8500 en el almuerzo
resumen de mis gastos
quiero un presupuesto de 80000 para comida
```

---

### Caso 2 — Second Brain con Obsidian ✅
**Tiempo:** 25–35 min | [`casos/second-brain/README.md`](casos/second-brain/README.md)

Agente que lee, crea y conecta notas en formato Obsidian desde el chat.

**Skill:** `second-brain` | **Lo que aprendés:** Markdown como backend de IA, grafos de conocimiento, PKM potenciado por chat

**Frases de prueba:**
```
anotar: los LLMs aprenden patrones del lenguaje humano
qué tengo sobre machine learning
conectar esa nota con "Agentes IA"
```

---

### Caso 3 — PDF Extractor ✅
**Tiempo:** 25–35 min | [`casos/pdf-extractor/README.md`](casos/pdf-extractor/README.md)

Extrae datos de PDFs (facturas, contratos, informes) y los estructura como tablas o CSV.

**Skill:** `pdf-extractor` | **Requiere:** `pdftotext` (poppler-utils) | **Lo que aprendés:** pdftotext + LLM como OCR semántico, documentos → datos

**Frases de prueba:**
```
procesar /ruta/a/factura.pdf
extraer la tabla de datos
exportar como CSV
```

---

### Caso 4 — Dev Assistant ✅
**Tiempo:** 25–35 min | [`casos/dev-assistant/README.md`](casos/dev-assistant/README.md)

Asistente de desarrollo que ejecuta código Python de verdad, analiza errores y corre tests.

**Skill:** `dev-assistant` | **Requiere:** Python 3 | **Lo que aprendés:** Agentes que ejecutan acciones reales, ciclo debug→fix→verificar

**Frases de prueba:**
```
ejecutar: print("Hola mundo")
tengo este error: [pegar traceback]
correr los tests en /tmp/mis_tests.py
```

---

## Comandos útiles

```bash
# Estado del gateway
systemctl --user status openclaw-gateway.service

# Ver logs en tiempo real
journalctl --user -u openclaw-gateway.service -f

# Reiniciar después de cambiar .env o config
node setup/apply-config.mjs
systemctl --user restart openclaw-gateway.service

# Vault dashboard (datos reales en vivo)
bash setup/open-vault.sh

# Dashboard de OpenClaw (chat web)
bash setup/open-dashboard.sh

# Verificar todo el entorno
node setup/check.js
```

---

## Estructura del repo

```
taller-agentes-ia/
├── README.md               # Este archivo
├── GUIA-PARTICIPANTE.md    # Guía simple para asistentes (instalación local)
├── INSTALL.md              # Instalación detallada + servidor Pi / Cloudflare / Vercel
├── TALLER.md               # Guía del facilitador con agenda y troubleshooting
├── AGENTS.md               # Instrucciones base del agente (workspace)
├── .env.example            # Template de variables de entorno
├── config/
│   └── openclaw.json       # Config de OpenClaw (plantilla con comentarios)
├── setup/
│   ├── install.sh          # Instalación completa en Linux
│   ├── check.js            # Verificación del entorno
│   ├── apply-config.mjs    # Aplica config de proveedores al gateway
│   ├── setup-memory-ollama.sh # (Opcional) Memoria semántica con embeddings Ollama
│   ├── open-dashboard.sh   # Abre dashboard de OpenClaw con auth correcto
│   └── open-vault.sh       # Arranca relay + vault dashboard
├── skills/
│   ├── expense-tracker/    # Caso 1 — Finanzas
│   ├── second-brain/       # Caso 2 — Second Brain
│   ├── pdf-extractor/      # Caso 3 — PDF Extractor
│   └── dev-assistant/      # Caso 4 — Dev Assistant
├── casos/
│   ├── finanzas/           # Guía paso a paso Caso 1
│   ├── second-brain/       # Guía paso a paso Caso 2
│   ├── pdf-extractor/      # Guía paso a paso Caso 3
│   └── dev-assistant/      # Guía paso a paso Caso 4
└── demo/
    └── vault/              # Panel visual del taller
        ├── index.html      # Dashboard (abrir en navegador)
        ├── relay.mjs       # Relay WebSocket→HTTP
        └── README.md       # Cómo usar el vault
```

---

## Troubleshooting rápido

| Problema | Solución |
|---|---|
| `openclaw: command not found` | `source ~/.bashrc` o reiniciar terminal |
| Gateway no inicia | `journalctl --user -u openclaw-gateway.service -n 30` |
| Vault muestra OFFLINE | `bash setup/open-vault.sh` |
| Bot no responde en Telegram | `node setup/check.js` |
| Groq da error 429 (rate limit) | Esperar 60s — el tier gratuito tiene límites por minuto |
| Dashboard pide token | Usar `bash setup/open-dashboard.sh` en lugar de abrir directo |

Para más detalle: [`INSTALL.md`](INSTALL.md) y [`TALLER.md`](TALLER.md).

---

## Recursos

- [Documentación OpenClaw](https://docs.openclaw.ai)
- [ClawHub — Skills y plugins](https://clawhub.ai)
- [Groq Console — API keys](https://console.groq.com)
- [Guía del facilitador](TALLER.md)
