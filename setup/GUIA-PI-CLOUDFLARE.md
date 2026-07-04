# Guía: Pi 24/7 con los 4 agentes + dashboard en `vault.gymbase.fit`

Guía paso a paso para el **facilitador**. Al terminar tenés:

- La Raspberry Pi encendida 24/7 con el gateway de OpenClaw + los 4 casos.
- El dashboard pixel-art accesible en **`https://vault.gymbase.fit`** (URL fija, no cambia al reiniciar).
- Todo como servicios que arrancan solos cuando prendés la Pi.
- (Opcional) Una pantalla de login gratis delante del dashboard.

> **Idea clave:** la Pi está detrás de tu router (sin IP pública). El *Cloudflare
> Tunnel* abre una conexión de salida desde la Pi hacia Cloudflare, y Cloudflare
> publica `vault.gymbase.fit`. No hay que abrir puertos en el router ni tener IP fija.
> El dashboard y sus datos salen del **mismo origen** (una sola URL, sin CORS).

---

## Requisitos previos

- [ ] `gymbase.fit` está en Cloudflare (si lo compraste ahí, ya lo está — aparece en tu dashboard como una "zona").
- [ ] La Pi con Raspberry Pi OS (o Debian), encendida y con internet.
- [ ] Acceso a la Pi por terminal (teclado+monitor o SSH).

Tiempo estimado: **20–30 min** (la mayor parte es esperar descargas).

---

## Parte A — Preparar la Pi (una vez)

En la terminal de la Pi:

```bash
# 1. Node.js 22 con fnm (sin sudo)
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 22 && fnm use 22 && fnm default 22
node --version          # v22.x.x

# 2. Clonar el repo
git clone https://github.com/MarcosZam13/taller-agentes-ia.git
cd taller-agentes-ia

# 3. Credenciales
cp .env.example .env
nano .env
```

En el `.env` completá:

```env
OPENROUTER_API_KEY=sk-or-...        # la key del taller
TELEGRAM_BOT_TOKEN=1234:AA...       # el bot de la Pi
TELEGRAM_ALLOWED_USER_ID=123456789  # tu ID de Telegram
```

Guardá (`Ctrl+O`, `Enter`, `Ctrl+X`). **Todavía no corras nada más** — primero
sacamos el token de Cloudflare (Parte B) y después arrancamos todo junto (Parte D).

---

## Parte B — Crear el túnel en Cloudflare (sacar el token)

Todo esto es en el navegador, en tu compu (no en la Pi).

1. Entrá a **[one.dash.cloudflare.com](https://one.dash.cloudflare.com)** (el panel **Zero Trust**).
   - Si es tu primera vez te pide elegir un plan → elegí el **Free**. Puede pedirte
     una tarjeta para "verificar", pero no cobra en el plan Free.
2. En el menú izquierdo: **Networks → Tunnels** (en paneles viejos puede estar en
   **Access → Tunnels**).
3. Botón **Create a tunnel** → elegí el conector **Cloudflared** → **Next**.
4. Nombre del túnel: `taller-pi` (o el que quieras) → **Save tunnel**.
5. Cloudflare te muestra una pantalla de "Install connector" con un comando largo
   tipo `cloudflared service install eyJhbGciOi...`.
   - 👉 **Copiá SOLO el token** — la parte larga que empieza con **`eyJ`** hasta el
     final. **NO corras ese comando en la Pi**: de instalar el servicio se encarga
     `pi-setup.sh`. Solo necesitás el token.
   - Guardalo en un bloc de notas por ahora.
6. **No cierres la pantalla todavía** → hacé click en **Next** para ir a la
   pestaña de rutas.

---

## Parte C — Apuntar `vault.gymbase.fit` al dashboard

Seguís en el asistente del túnel (pestaña **Public Hostname / Route traffic**):

1. **Add a public hostname** (o "Public Hostnames" → **Add a public hostname**).
2. Completá:
   - **Subdomain:** `vault`
   - **Domain:** `gymbase.fit` (elegilo del desplegable)
   - **Path:** *(dejar vacío)*
   - **Type:** `HTTP`
   - **URL:** `localhost:3001`
3. **Save hostname**.

Cloudflare crea solo el registro DNS de `vault.gymbase.fit`. No tenés que tocar DNS a mano.

> **UI nueva de Cloudflare:** en paneles recientes esto no se llama "Public
> Hostname" sino **Routes**. En la vista del túnel, click **`+ Add route`** →
> elegí **Published application** (el ícono del globo) → completá subdomain
> `vault`, domain `gymbase.fit`, y el servicio.

> ⚠️ **El Type/Service DEBE ser `HTTP`, no `HTTPS`.** El relay del dashboard sirve
> HTTP plano en `localhost:3001`. Si dejás `https://localhost:3001`, cloudflared
> intenta un handshake TLS contra un servidor HTTP y devuelve **502**
> (`tls: first record does not look like a TLS handshake`). Si te pasa, editá la
> route en **Networks → Tunnels → taller-pi → Routes** y cambiá el Type a `HTTP`.

---

## Parte D — Arrancar todo en la Pi (un comando)

Volvé a la terminal de la Pi, dentro de la carpeta del repo. Pegá el token que
copiaste en la Parte B:

```bash
cd ~/taller-agentes-ia
CF_TUNNEL_TOKEN="eyJhbGciOi...tu-token-completo..." bash setup/pi-setup.sh
```

Eso hace, en orden y solo:

1. Instala OpenClaw + configura OpenRouter (gpt-4o-mini) + arranca el gateway.
2. Instala los **4 casos** (finanzas, second-brain, pdf-extractor, dev-assistant)
   en el mismo agente.
3. Deja el **relay + dashboard** como servicio (`taller-vault-relay`) en el puerto 3001.
4. Instala `cloudflared` y lo deja como servicio (`taller-cloudflared`) corriendo el
   túnel con **tu token** → publica `vault.gymbase.fit`.
5. Activa *linger* para que todo arranque solo al prender la Pi, sin loguearte.

> `pdf-extractor` necesita `poppler` y `dev-assistant` necesita `python3`. En
> Raspberry Pi OS: `sudo apt install -y poppler-utils python3`. Si falta alguno, el
> instalador del caso avisa; instalás el programa y volvés a correr `pi-setup.sh`
> (es idempotente, no rompe lo ya hecho).

---

## Parte E — Verificar

```bash
# Servicios arriba
systemctl --user status taller-vault-relay taller-cloudflared

# El relay responde localmente
curl -s localhost:3001/events | head -c 200
```

Después, en cualquier navegador (celular incluido): **https://vault.gymbase.fit**

- Debería cargar el dashboard pixel-art.
- Escribile al bot por Telegram: `gasté 8500 en el almuerzo` → el cuarto **FINANZAS**
  se enciende. `anotá que empecé el taller` → **CEREBRO**. Etc.

> El certificado HTTPS lo pone Cloudflare automáticamente — puede tardar 1–2 min la
> primera vez.

---

## Parte F — (Opcional) Login gratis delante del dashboard

Si querés que pida un login antes de mostrar el dashboard (gratis hasta 50 personas):

1. En Zero Trust: **Access → Applications → Add an application**.
2. Tipo: **Self-hosted**.
3. **Application name:** `Vault Taller`.
4. **Public hostname:** subdomain `vault`, domain `gymbase.fit`.
5. **Next** → creá una **policy**:
   - **Policy name:** `taller`
   - **Action:** `Allow`
   - **Include** → `Emails` → poné tu correo (y los que quieras dejar entrar), o
     `Emails ending in` → `@gmail.com` para abrirlo más.
6. Guardá. Ahora `vault.gymbase.fit` pide un código que Cloudflare manda por email
   antes de dejar ver el dashboard.

> Para la expo quizás **no** quieras login (que entren rápido con el QR). Podés
> dejar Access desactivado y activarlo solo si lo necesitás. Se prende/apaga cuando
> quieras sin tocar la Pi.

---

## Checklist para el día de la expo

- [ ] La Pi está encendida y con internet.
- [ ] `systemctl --user status taller-vault-relay taller-cloudflared` → ambos `active (running)`.
- [ ] `https://vault.gymbase.fit` abre el dashboard.
- [ ] Un mensaje de prueba por Telegram enciende el cuarto correcto.
- [ ] (Si usás login) probaste entrar con tu email.
- [ ] Generá un QR de `https://vault.gymbase.fit` para proyectar.

---

## Troubleshooting

| Problema | Qué mirar / solución |
|---|---|
| `vault.gymbase.fit` no abre | `systemctl --user status taller-cloudflared` y `journalctl --user -u taller-cloudflared -n 40`. Esperá 1–2 min por el DNS/cert. |
| Abre pero dice OFFLINE | El relay no conecta al gateway: `systemctl --user status taller-vault-relay openclaw-gateway` |
| Error de token / túnel no conecta | El token quedó mal copiado. Volvé a Networks → Tunnels → taller-pi, copiá el token de nuevo y re-corré `CF_TUNNEL_TOKEN=... bash setup/pi-setup.sh`. |
| Los servicios no arrancan al reiniciar | `loginctl enable-linger $USER` y reiniciá la Pi. |
| Un caso no responde | Faltó `poppler`/`python3`. Instalalos y re-corré `pi-setup.sh`. |
| Quiero ver la URL rápida en vez del dominio | Corré `pi-setup.sh` **sin** `CF_TUNNEL_TOKEN` → usa un túnel `*.trycloudflare.com`. |

---

## Comandos útiles del día a día

```bash
# Reiniciar el dashboard sin tocar el resto
systemctl --user restart taller-vault-relay

# Ver logs del túnel en vivo
journalctl --user -u taller-cloudflared -f

# Actualizar el código (si cambia el repo)
cd ~/taller-agentes-ia && git pull && bash setup/pi-setup.sh
```
