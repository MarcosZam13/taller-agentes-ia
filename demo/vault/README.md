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
  relay.mjs (Node.js)   ← se autentica como operador
        ↓ HTTP CORS
  localhost:3001/events  ← polling cada 3s
        ↓
  index.html (dashboard) ← muestra datos en vivo
```

El relay resuelve el problema de CORS: el dashboard abierto como `file://` no puede conectarse directamente al WebSocket del gateway. El relay conecta desde Node.js (sin restricción de origen) y expone un endpoint HTTP con CORS abierto.

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

## Troubleshooting

| Problema | Solución |
|---|---|
| Dashboard muestra OFFLINE | Verificar que el relay corre: `curl localhost:3001/events` |
| Relay no conecta al gateway | `node setup/check.js` — verificar que el gateway responde |
| `ws no instalado` | `cd demo/vault && npm install` |
| Puerto 3001 ocupado | `kill $(lsof -ti:3001)` luego `node relay.mjs` |
| Cuartos no se activan | Enviar un mensaje al agente — verificar con `curl localhost:3001/events` |
