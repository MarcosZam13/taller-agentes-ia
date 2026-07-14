# Guía del participante — Instalá tu agente paso a paso

Al terminar esta guía vas a tener **tu propio agente de IA corriendo en tu
computadora**, respondiéndote por Telegram con un modelo de OpenRouter (gpt-4o-mini).

⏱️ **Tiempo:** 15–20 minutos
💻 **Sirve para:** Windows y Linux
🌐 **El agente corre en tu máquina.** No montás servidores ni dominios; solo el
modelo de IA vive en la nube (OpenRouter) y se consulta por API.

---

## Antes de empezar — conseguí estas 3 cosas

Tené estos datos a mano **antes** de instalar. Son gratis y tardan ~5 minutos en total.

| Qué | Dónde | Cómo |
|---|---|---|
| 🔑 **API key de OpenRouter** | la comparte el facilitador | En el taller usás la **key compartida** que te pasa el facilitador (empieza con `sk-or-...`). ¿Querés una propia? [openrouter.ai](https://openrouter.ai) → **Keys** → *Create Key* |
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
OPENROUTER_API_KEY=sk-or-tu_clave_aqui
TELEGRAM_BOT_TOKEN=1234:AAtu_token_aqui
TELEGRAM_ALLOWED_USER_ID=tu_id_numerico
```

Guardá con `Ctrl+O`, `Enter`, y salí con `Ctrl+X`.

> Las demás líneas del archivo (Groq, Azure) **dejalas vacías** — no las necesitás.

### Paso 5 — Instalar y arrancar

```bash
bash setup/install.sh
```

El script instala OpenClaw, configura OpenRouter (gpt-4o-mini) y arranca el
gateway. Esperá a que diga **"Instalación completa"**. Al terminar tenés un
**chatbot pelado**: responde por Telegram pero todavía no *hace* nada — no tiene
herramientas. Eso lo agregás en el paso del caso (más abajo).

### Paso 6 — Verificar que todo funciona

```bash
node setup/check.js
```

Fijate que **no haya nada en rojo** (❌). Los avisos en **amarillo** (⚠️) son
normales: por ejemplo, los casos que todavía no activaste aparecen como *"no en
workspace"* y se ponen en verde cuando instalés tu caso (más abajo). Si algo sale
en **rojo**, mirá la sección [Si algo falla](#-si-algo-falla).

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
OPENROUTER_API_KEY=sk-or-tu_clave_aqui
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

Sin nada en **rojo** = listo (los avisos amarillos de casos *"no en workspace"*
son normales hasta que actives tu caso). ➡️ **Abrí Telegram, buscá tu bot y escribile.** 🎉

> **¿Preferís WSL2?** Si ya tenés WSL2 con Ubuntu, abrilo y seguí directamente
> los pasos de **Linux** — es idéntico y suele dar menos problemas.

---

## 🎯 Activá tu caso (darle una herramienta al agente)

Hasta acá tenés un **chatbot**: conversa, pero no ejecuta acciones. Ahora elegís
**un** caso y le das una herramienta real. Desde la carpeta del proyecto —en
Windows, la **misma Git Bash** que usaste para instalar— corré **solo uno**:

```bash
bash casos/finanzas/install.sh        # registrar gastos en un archivo
bash casos/second-brain/install.sh    # guardar y buscar notas (segundo cerebro)
bash casos/pdf-extractor/install.sh   # leer y extraer datos de PDFs
bash casos/dev-assistant/install.sh   # ejecutar código Python de verdad
```

> 🪟 **Windows sin Git Bash:** si preferís PowerShell puro, cada caso tiene su
> equivalente `.ps1`. Ej.: `.\casos\finanzas\install.ps1`

Cada instalador copia la skill del caso, la registra en tu agente y ajusta las
reglas para que el agente **ejecute la herramienta** en vez de solo responder texto.
Algunos avisan si falta un programa (`pdf-extractor` necesita `poppler`/`pdftotext`,
`dev-assistant` necesita `python3`).

➡️ **Volvé a Telegram y probá tu caso.** Ahora vas a ver la diferencia: el chatbot
*decía* cosas, el agente **las hace**.

---

## ✅ Si todo salió bien

- Tu bot de Telegram responde a tus mensajes.
- `node setup/check.js` muestra todo en verde.
- El agente corre **en tu computadora**, usando la clave de OpenRouter.
- Después de instalar tu caso, el agente **ejecuta la herramienta** (registra un
  gasto, guarda una nota, extrae un PDF o corre código) — no solo responde texto.

---

## 🔧 Si algo falla

| Problema | Causa | Solución |
|---|---|---|
| `command not found: openclaw` | El PATH no se actualizó | Cerrá y reabrí la terminal, o corré `source ~/.bashrc` |
| `EACCES permission denied` al instalar | npm prefix sin configurar | Repetí el paso de "npm sin sudo" / "npm prefix" |
| `node: command not found` | Node no quedó en el PATH | Cerrá y reabrí la terminal; en Windows reinstalá Node marcando "Add to PATH" |
| El bot no responde en Telegram | Token o ID mal copiados | Revisá el `.env`: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_ALLOWED_USER_ID`. Luego `node setup/apply-config.mjs` y reintentá |
| `check.js` marca el proveedor en rojo | `OPENROUTER_API_KEY` vacía o inválida | Revisá que la clave en `.env` empiece con `sk-or-` y no tenga espacios |
| El agente responde solo texto / no ejecuta | No activaste el caso, o lo activaste antes de configurar bien | Corré el instalador del caso (`bash casos/<caso>/install.sh`) y volvé a probar |
| Responde con un JSON crudo en vez de actuar | El modelo activo no es gpt-4o-mini | Revisá que uses OpenRouter (no Groq/Llama); corré `node setup/apply-config.mjs` |
| Error `429` (rate limit) | Demasiados mensajes seguidos | Esperá ~60 segundos y reintentá |
| `bash: command not found` (Windows) | No estás en Git Bash | Abrí **Git Bash**, no PowerShell, para correr los `bash setup/...` |

Después de editar el `.env`, aplicá los cambios sin reinstalar:

```bash
node setup/apply-config.mjs
```

¿Seguís trabado? Avisale al facilitador con una captura del error.

---

## 🚀 Siguiente paso: hacé el tuyo

Ya instalaste los casos hechos. Ahora aprendé a **construir los tuyos**: darles
personalidad, herramientas y crear tus propias skills. Todo está, con ejercicios, en la
[**Guía para crear agentes**](GUIA-CREAR-AGENTES.md).
