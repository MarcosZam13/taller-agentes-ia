# Vault Dashboard — Panel visual del taller

Panel de control en tiempo real que muestra los 4 agentes del taller activos, los mensajes que pasan por el gateway y el estado de la conexión.

Se usa como **demo de apertura** del taller: proyectás el vault en la pantalla grande y los participantes ven los agentes reaccionar mientras enviás mensajes desde Telegram.

---

## Inicio rápido

```bash
# Desde la raíz del repo (requiere gateway corriendo)
bash setup/open-vault.sh
```

El script hace todo: verifica el gateway, instala dependencias, arranca el relay y abre el dashboard en el navegador.

---

## Cómo funciona

```
Gateway OpenClaw (WS :18789)
        ↓
  relay.mjs (Node.js)   ← se autentica como DEVICE firmado (Ed25519)
        ↓ HTTP CORS
  localhost:3001/events  ← polling cada 3s
        ↓
  index.html (dashboard) ← muestra datos en vivo
```

El relay resuelve el problema de CORS: el dashboard abierto como `file://` no puede conectarse directamente al WebSocket del gateway. El relay conecta desde Node.js (sin restricción de origen) y expone un endpoint HTTP con CORS abierto.

### Datos reales vs. modo demo

Para ver **actividad real** (agentes y mensajes de verdad, no simulados), el gateway
solo entrega scopes de operador a un cliente que se autentique como un **device
pareado**. El relay reusa la identidad del CLI (`~/.openclaw/identity/device.json`,
Ed25519) y **firma el challenge** del gateway (protocolo 4, `client.id=openclaw-control-ui`,
`mode=ui`) para obtener `operator.read`. Con eso:

- Llama `agents.list` / `sessions.list` (bajo `msg.payload`) y **se suscribe** a
  `sessions.messages.subscribe({key})` de cada sesión para recibir los mensajes en vivo.
- Enruta cada mensaje al cuarto correcto por el **skill** que ejecutó el agente
  (derivado del path del comando, `skills/<skill>/…`), no por palabras sueltas.

Requisito: el device del CLI debe estar pareado con `operator.read` (ocurre por
defecto; `setup/grant-cli-scopes.mjs` lo asegura junto con los scopes de escritura
que necesita el cron). **Si no hay device pareado**, el relay conecta de forma
anónima y el dashboard cae con gracia a **modo demo** (actividad simulada), sin romperse.

Flags útiles: `RELAY_PORT=3002` (probar sin tocar el servicio en 3001) y
`RELAY_DEBUG=1` (volcar los eventos crudos del gateway).

---

## Archivos

| Archivo | Descripción |
|---|---|
| `index.html` | El dashboard — abrirlo en el navegador |
| `relay.mjs` | Relay WS→HTTP — ejecutarlo con `node relay.mjs` |
| `package.json` | Declara la dependencia `ws` para el relay |

---

## Arranque manual (sin el script)

```bash
# Terminal 1: relay
cd demo/vault
npm install          # solo la primera vez
node relay.mjs

# Terminal 2: verificar que el relay funciona
curl http://127.0.0.1:3001/events

# Navegador: abrir el dashboard
xdg-open demo/vault/index.html
```

---

## Lo que muestra el dashboard

**HUD (barra superior):**
- Contador de agentes activos (real, del gateway)
- Total de mensajes procesados (real)
- Uptime del dashboard
- Estado ONLINE/OFFLINE de la conexión

**Grid de cuartos:** 4 cuartos con pixel art, uno por caso del taller:
- FINANZAS (amber) — expense-tracker
- CEREBRO (violeta) — second-brain
- DOCUMENTOS (cyan) — pdf-extractor
- DESARROLLO (lime) — dev-assistant

Cuando llega un mensaje real de un agente, el cuarto correspondiente se anima con efecto de pulso.

**Sidebar:** Feed de transmisiones en vivo — muestra los últimos mensajes con timestamp.

**Barra de log inferior:** Mensajes de estado del sistema en tiempo real.

---

## Modo demo (sin gateway)

Si el gateway no está corriendo, el dashboard activa automáticamente una simulación visual de mensajes falsos cada 9–18 segundos. Sirve para mostrar el efecto visual sin tener los agentes configurados.

La simulación se apaga sola cuando el relay conecta y llegan datos reales.

---

## Producción: Pi + Cloudflare (una sola URL pública)

El relay **también sirve el dashboard** (`/` → `index.html`, `/events` → datos). Así
una sola URL entrega el panel y los datos desde el mismo origen, sin CORS ni `#relay`.

Para dejarlo accesible desde cualquier celular durante el taller, en la Raspberry Pi:

```bash
bash setup/pi-setup.sh
```

Eso instala OpenClaw + los 4 casos, deja el relay como servicio systemd y levanta un
**Cloudflare Tunnel** que expone el dashboard a una URL pública. Dos modos:

- **Túnel rápido** (default, sin cuenta): URL aleatoria `*.trycloudflare.com` que cambia
  al reiniciar.
- **Túnel con dominio** (URL fija): `CF_TUNNEL_TOKEN=eyJ... bash setup/pi-setup.sh`, con
  el hostname público apuntando a `http://localhost:3001` en Cloudflare Zero Trust.

> Vercel solo no alcanza para esto: el navegador necesita llegar al relay de la Pi, que
> está detrás de NAT. El túnel es lo que da la puerta pública. (Si igual querés servir el
> `index.html` desde Vercel, pasale `#relay=<URL-del-túnel>` al abrirlo.)

---

## Troubleshooting

| Problema | Solución |
|---|---|
| Dashboard muestra OFFLINE | Verificar que el relay corre: `curl localhost:3001/events` |
| Relay no conecta al gateway | `node setup/check.js` — verificar que el gateway responde |
| `ws no instalado` | `cd demo/vault && npm install` |
| Puerto 3001 ocupado | `kill $(lsof -ti:3001)` luego `node relay.mjs` |
| Cuartos no se activan | Enviar un mensaje al agente — verificar con `curl localhost:3001/events` |
