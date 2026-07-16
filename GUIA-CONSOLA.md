# Guía: La terminal sin miedo 🖥️

**¿Nunca usaste una "consola" o "terminal"? Empezá por acá.** En 10 minutos vas a
entender lo justo para seguir el taller sin perderte. No necesitás memorizar nada:
la mayoría de los comandos los vas a **copiar y pegar**. Esta guía es para que
entiendas **qué estás haciendo** cuando lo hacés.

> Tranqui: la terminal parece cosa de hackers de película, pero es solo **una forma
> de darle órdenes a la compu escribiendo**, en vez de haciendo clics. Nada se rompe
> por escribir un comando mal — como mucho te da un error y volvés a intentar.

---

## 1. ¿Qué es la terminal?

Es una **ventana donde escribís órdenes** (comandos) y la compu te responde con texto.
Donde normalmente harías clic en botones, acá escribís una línea y apretás **Enter**.

Un **comando** es una orden. Por ejemplo:
```
node --version
```
Eso le pregunta a la compu "¿qué versión de Node tenés?" y te responde algo como
`v22.14.0`. El comando tiene un **nombre** (`node`) y a veces **opciones** o
**argumentos** (`--version`).

---

## 2. Cómo abrir la terminal

### 🪟 Windows — usá **Git Bash**

En el taller **no** usamos la terminal común de Windows (PowerShell), sino **Git Bash**
(viene con Git, que instalás al principio). Para abrirla:

- Andá a la carpeta del proyecto en el Explorador de archivos.
- **Clic derecho** dentro de la carpeta → **"Git Bash Here"** (o "Open Git Bash here").
- Se abre una ventana negra: esa es tu terminal, **ya parada en la carpeta correcta**. ✅

Si no ves esa opción, abrí Git Bash desde el menú Inicio (buscá "Git Bash") y después
te movés a la carpeta con `cd` (ver sección 5).

### 🐧 Linux (Ubuntu / Debian / etc.)

- Atajo: **Ctrl + Alt + T** abre una terminal.
- O buscá **"Terminal"** en el menú de aplicaciones.

---

## 3. Leer "el prompt": ¿dónde estoy parado?

Antes de que escribas, la terminal muestra una línea con información. Ejemplo (Git Bash):

```
Laura@PC MINGW64 ~/Documents/taller-agentes-ia (main)
$
```

- `Laura@PC` → tu usuario y tu compu.
- `~/Documents/taller-agentes-ia` → **la carpeta en la que estás parado ahora** (lo más importante).
- `(main)` → la rama de git (ignoralo por ahora).
- `$` → acá escribís tu comando. Después de este símbolo va tu texto.

> 👉 El dato clave del prompt es **la carpeta**. Muchos comandos solo funcionan si
> estás parado **dentro** de la carpeta correcta (ver sección 6).

---

## 4. Las 3 reglas de oro

1. **Enter ejecuta.** Escribís (o pegás) el comando y recién cuando apretás **Enter** se corre.
2. **Copiar y pegar es distinto que en Word** (¡la trampa más común!):

   | | Copiar | Pegar |
   |---|---|---|
   | **Git Bash (Windows)** | seleccioná el texto con el mouse (se copia solo) o **Ctrl+Insert** | **clic derecho** o **Shift+Insert** |
   | **Terminal de Linux** | **Ctrl+Shift+C** | **Ctrl+Shift+V** |

   > ⚠️ En la terminal, **Ctrl+C NO es "copiar"** — sirve para **cancelar** lo que se está
   > ejecutando. Si apretás Ctrl+C sin querer, no pasa nada grave: solo corta el comando.

3. **Esperá a que "vuelva el prompt".** Un comando terminó cuando volvés a ver la línea
   con el `$` esperándote. Si no aparece, el comando **sigue trabajando** — dale tiempo.

---

## 5. Moverte por las carpetas (y qué es una "ruta")

Una **ruta** (o *path*) es la dirección de un archivo o carpeta, con `/` separando los niveles:
```
/home/laura/Documents/taller-agentes-ia/setup/install.sh
```
Eso se lee: dentro de `home` → `laura` → `Documents` → `taller-agentes-ia` → `setup` → el archivo `install.sh`.

Tres comandos para orientarte:

| Comando | Qué hace |
|---|---|
| `pwd` | **P**rint **W**orking **D**irectory — te dice **en qué carpeta estás** |
| `ls` | **L**i**s**t — muestra los archivos y carpetas de donde estás |
| `cd <carpeta>` | **C**hange **D**irectory — **te movés** a otra carpeta (`cd taller-agentes-ia`) |

Atajos útiles de `cd`:
- `cd ..` → subir un nivel (a la carpeta de arriba).
- `cd ~` → ir a tu **carpeta de usuario** (tu "home").

### El símbolo `~` (tu carpeta de usuario)

`~` es un atajo que significa "**mi carpeta de usuario**":
- En **Linux**: `/home/tu-usuario`
- En **Windows / Git Bash**: `/c/Users/tu-usuario` (o sea `C:\Users\tu-usuario`)

Por eso cuando ves `~/.openclaw` significa "la carpeta `.openclaw` dentro de mi carpeta de usuario".

### Carpetas y archivos "ocultos" (los que empiezan con `.`)

Los nombres que **empiezan con un punto** (como `.openclaw`, `.env`, `.bashrc`) están
**ocultos**: no aparecen en el explorador de archivos normal. No es que sean secretos,
es una convención. Para verlos en la terminal usá `ls -a` (la `-a` = "all", todos).

---

## 6. "Estar dentro de la carpeta del proyecto" (por qué importa)

Muchos pasos del taller dicen cosas como `bash setup/install.sh`. Eso significa:
"corré el archivo `install.sh` que está dentro de la carpeta `setup`". Pero para que
funcione, **tenés que estar parado en la carpeta del proyecto** (`taller-agentes-ia`).

Cómo asegurarte:
```
cd ~/taller-agentes-ia     # o la ruta donde lo descargaste
pwd                        # debe terminar en /taller-agentes-ia
ls                         # deberías ver: setup, casos, skills, README.md, ...
```
Si `ls` te muestra esas carpetas, estás en el lugar correcto. ✅

> Error típico: `bash: setup/install.sh: No such file or directory` casi siempre
> significa **"no estás parado en la carpeta correcta"**. Volvé con `cd` a
> `taller-agentes-ia` y reintentá.

---

## 7. Los dos mundos: el proyecto vs. tu agente

Esto confunde a **todos** al principio, así que vale la pena tenerlo claro. Hay **dos
carpetas distintas** y es importante no mezclarlas:

| | 📁 El proyecto (**repo**) | 📁 Tu agente (**workspace**) |
|---|---|---|
| **Dónde está** | la carpeta que descargaste, ej. `~/taller-agentes-ia` | `~/.openclaw/` (la crea el instalador) |
| **Qué es** | la **plantilla / el código fuente** | el agente **vivo** que corre y responde en Telegram |
| **¿El bot lo usa?** | ❌ No directamente | ✅ Sí — de acá lee todo |

La regla mental: **editás en el proyecto → un instalador lo copia a `~/.openclaw`**.

Ejemplo real que pasa seguido: querés cambiarle la personalidad al bot y editás el
`AGENTS.md` **de la carpeta del proyecto**… pero el bot no cambia. ¿Por qué? Porque el
que manda es el del **agente vivo**:
```
~/.openclaw/workspace/AGENTS.md      ← este es el que el bot lee
```
Ese es el que tenés que editar para un cambio rápido.

---

## 8. Editar un archivo de texto desde la terminal

Los archivos del taller (`.env`, `.md`, `.js`, `.json`) son **texto plano**: se abren y
editan con cualquier editor. Dos formas:

### `notepad` (Windows) — el Bloc de notas de siempre
```
notepad ~/.openclaw/workspace/AGENTS.md
```
Se abre el Bloc de notas normal. Editás, **Ctrl+S** para guardar, cerrás. Fácil.

### `nano` (Linux y también Git Bash) — el editor dentro de la terminal
```
nano ~/.openclaw/workspace/AGENTS.md
```
Se abre un editor **dentro de la misma ventana negra**. Acá está la parte que confunde:
para **guardar y salir** no es Ctrl+S, es:

1. **Ctrl + O** (la letra O, de "Output") → te pregunta el nombre → apretá **Enter** para confirmar.
2. **Ctrl + X** → sale del editor y volvés al prompt.

> Regla: en `nano`, el símbolo `^` que ves abajo significa **Ctrl**. Así que `^O` = Ctrl+O,
> `^X` = Ctrl+X.

---

## 9. Cuando algo sale mal (no entres en pánico)

- **El texto rojo no es el fin del mundo.** Es la forma en que la terminal te avisa de un
  problema. Leelo con calma: muchas veces dice **qué falta y cómo arreglarlo**.
- **Errores más comunes y qué significan:**

  | Dice algo como… | Qué significa | Qué hacer |
  |---|---|---|
  | `command not found` | la compu no conoce ese comando (no está instalado o no está en el PATH) | cerrá y reabrí la terminal; revisá que instalaste el programa |
  | `No such file or directory` | el archivo/carpeta no está donde buscaste | casi siempre no estás parado en la carpeta correcta → `cd` (sección 6) |
  | `Permission denied` | no tenés permiso | seguí el paso del taller de "npm sin sudo" |

- **Si te trabás:** copiá el error **completo** (o sacá una foto) y mostráselo al
  facilitador. El texto del error es justo lo que necesita para ayudarte.

---

## 10. Mini-glosario

| Palabra | Qué es |
|---|---|
| **Terminal / consola** | la ventana donde escribís comandos |
| **Git Bash** | la terminal que usamos en Windows para el taller |
| **Comando** | una orden que escribís (ej. `node --version`) |
| **Prompt** | la línea con el `$` donde escribís; muestra en qué carpeta estás |
| **Ruta / path** | la dirección de un archivo o carpeta (`~/taller-agentes-ia/setup`) |
| **Directorio** | otra palabra para "carpeta" |
| **`~`** | tu carpeta de usuario (`/home/vos` o `C:\Users\vos`) |
| **`cd` / `ls` / `pwd`** | moverte / ver / saber dónde estás |
| **Carpeta oculta** | la que empieza con `.` (no se ve en el explorador normal) |
| **Repo / proyecto** | la carpeta `taller-agentes-ia` que descargaste (la plantilla) |
| **Workspace / `~/.openclaw`** | donde vive el agente que corre de verdad |
| **Gateway** | el "motor" que mantiene tu bot escuchando en Telegram |
| **`.env`** | archivo de texto con tus credenciales (clave, token, ID) |

---

## Listo 🎉

Con esto ya podés seguir la **[Guía del participante](GUIA-PARTICIPANTE.md)** sin perderte.
Recordá: **copiá con cuidado, apretá Enter, y esperá a que vuelva el `$`.** Y si algo sale
en rojo, no pasa nada — leé el mensaje o pedile ayuda al facilitador.
