# Caso 1: Rastreador de Gastos Personales

**Tiempo estimado:** 25–35 minutos  
**Dificultad:** Principiante  
**Modelo:** Groq — Llama 3.1 70B  
**Plataforma:** Cualquier (web UI, Telegram, CLI)

---

## ¿Qué vas a construir?

Un asistente que entiende lenguaje natural en español y te permite registrar gastos en colones costarricenses, consultar resúmenes por categoría y establecer presupuestos — todo por chat.

---

## Requisitos previos

- [ ] OpenClaw instalado y gateway corriendo (`node setup/check.js`)
- [ ] Azure OpenAI configurado con `gpt-4o-mini`
- [ ] Skill `expense-tracker` instalada en el workspace

---

## Paso 1 — Verificar que el gateway está activo (2 min)

```bash
# Verificar estado del servicio
systemctl --user status openclaw-gateway.service

# Si no está activo, iniciarlo
systemctl --user start openclaw-gateway.service

# Abrir el dashboard
xdg-open http://127.0.0.1:18789
```

Deberías ver el dashboard de OpenClaw. Si no, revisar logs:

```bash
journalctl --user -u openclaw-gateway.service -n 50
```

---

## Paso 2 — Confirmar la skill está disponible (3 min)

En el dashboard (o en el chat), escribir:

```
/skills
```

Verificar que `expense-tracker 💰` aparece en la lista. Si no:

```bash
# Copiar manualmente la skill
mkdir -p ~/.openclaw/workspace/skills/expense-tracker
cp skills/expense-tracker/SKILL.md ~/.openclaw/workspace/skills/expense-tracker/

# Recargar skills (hot-reload, no reinicio)
openclaw config set agents.defaults.skills '["expense-tracker"]'
```

---

## Paso 3 — Primer gasto (5 min)

Abrir el chat (web UI en `http://127.0.0.1:18789` o Telegram si está configurado).

Escribir:

```
gasté 8500 en el almuerzo de la soda
```

**Respuesta esperada:**
```
¿Registrar ₡8,500 en comida — almuerzo de la soda? (sí/no)
```

Responder `sí`.

**Respuesta esperada:**
```
✓ Registrado: ₡8,500 — comida — almuerzo de la soda
```

> **¿Qué está pasando?** El agente usa la skill `expense-tracker` para interpretar
> tu mensaje, inferir la categoría "comida" por las palabras clave "almuerzo" y "soda",
> y guardar el dato en `~/.openclaw/workspace/skills/expense-tracker/data/gastos.json`.

---

## Paso 4 — Registrar varios gastos (5 min)

```
anotar ₡3,200 en el bus
compré medicina, 12400 colones
Netflix este mes, 8,500
almuerzo restaurante ₡18,000
```

Confirmar cada uno cuando el agente pregunte.

> **Tip para el taller:** Notar cómo el agente infiere categorías distintas:
> - "bus" → transporte
> - "medicina" → salud
> - "Netflix" → servicios
> - "almuerzo restaurante" → comida

---

## Paso 5 — Consultar resumen (5 min)

```
resumen de mis gastos
```

Deberías ver una tabla con totales por categoría. Probar también:

```
cuánto gasté en comida
mis gastos de hoy
```

---

## Paso 6 — Establecer presupuesto (5 min)

```
quiero un presupuesto de 80000 colones para comida este mes
```

Luego consultar:

```
cuánto me queda en comida
```

**Respuesta esperada (con barra de progreso):**
```
Comida: ₡26,500 / ₡80,000 ████░░░░░░ 33.1% — quedan ₡53,500
```

---

## Paso 7 — Explorar variaciones (5 min)

Probar frases en distintos formatos:

```
gasté $15 en parqueo
ayer compré dos pizzas, 28000 entre dos
registrar: enero tuve gastos de electricidad por 35 mil
```

Observar cómo el agente maneja:
- Montos en USD (pregunta si convertir)
- Montos compartidos (pide aclaración)
- Fechas pasadas (las registra con la fecha indicada)

---

## Paso 8 — Ver el archivo de datos (2 min)

```bash
cat ~/.openclaw/workspace/skills/expense-tracker/data/gastos.json | python3 -m json.tool
```

Verás todos los gastos guardados en formato JSON. Este archivo es portátil — se puede migrar a otro sistema o procesar con cualquier herramienta.

---

## ¿Qué aprendiste?

- **Skills en OpenClaw:** Archivos Markdown que enseñan comportamiento al agente
- **Lenguaje natural → datos estructurados:** El agente interpreta texto libre y lo persiste
- **Contexto de categorías:** La skill define el dominio; el modelo general hace el resto
- **Ciclo de confirmación:** Patrón importante para evitar registros erróneos

---

## Próximos pasos (para explorar por cuenta propia)

- [ ] Modificar `SKILL.md` para agregar una categoría "ahorro"
- [ ] Agregar soporte para gastos en dólares con conversión automática
- [ ] Conectar con Telegram para registrar gastos desde el celular
- [ ] Exportar a CSV y abrir en Google Sheets

---

## Troubleshooting

| Problema | Solución |
|---|---|
| El agente no reconoce la skill | `openclaw config set agents.defaults.skills '["expense-tracker"]'` |
| Error de modelo | Verificar `AZURE_OPENAI_ENDPOINT` en `.env` |
| Gateway no inicia | `journalctl --user -u openclaw-gateway.service -n 50` |
| `gastos.json` no se crea | Crear directorio manualmente: `mkdir -p ~/.openclaw/workspace/skills/expense-tracker/data` |
