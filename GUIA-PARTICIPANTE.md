# Guía del participante — Instalá tu agente paso a paso

Al terminar esta guía vas a tener **tu propio agente de IA corriendo en tu
computadora**, respondiéndote por Telegram con un modelo de Groq.

⏱️ **Tiempo:** 15–20 minutos
💻 **Sirve para:** Windows y Linux
🌐 **Todo corre local en tu máquina.** No necesitás servidores, dominios ni nada en la nube.

---

## Antes de empezar — conseguí estas 3 cosas

Tené estos datos a mano **antes** de instalar. Son gratis y tardan ~5 minutos en total.

| Qué | Dónde | Cómo |
|---|---|---|
| 🔑 **API key de Groq** | [console.groq.com](https://console.groq.com) | Registrate → **API Keys** → *Create API Key* → copiá el `gsk_...` |
| 🤖 **Bot de Telegram** | [@BotFather](https://t.me/BotFather) | Escribile `/newbot` → seguí los pasos → te da un **token** `1234:AAA...` |
| 🆔 **Tu ID de Telegram** | [@userinfobot](https://t.me/userinfobot) | Mandale cualquier mensaje → te devuelve tu **ID numérico** |

> 💡 Guardá los tres valores en un bloc de notas temporal. Los vas a pegar en un archivo `.env` más adelante.

---

## 🐧 Linux (Ubuntu / Debian / Arch / CachyOS)

### Paso 1 — Instalar Node.js 22

```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc        # si usás zsh: source ~/.zshrc
fnm install 22
fnm use 22
fnm default 22

node --version          # debe mostrar v22.x.x o superior
```

### Paso 2 — Configurar npm sin sudo

Esto evita el error `EACCES` al instalar.

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc        # si usás zsh: usá ~/.zshrc en ambas líneas
```

### Paso 3 — Descargar el proyecto

```bash
git clone https://github.com/MarcosZam13/taller-agentes-ia.git
cd taller-agentes-ia
```

### Paso 4 — Poner tus credenciales

```bash
cp .env.example .env
nano .env
```

Completá **solo estas tres líneas** con los datos que conseguiste al principio:

```env
GROQ_API_KEY=gsk_tu_clave_aqui
TELEGRAM_BOT_TOKEN=1234:AAtu_token_aqui
TELEGRAM_ALLOWED_USER_ID=tu_id_numerico
```

Guardá con `Ctrl+O`, `Enter`, y salí con `Ctrl+X`.

> Las demás líneas del archivo (OpenRouter, Azure) **dejalas vacías** — no las necesitás.

### Paso 5 — Instalar y arrancar

```bash
bash setup/install.sh
```

El script instala OpenClaw, configura Groq, instala las skills y arranca el
gateway. Esperá a que diga **"Instalación completa"**.

### Paso 6 — Verificar que todo funciona

```bash
node setup/check.js
```

Tiene que mostrar **todo en verde**. Si algo sale en rojo, mirá la sección
[Si algo falla](#-si-algo-falla) más abajo.

➡️ **Ahora abrí Telegram, buscá tu bot y mandale un mensaje.** Debería responderte. 🎉

---

## 🪟 Windows

En Windows necesitás **Git Bash** para correr los scripts. La forma más simple:

### Paso 1 — Instalar Node.js 22

1. Descargá el instalador desde [nodejs.org](https://nodejs.org) → versión **LTS (22.x)**.
2. Durante la instalación, dejá marcada la opción **"Add to PATH"**.
3. Verificá abriendo **PowerShell**:

```powershell
node --version
```

### Paso 2 — Instalar Git (incluye Git Bash)

Descargá e instalá [Git for Windows](https://gitforwindows.org). Con valores por
defecto está bien. Esto te da **Git Bash**, la terminal que vas a usar de acá en adelante.

### Paso 3 — Configurar npm sin errores de permisos

Abrí **PowerShell** (usuario normal, no administrador):

```powershell
$npmGlobal = "$env:USERPROFILE\.npm-global"
New-Item -ItemType Directory -Force -Path $npmGlobal
npm config set prefix $npmGlobal
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
[Environment]::SetEnvironmentVariable("PATH", "$currentPath;$npmGlobal\bin", "User")
```

**Cerrá PowerShell** para que el cambio tome efecto.

### Paso 4 — Descargar el proyecto

Abrí **Git Bash** (botón derecho en una carpeta → *Git Bash Here*, o desde el menú inicio):

```bash
git clone https://github.com/MarcosZam13/taller-agentes-ia.git
cd taller-agentes-ia
```

### Paso 5 — Poner tus credenciales

```bash
cp .env.example .env
notepad .env
```

Se abre el Bloc de notas. Completá **solo estas tres líneas**:

```env
GROQ_API_KEY=gsk_tu_clave_aqui
TELEGRAM_BOT_TOKEN=1234:AAtu_token_aqui
TELEGRAM_ALLOWED_USER_ID=tu_id_numerico
```

Guardá (`Ctrl+S`) y cerrá el Bloc de notas. Las demás líneas dejalas vacías.

### Paso 6 — Instalar y arrancar

En **Git Bash**, dentro de la carpeta del proyecto:

```bash
bash setup/install.sh
```

Esperá a que diga **"Instalación completa"**.

### Paso 7 — Verificar que funciona

```bash
node setup/check.js
```

Todo en verde = listo. ➡️ **Abrí Telegram, buscá tu bot y escribile.** 🎉

> **¿Preferís WSL2?** Si ya tenés WSL2 con Ubuntu, abrilo y seguí directamente
> los pasos de **Linux** — es idéntico y suele dar menos problemas.

---

## ✅ Si todo salió bien

- Tu bot de Telegram responde a tus mensajes.
- `node setup/check.js` muestra todo en verde.
- El agente corre **en tu computadora**, usando tu propia clave de Groq.

Probá pedirle cosas distintas para ver las **skills** instaladas (gastos,
segundo cerebro, extraer PDFs, asistente de desarrollo).

---

## 🔧 Si algo falla

| Problema | Causa | Solución |
|---|---|---|
| `command not found: openclaw` | El PATH no se actualizó | Cerrá y reabrí la terminal, o corré `source ~/.bashrc` |
| `EACCES permission denied` al instalar | npm prefix sin configurar | Repetí el paso de "npm sin sudo" / "npm prefix" |
| `node: command not found` | Node no quedó en el PATH | Cerrá y reabrí la terminal; en Windows reinstalá Node marcando "Add to PATH" |
| El bot no responde en Telegram | Token o ID mal copiados | Revisá el `.env`: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_ALLOWED_USER_ID`. Luego `node setup/apply-config.mjs` y reintentá |
| `check.js` marca el proveedor en rojo | `GROQ_API_KEY` vacía o inválida | Revisá que la clave en `.env` empiece con `gsk_` y no tenga espacios |
| Groq responde error `429` | Demasiados mensajes seguidos | Esperá ~60 segundos y reintentá |
| `bash: command not found` (Windows) | No estás en Git Bash | Abrí **Git Bash**, no PowerShell, para correr los `bash setup/...` |

Después de editar el `.env`, aplicá los cambios sin reinstalar:

```bash
node setup/apply-config.mjs
```

¿Seguís trabado? Avisale al facilitador con una captura del error.
