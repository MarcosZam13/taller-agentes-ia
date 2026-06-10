# Roadmap — Taller Agentes IA

Prioridades ordenadas por impacto en el taller. Cada ítem incluye qué hace falta técnicamente para implementarlo.

---

## Prioridad 1 — Crítico antes del taller

### 1.1 Windows PowerShell install ✅ (este PR)
**Por qué:** La mayoría de los participantes usa Windows. El bash script no corre sin Git Bash o WSL2.  
**Qué se hizo:** `setup/install.ps1` — instalación completa en PowerShell puro (Node via winget, npm prefix, openclaw, skills, relay deps, gateway como Task Scheduler).  
**Cómo probarlo:** En Windows 11, ejecutar `Set-ExecutionPolicy -Scope CurrentUser Bypass; .\setup\install.ps1`

---

### 1.2 Raspberry Pi como servidor permanente ✅ (parcial, ver 1.3)
**Por qué:** Tener la Pi siempre encendida con el gateway y el relay corriendo elimina la necesidad de que el facilitador prepare su laptop antes de cada sesión.  
**Qué falta:**
- [ ] Agregar systemd user service para el relay (igual que el gateway)
- [ ] Script `setup/pi-setup.sh` específico para Pi con Ollama + cloudflared + linger
- [ ] Documentar proceso de actualización remota (git pull + restart services)

**Cómo hacerlo:**
```bash
# En la Pi, crear el servicio del relay
cat > ~/.config/systemd/user/vault-relay.service << 'EOF'
[Unit]
Description=Vault Relay (OpenClaw → HTTP)
After=openclaw-gateway.service
Requires=openclaw-gateway.service

[Service]
Type=simple
WorkingDirectory=%h/taller-agentes-ia/demo/vault
ExecStart=/usr/bin/node relay.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now vault-relay.service
sudo loginctl enable-linger $USER   # para que arranque sin login
```

---

### 1.3 Cloudflare Tunnel para el relay (Pi → mundo) 🔲
**Por qué:** Permite que cualquiera con el link vea el vault en tiempo real desde cualquier dispositivo, sin estar en la misma red.  
**Arquitectura:**
```
Pi local:
  openclaw gateway :18789 (solo loopback)
  relay.mjs :3001 (solo loopback)
          ↓
Cloudflare Tunnel
  https://vault.TU_DOMINIO.com → localhost:3001
          ↓
Vault en Vercel / cualquier navegador
  Polling a https://vault.TU_DOMINIO.com/events
```

**Qué falta:**
- [ ] Cuenta en Cloudflare (gratis), crear tunnel permanente con `cloudflared tunnel create taller-vault`
- [ ] Agregar autenticación al relay HTTP (Bearer token) para que el endpoint público no sea accesible sin credenciales
- [ ] Documentar el proceso completo en INSTALL.md sección Pi

**Implementación del Bearer token en relay.mjs:**
```js
// En el HTTP server del relay, antes de responder:
const RELAY_TOKEN = process.env.RELAY_TOKEN || "";
if (RELAY_TOKEN) {
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${RELAY_TOKEN}`) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
}
```

**Cómo iniciar:**
```bash
# Tunnel temporal (sin cuenta, 24h — suficiente para un taller)
cloudflared tunnel --url http://localhost:3001

# Tunnel permanente (con cuenta de Cloudflare)
cloudflared tunnel create taller-vault
cloudflared tunnel route dns taller-vault vault.TU_DOMINIO.com
cloudflared tunnel run taller-vault
```

---

### 1.4 Vault en Vercel ✅ (este PR)
**Por qué:** Que el vault sea una URL pública fija (ej. `https://taller-vault.vercel.app`) en lugar de un archivo local. Cualquier participante puede abrirlo en su celular durante el taller.  
**Cómo usarlo:**
```
https://taller-vault.vercel.app/#relay=https://vault.TU_DOMINIO.com
```
El parámetro `#relay=URL` le dice al vault dónde está el relay. Si no hay parámetro, usa `localhost:3001` (modo local).

**Qué se hizo:** `vercel.json` + vault acepta `#relay=URL` en el hash.

**Deploy:**
```bash
# Desde la raíz del repo, una sola vez
npx vercel --prod
# O conectar el repo a Vercel para deploy automático en cada push
```

---

## Prioridad 2 — Mejora significativa del taller

### 2.1 Chat directo en el vault 🔲
**Por qué:** Los participantes pueden ver Y hablar con los agentes desde el mismo panel visual. Convierte el vault de observador a herramienta.  
**Qué hacer:** Agregar un input de texto en el sidebar o en el modal de cada cuarto. Al enviar, hacer POST al relay que lo reenvía al gateway via WS (`req("chat.send", { agentId, content })`).  
**Impacto en el taller:** Demo de apertura mucho más poderosa — podés pasar el control al público y que alguien del taller envíe un mensaje desde su celular.

---

### 2.2 Historial completo de conversación por cuarto 🔲
**Por qué:** El sidebar actual muestra snippets de 58 chars. No se puede leer la respuesta completa del agente.  
**Qué hacer:** Al hacer click en un cuarto, mostrar el historial completo de mensajes (scrollable) en el modal, en lugar de solo el estado. Leer de `state.events` filtrado por `agentId`.

---

### 2.3 Skills visibles en cada cuarto 🔲
**Por qué:** Refuerza la enseñanza de que cada cuarto es un agente distinto con skills distintas.  
**Qué hacer:** El relay ya pide `agents.list` y guarda `a.skills`. Mostrar esas skills en la card del cuarto (badge pequeño debajo del nombre).

---

### 2.4 Botón "Demo guiada" 🔲
**Por qué:** Para la demo de apertura, el facilitador podría presionar un botón y que el vault ejecute automáticamente una secuencia de mensajes pre-guionados (uno por cuarto).  
**Qué hacer:** Array de `{ agentId, message, delay }` que se disparan en secuencia con `setTimeout`. El relay los envía al gateway vía WS.

---

## Prioridad 3 — Pulido y robustez

### 3.1 Nombre del bot de Telegram en el HUD 🔲
El relay ya puede leer el bot username de la config. Mostrarlo en el sidebar en lugar del texto hardcodeado "activo".

### 3.2 QR code en el vault 🔲
Un QR con la URL del repo (o del vault en Vercel) visible en la esquina del dashboard. Los participantes lo escanean con el celular para clonar o ver el vault en su dispositivo.

### 3.3 Modo presentación 🔲
Un botón que oculta los controles y maximiza el grid de cuartos para proyectar limpio en pantalla grande.

### 3.4 Script `setup/check-all.sh` para la Pi 🔲
Verifica en un solo comando: gateway activo, relay activo, Cloudflare tunnel activo, Telegram respondiendo, Ollama disponible (si aplica). Para el facilitador antes de empezar el taller.

### 3.5 GitHub Actions para testear install.sh 🔲
Correr el script de instalación en un runner de Ubuntu/Raspberry Pi OS limpio para detectar roturas antes del taller.

---

## Arquitectura objetivo (Pi siempre encendida)

```
┌─────────────────────────────────────────┐
│         Raspberry Pi (siempre on)       │
│                                         │
│  openclaw-gateway.service  :18789       │
│  vault-relay.service       :3001        │
│  cloudflared tunnel → :3001             │
│  ollama (modelo local)     :11434       │
└─────────────────────────────────────────┘
           ↓ Cloudflare Tunnel
    https://vault.TU_DOMINIO.com
           ↓
┌─────────────────────────────────────────┐
│        Vercel (static, gratis)          │
│  taller-vault.vercel.app                │
│  Vault dashboard                        │
│  → polling a vault.TU_DOMINIO.com       │
└─────────────────────────────────────────┘
           ↓ QR code en el taller
    📱 Cada participante ve el vault en su celular
```

**Flujo de la demo de apertura:**
1. Facilitador muestra en pantalla: `https://taller-vault.vercel.app/#relay=https://vault.TU_DOMINIO.com`
2. Todos escanean el QR → ven el vault en su celular
3. Facilitador escribe desde Telegram: `gasté 8500 en el almuerzo`
4. 30 personas ven el cuarto FINANZAS encenderse en tiempo real en su propio dispositivo
5. Silencio en la sala. Punto demostrado.
