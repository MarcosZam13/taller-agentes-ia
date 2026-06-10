#!/usr/bin/env node
// relay.mjs — Puente entre el gateway de OpenClaw y el vault dashboard
// Usa WebSocket nativo de Node.js 22+ (sin dependencias externas).
// Conecta al gateway, autentica como operador y expone eventos reales
// en http://localhost:3001/events (CORS abierto para file:// y localhost).
//
// Uso: node demo/vault/relay.mjs

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createRequire } from "module";

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
const PORT = 3001;
const MAX_EVENTS = 50;

// ── Leer token del gateway ────────────────────────────────────────────────────
function readToken() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`Config no encontrado: ${CONFIG_PATH}`);
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const token = cfg?.gateway?.auth?.token;
  if (!token) throw new Error("gateway.auth.token no encontrado en config");
  return token;
}

// ── Estado compartido ─────────────────────────────────────────────────────────
const state = {
  connected: false,
  agents: [],
  events: [],
  stats: { totalMsgs: 0, model: "groq/llama-3.1-70b-versatile" },
};

function pushEvent(evt) {
  state.events.unshift(evt);
  if (state.events.length > MAX_EVENTS) state.events.pop();
}

// ── Conectar al gateway ───────────────────────────────────────────────────────
let ws = null;
let msgId = 1;
let reconnectTimer = null;

function req(method, params = {}) {
  if (!ws || ws.readyState !== 1 /* OPEN */) return;
  ws.send(JSON.stringify({ type: "req", id: String(msgId++), method, params }));
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

    // Challenge → autenticar
    if (msg.type === "event" && msg.event === "connect.challenge") {
      req("connect", {
        minProtocol: 4, maxProtocol: 4,
        client: { id: "webchat-ui", version: "webchat-ui", mode: "webchat", platform: "web" },
        role: "operator",
        scopes: ["operator.read"],
        caps: [],
        auth: { token },
        userAgent: "vault-relay/1.0",
        locale: "es",
      });
      return;
    }

    // Respuesta al connect
    if (msg.type === "res" && msg.id === "1") {
      if (msg.ok === false) {
        console.error("[relay] auth falló:", msg.error?.message);
        return;
      }
      console.log("[relay] autenticado ✓");
      state.connected = true;
      req("agents.list", {});
      req("sessions.list", {});
    }

    // Resultados de agents.list
    if (msg.type === "res" && msg.result?.agents) {
      state.agents = msg.result.agents.map((a) => ({
        id: a.id,
        skills: a.skills || [],
        model: a.model?.primary || state.stats.model,
      }));
      if (state.agents[0]?.model) state.stats.model = state.agents[0].model;
      console.log("[relay] agentes:", state.agents.map((a) => a.id).join(", "));
    }

    // Eventos en tiempo real
    if (msg.type === "event") {
      const ev = msg.event;
      const payload = msg.payload || {};

      if (ev === "session.message" || ev === "chat.message" || ev === "message") {
        state.stats.totalMsgs++;
        const agentId = payload.agentId || payload.agent || "main";
        pushEvent({
          type: "message",
          agentId,
          text: payload.content || payload.text || payload.message || "",
          dir: payload.role === "user" || payload.from === "user" ? "user" : "agent",
          ts: Date.now(),
        });
      }

      if (ev === "agent.thinking" || ev === "agent.start") {
        pushEvent({ type: "thinking", agentId: payload.agentId || "main", ts: Date.now() });
      }
    }
  });

  ws.on("close", (code) => {
    state.connected = false;
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

const server = createServer((req, res) => {
  const origin = req.headers["origin"] || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/events" || req.url === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({
      connected: state.connected,
      agents: state.agents,
      stats: state.stats,
      events: state.events.slice(0, 20),
    }));
    return;
  }

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
