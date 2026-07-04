#!/usr/bin/env node
// relay.mjs — Puente entre el gateway de OpenClaw y el vault dashboard
// Usa WebSocket nativo de Node.js 22+ (sin dependencias externas).
// Conecta al gateway, autentica como operador y expone eventos reales
// en http://localhost:3001/events (CORS abierto para file:// y localhost).
//
// Para exponer el relay vía Cloudflare Tunnel y leerlo desde un vault público
// (ej. Vercel), pasar el origen con VAULT_PUBLIC_ORIGIN=https://taller-vault.vercel.app
//
// Uso: node demo/vault/relay.mjs

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createRequire } from "module";
import crypto from "node:crypto";

// Cargar ws desde node_modules local (demo/vault/node_modules)
const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let WS;
try {
  WS = require(resolve(__dir, "node_modules/ws/index.js"));
} catch {
  console.error("[relay] ws no instalado. Ejecutar: cd demo/vault && npm install");
  process.exit(1);
}

const HOME = process.env.HOME || "/root";
const CONFIG_PATH = resolve(HOME, ".openclaw", "openclaw.json");
const IDENTITY_PATH = resolve(HOME, ".openclaw", "identity", "device.json");
const PORT = Number(process.env.RELAY_PORT) || 3001;
const MAX_EVENTS = 50;
// Scopes que pide el relay al gateway. Deben ser un subconjunto de los
// approvedScopes del device y ser IDÉNTICOS entre el string canónico firmado y
// el campo `scopes` del connect. operator.read alcanza para listar agentes y
// recibir eventos (dashboard de solo lectura).
const RELAY_SCOPES = ["operator.read"];

// ── Leer token del gateway ────────────────────────────────────────────────────
function readToken() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`Config no encontrado: ${CONFIG_PATH}`);
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const token = cfg?.gateway?.auth?.token;
  if (!token) throw new Error("gateway.auth.token no encontrado en config");
  return token;
}

// ── Identidad de device (Ed25519) ─────────────────────────────────────────────
// El gateway solo otorga scopes de operador a un cliente que se autentique como
// un device PAREADO firmando el challenge. Reusamos la identidad del CLI
// (~/.openclaw/identity/device.json), ya aprobada con los scopes de operador.
// Sin identidad, el connect es anónimo (webchat) → scopes=[] → el dashboard cae
// a modo DEMO. Así el relay sigue corriendo en equipos sin device pareado.
function readIdentity() {
  if (!existsSync(IDENTITY_PATH)) {
    console.warn("[relay] sin identidad de device — conexión anónima (dashboard en modo DEMO)");
    return null;
  }
  try {
    const id = JSON.parse(readFileSync(IDENTITY_PATH, "utf8"));
    const priv = crypto.createPrivateKey(id.privateKeyPem);
    // jwk.x = clave pública raw (32 bytes) en base64url sin padding, tal como
    // la espera el gateway en device.publicKey.
    const pubB64url = crypto.createPublicKey(id.publicKeyPem).export({ format: "jwk" }).x;
    console.log(`[relay] identidad de device cargada: ${id.deviceId.slice(0, 12)}…`);
    return { deviceId: id.deviceId, priv, pubB64url };
  } catch (e) {
    console.warn("[relay] identidad de device inválida, conexión anónima:", e.message);
    return null;
  }
}
const identity = readIdentity();

// Construye los params del connect. Si hay identidad y nonce, firma el challenge
// como device (protocolo 4) para obtener scopes de operador; si no, connect
// anónimo (modo DEMO). Se firma FRESCO en cada challenge (evita
// DEVICE_AUTH_SIGNATURE_EXPIRED).
function buildConnectParams(token, nonce) {
  const base = {
    minProtocol: 4, maxProtocol: 4,
    role: "operator",
    scopes: RELAY_SCOPES,
    auth: { token },
    userAgent: "vault-relay/1.0",
    locale: "es",
  };
  if (identity && nonce) {
    // Valores del enum del gateway (GATEWAY_CLIENT_IDS / GATEWAY_CLIENT_MODES):
    // el id del Control UI es "openclaw-control-ui" y su modo coarse es "ui".
    // Deben ir idénticos en el string canónico firmado y en el connect.
    const clientId = "openclaw-control-ui", clientMode = "ui", role = "operator";
    const signedAtMs = Date.now();
    const canonical = [
      "v2", identity.deviceId, clientId, clientMode, role,
      RELAY_SCOPES.join(","), String(signedAtMs), token, nonce,
    ].join("|");
    const signature = crypto
      .sign(null, Buffer.from(canonical, "utf8"), identity.priv)
      .toString("base64url");
    return {
      ...base,
      client: { id: clientId, version: clientId, mode: clientMode, platform: "linux" },
      device: { id: identity.deviceId, publicKey: identity.pubB64url, signature, signedAt: signedAtMs, nonce },
      caps: ["tool-events"],
    };
  }
  // Fallback anónimo: sin device ni nonce, el gateway lo trata como webchat.
  return {
    ...base,
    client: { id: "webchat-ui", version: "webchat-ui", mode: "webchat", platform: "web" },
    caps: [],
  };
}

// ── Estado compartido ─────────────────────────────────────────────────────────
const state = {
  connected: false,
  agents: [],
  events: [],
  stats: { totalMsgs: 0, model: "openrouter/openai/gpt-4o-mini" },
};

function pushEvent(evt) {
  state.events.unshift(evt);
  if (state.events.length > MAX_EVENTS) state.events.pop();
}

// ── Conectar al gateway ───────────────────────────────────────────────────────
let ws = null;
let msgId = 1;
let reconnectTimer = null;
let connectReqId = null;  // id del `connect` enviado, para casar su respuesta
let agentsReqId = null;   // id de agents.list
let sessionsReqId = null; // id de sessions.list
const subscribedKeys = new Set(); // sesiones ya suscritas a mensajes
const seenMsgs = new Map();       // dedupe de mensajes: sig → timestamp
const runSkill = new Map();       // sessionKey → skill del turno en curso

// Aplana el `content` de un mensaje a un string con señal de enrutamiento.
// El content del usuario es string; el del asistente es un array de partes
// (text | toolCall). Para un toolCall devolvemos el comando ejecutado, que
// contiene el script de la skill (expense.js/brain.js/…) — la pista más fuerte
// para que el dashboard sepa qué cuarto encender.
function flattenContent(content) {
  if (typeof content === "string") return { text: content, tool: null };
  if (!Array.isArray(content)) return { text: "", tool: null };
  const parts = [];
  let tool = null;
  for (const p of content) {
    if (p?.type === "text" && p.text) parts.push(p.text);
    else if (p?.type === "toolCall") {
      tool = p.name || null;
      parts.push(p.arguments?.command || p.arguments?.cmd || p.name || "");
    }
  }
  return { text: parts.join(" ").trim(), tool };
}

function req(method, params = {}) {
  if (!ws || ws.readyState !== 1 /* OPEN */) return null;
  const id = String(msgId++);
  ws.send(JSON.stringify({ type: "req", id, method, params }));
  return id;
}

// Suscribe a los mensajes de una sesión (idempotente por key).
function subscribeMessages(key) {
  if (subscribedKeys.has(key)) return;
  subscribedKeys.add(key);
  req("sessions.messages.subscribe", { key });
  console.log(`[relay] suscrito a mensajes de ${key}`);
}

function connect(token) {
  console.log("[relay] conectando al gateway...");
  // Enviamos Origin del propio gateway para pasar el check de allowedOrigins
  ws = new WS("ws://127.0.0.1:18789", {
    headers: { Origin: "http://127.0.0.1:18789" },
  });

  ws.on("open", () => console.log("[relay] WS abierto"));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Challenge → firmar y autenticar como device
    if (msg.type === "event" && msg.event === "connect.challenge") {
      const nonce = msg.payload?.nonce;
      connectReqId = req("connect", buildConnectParams(token, nonce));
      return;
    }

    // Respuesta al connect
    if (msg.type === "res" && msg.id === connectReqId) {
      if (msg.ok === false) {
        console.error("[relay] auth falló:", msg.error?.message);
        return;
      }
      // hello-ok no trae scopes; se confirman al llamar métodos de operador.
      // Un connect anónimo (sin device firmado) responde ok igual, pero luego
      // agents.list falla con "missing scope: operator.read" → DEMO.
      console.log(`[relay] autenticado ✓ (${identity ? "device firmado" : "anónimo → DEMO"})`);
      state.connected = true;
      agentsReqId = req("agents.list", {});
      sessionsReqId = req("sessions.list", {});
      req("sessions.subscribe", {}); // altas/bajas de sesiones (sessions.changed)
    }

    // Resultados de agents.list — el gateway responde bajo `payload`, no `result`.
    // Si falta el scope, msg.ok===false y no hay payload.agents → queda en DEMO.
    if (msg.type === "res" && msg.id === agentsReqId) {
      if (msg.ok === false) {
        console.warn(`[relay] ⚠ agents.list sin permiso (${msg.error?.message}) → dashboard en DEMO`);
        return;
      }
      const agents = msg.payload?.agents || [];
      state.agents = agents.map((a) => ({
        id: a.id,
        skills: a.skills || [],
        model: a.model?.primary || state.stats.model,
      }));
      if (state.agents[0]?.model) state.stats.model = state.agents[0].model;
      console.log("[relay] agentes reales:", state.agents.map((a) => a.id).join(", ") || "(ninguno)");
      return;
    }

    // Resultados de sessions.list — suscribirse a los mensajes de cada sesión
    // (sessions.messages.subscribe requiere la `key` de cada una).
    if (msg.type === "res" && msg.id === sessionsReqId) {
      if (msg.ok === false) return;
      for (const s of msg.payload?.sessions || []) {
        if (s.key) subscribeMessages(s.key);
      }
      return;
    }

    // Eventos en tiempo real
    if (msg.type === "event") {
      const ev = msg.event;
      const payload = msg.payload || {};

      // Volcado para inspeccionar shapes reales al depurar (RELAY_DEBUG=1).
      if (process.env.RELAY_DEBUG && !/health|connect\.challenge/.test(ev)) {
        console.log(`[relay:evt] ${ev} ${JSON.stringify(payload).slice(0, 240)}`);
      }

      // Alta de sesiones → re-listar para suscribir mensajes de las nuevas.
      // sessions.changed también marca inicio/fin de cada run: al terminar,
      // olvidamos el skill del turno para no contaminar el siguiente.
      if (ev === "sessions.changed" || ev === "sessions.updated") {
        if (payload.phase === "end" && payload.sessionKey) runSkill.delete(payload.sessionKey);
        for (const s of payload.session ? [payload.session] : []) {
          if (s.key) subscribeMessages(s.key);
        }
        return;
      }

      // Mensajes reales de las sesiones (sessions.messages.subscribe). Es la
      // señal que enciende cada cuarto. El enrutado por texto es poco fiable
      // (FINANZAS es "tragona": compra/gasto matchea notas y otros casos), así
      // que derivamos el SKILL del path del comando del toolCall (skills/<skill>/)
      // y lo estampamos en TODOS los mensajes del turno — incluido re-etiquetar
      // hacia atrás el mensaje del usuario, que llega antes de saber la tool.
      if (ev === "session.message") {
        const mm = payload.message || {};
        const { text, tool } = flattenContent(mm.content);
        if (!text) return;
        const role = mm.role || "";
        const sessionKey = payload.sessionKey || "";
        const skillFromCmd = (text.match(/skills\/([a-z0-9-]+)\//i) || [])[1] || "";
        if (skillFromCmd) {
          runSkill.set(sessionKey, skillFromCmd);
          // re-etiquetar el mensaje de usuario más reciente de esta sesión.
          for (const e of state.events) {
            if (e.sessionKey === sessionKey && e.dir === "user" && !e.skill) { e.skill = skillFromCmd; break; }
          }
        }
        const skill = skillFromCmd || runSkill.get(sessionKey) || "";
        // Dedupe: el gateway emite el mensaje final más de una vez (con id/seq
        // distintos pero mismo texto). Deduplicamos por role|text en una ventana
        // corta. El mensaje de usuario y el del toolCall tienen texto propio, así
        // que no se ven afectados; dos turnos con texto idéntico a >8s sí pasan.
        const sig = `${role}|${text}`;
        const now = Date.now();
        if (seenMsgs.has(sig) && now - seenMsgs.get(sig) < 8000) return;
        seenMsgs.set(sig, now);
        if (seenMsgs.size > 300) for (const [k, t] of seenMsgs) if (now - t > 30000) seenMsgs.delete(k);

        state.stats.totalMsgs++;
        pushEvent({
          type: "message",
          agentId: payload.agentId || "main",
          sessionKey,
          text,
          tool,                         // nombre de la tool si el mensaje fue un toolCall
          skill,                        // skill del turno (skills/<skill>/) → enruta el cuarto
          dir: /user|human/i.test(role) ? "user" : "agent",
          ts: now,
        });
      }
    }
  });

  ws.on("close", (code) => {
    state.connected = false;
    subscribedKeys.clear(); // la nueva conexión debe re-suscribirse
    console.log(`[relay] desconectado (${code}) — reconectando en 5s...`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(token), 5000);
  });

  ws.on("error", (e) => {
    console.error("[relay] error WS:", e.message);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
// CORS restringido: solo file:// (origin: null) y localhost conocidos.
// El relay escucha solo en 127.0.0.1, pero evitamos exponer datos de agentes
// a cualquier página abierta en el navegador del mismo equipo.
const ALLOWED_ORIGINS = new Set([
  "null",                      // dashboard abierto desde file://
  "http://127.0.0.1:3001",     // servido por el propio relay
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

// Origen público del vault (ej. el deploy en Vercel) cuando el relay se expone
// vía Cloudflare Tunnel. Se pasa por env var para no abrir CORS a cualquiera.
// Acepta varios separados por coma. Se normaliza con .origin para evitar
// que un path o query se cuele en la comparación.
for (const raw of (process.env.VAULT_PUBLIC_ORIGIN || "").split(",")) {
  const value = raw.trim();
  if (!value) continue;
  try {
    const { origin, protocol } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") {
      console.warn(`[relay] VAULT_PUBLIC_ORIGIN ignorado (protocolo no soportado): ${value}`);
      continue;
    }
    ALLOWED_ORIGINS.add(origin);
    console.log(`[relay] Origen público permitido para CORS: ${origin}`);
  } catch {
    console.warn(`[relay] VAULT_PUBLIC_ORIGIN inválido, ignorado: ${value}`);
  }
}

// El dashboard se sirve desde el propio relay para que UNA sola URL (ej. el túnel de
// Cloudflare) entregue el panel y los datos desde el mismo origen — sin CORS ni #relay.
const INDEX_PATH = resolve(__dir, "index.html");

const server = createServer((req, res) => {
  const origin = req.headers["origin"] || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Datos en vivo (JSON)
  if (req.url === "/events") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({
      connected: state.connected,
      agents: state.agents,
      stats: state.stats,
      events: state.events.slice(0, 20),
    }));
    return;
  }

  // Dashboard (HTML) en / y /index.html
  if (req.url === "/" || req.url === "/index.html") {
    try {
      const html = readFileSync(INDEX_PATH, "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(html);
    } catch {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(500);
      res.end(JSON.stringify({ error: "index.html no encontrado junto al relay" }));
    }
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

// ── Inicio ────────────────────────────────────────────────────────────────────
const token = readToken();
connect(token);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[relay] HTTP en http://127.0.0.1:${PORT}/events`);
  console.log("[relay] El vault dashboard lo lee automáticamente cada 3 segundos");
});
