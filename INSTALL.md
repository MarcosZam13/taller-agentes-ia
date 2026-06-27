# Guía de instalación — 4 plataformas

## Prerequisitos comunes (todos los sistemas)

Antes de empezar necesitás tener:

- [ ] **API key de Groq** — gratis en [console.groq.com](https://console.groq.com) → API Keys (2 min)
- [ ] **Bot de Telegram** — crear con [@BotFather](https://t.me/BotFather) → `/newbot` (opcional)
- [ ] **Tu ID de Telegram** — mandar cualquier mensaje a [@userinfobot](https://t.me/userinfobot) (opcional)
- [ ] **OpenRouter key** (opcional, fallback) — [openrouter.ai](https://openrouter.ai)

---

## Linux (CachyOS / Arch / Ubuntu / Debian)

**Tiempo estimado: 10 minutos**

### 1. Instalar Node.js 22+

```bash
# Opción A: fnm (recomendado, sin sudo)
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc   # o ~/.zshrc
fnm install 22
fnm use 22

# Opción B: si ya tenés nvm
nvm install 22 && nvm use 22

# Verificar
node --version   # debe ser v22.x.x o superior
```

### 2. Configurar npm sin sudo (IMPORTANTE en Linux)

```bash
# Evita el error EACCES al instalar paquetes globales
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> **Nota:** En CachyOS/Arch este paso ya está hecho si seguiste el setup inicial.

### 3. Clonar e instalar

```bash
git clone https://github.com/TU-USUARIO/taller-agentes-ia.git
cd taller-agentes-ia
cp .env.example .env
nano .env   # completar GROQ_API_KEY y Telegram (ver abajo)
bash setup/install.sh
```

### 4. Completar el .env

```env
GROQ_API_KEY=gsk_...          # de groq.com
TELEGRAM_BOT_TOKEN=1234:AAA...  # de @BotFather
TELEGRAM_ALLOWED_USER_ID=123456789  # de @userinfobot
OPENROUTER_API_KEY=sk-or-v1-...  # opcional, fallback
```

### 5. Verificar y abrir

```bash
node setup/check.js          # debe mostrar todo verde
bash setup/open-dashboard.sh # abre el dashboard con auth correcto
```

### Comandos útiles en Linux

```bash
# Ver estado del gateway
systemctl --user status openclaw-gateway.service

# Ver logs en tiempo real
journalctl --user -u openclaw-gateway.service -f

# Reiniciar después de cambios de config
systemctl --user restart openclaw-gateway.service

# Aplicar nueva configuración (después de editar .env)
node setup/apply-config.mjs
```

---

## Windows 11

**Tiempo estimado: 15 minutos**

### 1. Instalar Node.js 22+

Descargar el instalador desde [nodejs.org](https://nodejs.org) → versión LTS (22.x).
Asegurarse de marcar "Add to PATH" durante la instalación.

```powershell
# Verificar en PowerShell
node --version
npm --version
```

### 2. Configurar npm prefix (evita errores de permisos)

```powershell
# En PowerShell como usuario normal (no admin)
$npmGlobal = "$env:USERPROFILE\.npm-global"
New-Item -ItemType Directory -Force -Path $npmGlobal
npm config set prefix $npmGlobal

# Agregar al PATH permanentemente
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
[Environment]::SetEnvironmentVariable("PATH", "$currentPath;$npmGlobal\bin", "User")

# Cerrar y volver a abrir PowerShell para que tome efecto
```

### 3. Clonar e instalar

```powershell
git clone https://github.com/TU-USUARIO/taller-agentes-ia.git
cd taller-agentes-ia
Copy-Item .env.example .env
notepad .env   # completar credenciales
bash setup/install.sh   # requiere Git Bash o WSL
```

> **Si no tenés Git Bash:** instalar [Git for Windows](https://gitforwindows.org) que incluye Git Bash.
> Alternativamente usar **WSL2** (recomendado para desarrollo en Windows).

### Con WSL2 (recomendado)

Si ya tenés WSL2 con Ubuntu, seguir exactamente los pasos de Linux arriba.

```powershell
# Instalar WSL2 si no está
wsl --install
# Luego abrir Ubuntu desde el menú inicio y seguir los pasos de Linux
```

### 4. Abrir el dashboard en Windows

El gateway corre en `localhost:18789`. El script `open-dashboard.sh` requiere Git Bash:

```bash
# En Git Bash
bash setup/open-dashboard.sh
```

O construir la URL manualmente:

```powershell
# En PowerShell
$config = Get-Content "$env:USERPROFILE\.openclaw\openclaw.json" | ConvertFrom-Json
$token = $config.gateway.auth.token
Start-Process "http://127.0.0.1:18789/#token=$token"
```

### Servicio en Windows

OpenClaw usa Task Scheduler en Windows (equivalente a systemd):

```bash
# Instalar como tarea programada
openclaw gateway install

# Iniciar / detener
openclaw gateway start
openclaw gateway stop

# Ver estado
openclaw gateway status
```

---

## Raspberry Pi (Raspbian / Raspberry Pi OS)

**Tiempo estimado: 20 minutos**
**Hardware mínimo: Raspberry Pi 4 con 2GB RAM**

### 1. Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Node.js 22 (vía fnm — más fácil que apt)

```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 22
fnm use 22
fnm default 22   # para que persista entre reinicios

# Verificar
node --version
```

> **Nota:** El repositorio oficial de apt tiene versiones viejas de Node. Usar fnm o nodesource.

### 3. Configurar npm prefix

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 4. Instalar OpenClaw

```bash
npm install -g openclaw@latest

# Verificar
openclaw --version
```

### 5. Clonar e instalar

> **Antes de clonar:** subí este repo a tu propia cuenta de GitHub y reemplazá
> `TU-USUARIO` por tu usuario. Si el repo es privado, configurá una credencial
> (token o SSH key) en la Pi para que el `git clone` y los `git pull` funcionen.

```bash
git clone https://github.com/TU-USUARIO/taller-agentes-ia.git
cd taller-agentes-ia
cp .env.example .env
nano .env   # completar credenciales
bash setup/install.sh
```

### 6. Configurar inicio automático con systemd

```bash
# El install.sh ya lo hace, pero si falla manualmente:
openclaw gateway install
systemctl --user enable openclaw-gateway.service
systemctl --user start openclaw-gateway.service

# Para que los servicios de usuario arranquen sin login:
sudo loginctl enable-linger $USER
```

### 7. (Opcional) Ollama para IA local sin internet

Esto es para la **demo "IA en hardware propio"** del bloque 1 del taller:

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Descargar un modelo liviano (1.9GB — funciona en Pi 4 2GB+)
ollama pull llama3.2:3b

# Verificar que responde
ollama run llama3.2:3b "Hola, ¿cómo estás?"

# Agregar al .env para usar como proveedor local
echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env
```

Para conectar Ollama a OpenClaw, agregar en `.env`:
```env
# Ollama es compatible con la API de OpenAI
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Y ejecutar `node setup/apply-config.mjs` — el script lo detecta automáticamente.

### Acceder al dashboard desde otra máquina (red local)

Por defecto el gateway escucha solo en `127.0.0.1`. Para acceder desde otras laptops en la misma red durante el taller:

```bash
# Opción A: cambiar bind a LAN (temporal, para demo)
openclaw config set gateway.bind lan
systemctl --user restart openclaw-gateway.service

# La URL sería: http://<IP-DE-LA-PI>:18789
hostname -I  # para ver la IP
```

> **Seguridad:** solo hacer esto en una red de confianza (la del taller). Revertir con `openclaw config set gateway.bind loopback` al terminar.

### Cloudflare Tunnel (para acceso remoto seguro)

Para la demo de apertura del taller donde mostrás el agente corriendo en Costa Rica:

```bash
# Instalar cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Tunnel temporal (sin cuenta, expira en 24h — suficiente para el taller)
cloudflared tunnel --url http://localhost:18789

# Devuelve una URL tipo: https://random-words.trycloudflare.com
# Esa URL + #token=XXX es accesible desde cualquier lugar del mundo
```

---

## Tabla de diferencias entre plataformas

| | Linux | Windows | Raspberry Pi |
|---|---|---|---|
| Servicio en background | systemd user service | Task Scheduler | systemd user service |
| Nombre del servicio | `openclaw-gateway.service` | `OpenClaw Gateway` | `openclaw-gateway.service` |
| Config en | `~/.openclaw/` | `%USERPROFILE%\.openclaw\` | `~/.openclaw/` |
| Logs | `journalctl --user -u openclaw-gateway.service` | `openclaw gateway status` | `journalctl --user -u openclaw-gateway.service` |
| Dashboard helper | `bash setup/open-dashboard.sh` | PowerShell (ver arriba) | `bash setup/open-dashboard.sh` |
| npm prefix | `~/.npm-global` | `%USERPROFILE%\.npm-global` | `~/.npm-global` |
| IA local | Ollama (cualquier modelo) | Ollama (cualquier modelo) | Ollama (`llama3.2:3b`) |

---

---

## Raspberry Pi como servidor permanente del taller

La Pi puede correr el gateway, el relay y Cloudflare Tunnel las 24 horas, eliminando la necesidad de preparar una laptop antes de cada sesión. El vault se sirve desde Vercel y se conecta al relay de la Pi vía Cloudflare.

### Arquitectura

```
Pi (siempre encendida)
  openclaw-gateway  :18789  (systemd)
  vault-relay       :3001   (systemd)
  cloudflared               (systemd)
        ↓
  https://vault.TU_DOMINIO.com  (Cloudflare Tunnel)
        ↓
  https://taller-vault.vercel.app/#relay=https://vault.TU_DOMINIO.com
        ↓  (QR en el taller)
  📱 Todos los participantes ven el vault en su celular
```

### Setup inicial en la Pi (una sola vez)

```bash
# 1. Seguir los pasos de Linux de arriba hasta que check.js esté verde

# 2. Instalar cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# 3. Crear tunnel permanente (requiere cuenta en cloudflare.com, gratis)
cloudflared tunnel login
cloudflared tunnel create taller-vault
cloudflared tunnel route dns taller-vault vault.TU_DOMINIO.com
# Crear el config del tunnel:
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: <ID_DEL_TUNNEL>
credentials-file: $HOME/.cloudflared/<ID_DEL_TUNNEL>.json
ingress:
  - hostname: vault.TU_DOMINIO.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# 4. Instalar el relay como servicio systemd
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/vault-relay.service << 'EOF'
[Unit]
Description=Vault Relay (OpenClaw → HTTP)
After=openclaw-gateway.service
Requires=openclaw-gateway.service

[Service]
Type=simple
WorkingDirectory=%h/taller-agentes-ia/demo/vault
# Permite que el vault servido desde Vercel lea el relay vía Cloudflare (CORS).
# Sin esta línea el vault público muestra OFFLINE aunque el tunnel funcione.
Environment=VAULT_PUBLIC_ORIGIN=https://taller-vault.vercel.app
ExecStart=/usr/bin/node relay.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now vault-relay.service

# 5. Instalar cloudflared como servicio (como root, para que arranque sin login)
sudo cloudflared service install
sudo systemctl enable --now cloudflared

# 6. Que los servicios de usuario arranquen sin que alguien inicie sesión
sudo loginctl enable-linger $USER
```

### URL del vault para el taller

```
https://taller-vault.vercel.app/#relay=https://vault.TU_DOMINIO.com
```

Generar un QR con esta URL y proyectarlo. Todos pueden abrir el vault en su celular.

### Actualizar el código en la Pi

```bash
cd ~/taller-agentes-ia
git pull
node setup/apply-config.mjs
systemctl --user restart vault-relay.service
systemctl --user restart openclaw-gateway.service
```

### Verificar que todo esté activo antes del taller

```bash
systemctl --user status openclaw-gateway.service
systemctl --user status vault-relay.service
sudo systemctl status cloudflared
curl https://vault.TU_DOMINIO.com/events   # debe devolver JSON con connected:true
```

---

## Troubleshooting rápido

| Problema | Causa probable | Solución |
|---|---|---|
| `EACCES permission denied` al instalar openclaw | npm prefix no configurado | `npm config set prefix ~/.npm-global` |
| Gateway no inicia | Puerto 18789 ocupado | `openclaw gateway run --force` |
| Dashboard muestra error de auth | URL sin `#token=` | Usar `bash setup/open-dashboard.sh` |
| Bot no responde en Telegram | Gateway caído o token inválido | `node setup/check.js` |
| `openclaw: command not found` | PATH no actualizado | `source ~/.bashrc` o reiniciar terminal |
| Groq da 429 (rate limit) | Demasiadas requests seguidas | Esperar 60s o cambiar a OpenRouter |
| Vault en Vercel muestra OFFLINE | Relay no accesible **o** CORS sin el origen de Vercel | 1) `systemctl --user status vault-relay.service` y el tunnel; 2) confirmar que el service tiene `Environment=VAULT_PUBLIC_ORIGIN=https://taller-vault.vercel.app` (ver logs: `journalctl --user -u vault-relay.service` debe mostrar "Origen público permitido para CORS") |
