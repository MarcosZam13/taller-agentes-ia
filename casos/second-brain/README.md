# Caso 2: Second Brain — Gestión del conocimiento con IA

**Tiempo estimado:** 25–35 minutos  
**Dificultad:** Intermedio  
**Modelo:** Groq — Llama 3.1 70B  
**Plataforma:** Cualquier (web UI, Telegram, CLI)

---

## ¿Qué vas a construir?

Un agente que lee, crea y conecta notas en formato Obsidian desde el chat. Podés pedirle que busque información en tus notas, resuma lo que escribiste esta semana, o cree una nueva nota con las ideas que se le dictan — todo en Markdown con links internos.

---

## Requisitos previos

- [ ] OpenClaw instalado y gateway corriendo (`node setup/check.js`)
- [ ] Groq configurado (verificar con `node setup/check.js`)
- [ ] Skill `second-brain` instalada en el workspace
- [ ] (Opcional) Obsidian instalado para visualizar las notas

---

## Paso 1 — Verificar que el gateway está activo (2 min)

```bash
systemctl --user status openclaw-gateway.service
bash setup/open-dashboard.sh   # abre el dashboard con auth correcto
```

---

## Paso 2 — Confirmar la skill está disponible (2 min)

En el chat:

```
/skills
```

Verificar que `second-brain 🧠` aparece. Si no:

```bash
mkdir -p ~/.openclaw/workspace/skills/second-brain
cp skills/second-brain/SKILL.md ~/.openclaw/workspace/skills/second-brain/
```

---

## Paso 3 — Crear las primeras notas (8 min)

Escribir en el chat:

```
anotar: los agentes de IA pueden tener memoria persistente gracias a skills y archivos de contexto
```

**Respuesta esperada:**
```
Nueva nota lista:
---
fecha: 2026-06-10
tags: [agentes, IA, memoria]
---
# Agentes IA y memoria persistente
Los agentes de IA pueden tener memoria persistente gracias a skills...
## Conexiones
- [[OpenClaw Skills]]

¿La guardo en el vault? (sí/no)
```

Responder `sí`.

> **¿Qué está pasando?** El agente genera una nota en formato Obsidian con frontmatter YAML, tags inferidos del contenido, y propone conexiones con otras notas usando la sintaxis `[[doble corchete]]`.

---

## Paso 4 — Buscar en las notas (5 min)

```
qué tengo sobre memoria en agentes
```

El agente lista los archivos `.md` que coincidan y resume su contenido:

```
| Título                              | Fecha      | Resumen                              |
|-------------------------------------|------------|--------------------------------------|
| Agentes IA y memoria persistente    | 2026-06-10 | Skills y archivos de contexto para... |
```

---

## Paso 5 — Conectar ideas (5 min)

Crear otra nota y pedir conexiones:

```
anotar: OpenClaw usa SKILL.md para inyectar contexto como system prompt en el LLM
```

Luego:

```
conectar "SKILL.md como system prompt" con "Agentes IA y memoria persistente"
```

El agente sugiere cómo se relacionan y agrega el link `[[...]]` en ambas notas.

---

## Paso 6 — Resumir notas recientes (5 min)

```
resumen de mis notas de hoy
```

El agente lee todos los archivos modificados hoy y devuelve un resumen organizado por tema.

---

## Paso 7 — Ver los archivos generados (3 min)

```bash
ls ~/.openclaw/workspace/../../obsidian-vault/   # o la ruta que hayas configurado
cat ~/.openclaw/workspace/../../obsidian-vault/"Agentes IA y memoria persistente.md"
```

Las notas son archivos `.md` estándar — se pueden abrir en Obsidian, VS Code, o cualquier editor.

---

## ¿Qué aprendiste?

- **Obsidian como backend de IA:** El vault es simplemente una carpeta de archivos Markdown
- **Links internos como grafo de conocimiento:** La sintaxis `[[nota]]` crea un grafo que Obsidian puede visualizar
- **LLM como editor inteligente:** El modelo infiere tags, propone conexiones y formatea sin que vos tengas que pedirlo
- **PKM potenciado por chat:** Capturar ideas rápido desde cualquier plataforma (especialmente Telegram)

---

## Próximos pasos

- [ ] Modificar `SKILL.md` para apuntar a tu vault real de Obsidian
- [ ] Agregar una plantilla de nota diaria (daily note)
- [ ] Conectar con Telegram para capturar ideas desde el celular durante el día
- [ ] Explorar el grafo de conexiones en Obsidian

---

## Troubleshooting

| Problema | Solución |
|---|---|
| Agente no encuentra notas | Verificar la ruta del vault en `SKILL.md` |
| Notas se crean en lugar equivocado | Configurar `{baseDir}` correctamente en el workspace |
| El agente no genera links `[[...]]` | Recordarle: "usar formato Obsidian con doble corchete" |
| Gateway caído | `systemctl --user restart openclaw-gateway.service` |
