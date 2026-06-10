# Taller de Agentes IA con OpenClaw

Repositorio del taller dictado en El Salvador, julio 2026.
Construimos 4 agentes reales usando [OpenClaw](https://docs.openclaw.ai) y Azure OpenAI.

## Plataformas probadas

| Plataforma | Estado |
|---|---|
| CachyOS (Arch Linux) | ✅ Principal |
| Raspberry Pi (Raspbian) | 🔄 En progreso |
| Windows 11 | 🔄 En progreso |

---

## Setup inicial

**Tiempo total estimado: 15–20 minutos**

| Paso | Tiempo | Descripción |
|---|---|---|
| 1. Clonar repo | 1 min | `git clone` del repo |
| 2. Copiar `.env` | 3 min | Completar credenciales Azure |
| 3. Instalar OpenClaw | 5 min | `bash setup/install.sh` |
| 4. Verificar entorno | 2 min | `node setup/check.js` |
| 5. Abrir dashboard | 1 min | `xdg-open http://127.0.0.1:18789` |

### Comandos rápidos

```bash
# 1. Clonar
git clone https://github.com/TU-USUARIO/taller-agentes-ia.git
cd taller-agentes-ia

# 2. Configurar credenciales
cp .env.example .env
nano .env   # completar AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_API_KEY

# 3. Instalar
bash setup/install.sh

# 4. Verificar
node setup/check.js

# 5. Dashboard
xdg-open http://127.0.0.1:18789
```

---

## Casos de uso

### Caso 1 — Finanzas Personales ✅
**Tiempo:** 25–35 min | `casos/finanzas/README.md`

Rastreador de gastos en colones costarricenses (₡ CRC). Registro por lenguaje natural, resúmenes por categoría, presupuestos mensuales.

**Skill:** `expense-tracker`  
**Lo que aprendés:** Skills custom, almacenamiento de datos, ciclos de confirmación

### Caso 2 — Automatización de tareas (próximamente)
**Tiempo estimado:** 30–40 min

### Caso 3 — Asistente educativo (próximamente)
**Tiempo estimado:** 30–40 min

### Caso 4 — Agente de productividad (próximamente)
**Tiempo estimado:** 40–50 min

---

## Estructura del repo

```
taller-agentes-ia/
├── README.md               # Este archivo
├── AGENTS.md               # Instrucciones base del agente (copiar a workspace)
├── .env.example            # Template de variables de entorno
├── config/
│   └── openclaw.json       # Config de OpenClaw (install.sh la copia a ~/.openclaw/)
├── setup/
│   ├── install.sh          # Instalación completa en Linux
│   └── check.js            # Verificación del entorno
├── skills/
│   └── expense-tracker/    # Skill para caso 1 - finanzas
│       └── SKILL.md
└── casos/
    └── finanzas/
        └── README.md       # Guía paso a paso del caso 1
```

---

## Decisiones de diseño documentadas

### ¿Por qué `models.providers` en el JSON si la doc dice que no?

La regla "no agregar models.providers manualmente" aplica a proveedores **integrados** (openai, anthropic, google). Azure OpenAI es un endpoint **custom** — requiere definirse en `models.providers` con `baseUrl` y `api: "openai-completions"`. Ver comentarios en `config/openclaw.json`.

### ¿Por qué Azure y no OpenRouter/Anthropic direct?

Azure for Students da acceso gratuito y el endpoint queda bajo tu control. Más fácil para reproducir en un taller sin tarjeta de crédito.

### ¿Por qué systemd user service y no `openclaw gateway start`?

El user service sobrevive reboots y corre sin pantalla. Es el setup recomendado para Linux según la doc (`openclaw onboard --install-daemon`).

### ¿Por qué `~/.npm-global` como prefix?

Evita el error `EACCES: permission denied` al instalar paquetes globales en Linux sin `sudo`. Es la práctica recomendada para instalar herramientas npm en sistemas donde `/usr/local` requiere root.

---

## Acceder al Dashboard (problema conocido)

**Síntoma:** Al abrir `http://127.0.0.1:18789` aparece "La autenticación no coincide" en rojo.

**Causa:** El dashboard necesita el token embedido en la URL como fragmento `#token=XXX`. Sin él siempre falla, sin importar qué pongas en el campo "Token de la puerta de enlace".

**Solución — una de estas tres:**

```bash
# Opción 1 (recomendada): script del taller
bash setup/open-dashboard.sh

# Opción 2: comando openclaw (copia URL al clipboard, luego pegar en navegador)
openclaw dashboard --no-open
# → la URL del clipboard tiene formato: http://127.0.0.1:18789/#token=XXX

# Opción 3: construir la URL manualmente
python3 -c "
import json
d = json.load(open('/home/$(whoami)/.openclaw/openclaw.json'))
t = d['gateway']['auth']['token']
print(f'http://127.0.0.1:18789/#token={t}')
"
```

**NUNCA** abrir `http://127.0.0.1:18789` sin el `#token=` al final — siempre va a fallar.

---

## Troubleshooting general

```bash
# Ver logs del gateway
journalctl --user -u openclaw-gateway.service -f

# Reiniciar gateway
systemctl --user restart openclaw-gateway.service

# Verificar configuración cargada
openclaw config get agents.defaults.model

# Ver skills disponibles
openclaw skills list

# Verificar todo el entorno
node setup/check.js
```

---

## Recursos

- [Documentación OpenClaw](https://docs.openclaw.ai)
- [ClawHub — Skills y plugins](https://clawhub.ai)
- [Azure OpenAI Portal](https://portal.azure.com)
