#!/usr/bin/env python3
"""setup-demo.py — Prepara todos los archivos del taller en un solo paso.

Crea:
  ~/taller-demo/factura-ejemplo.pdf   → Caso 3 (PDF Extractor)
  ~/taller-demo/test_gastos.py        → Caso 4 (Dev Assistant)
  ~/.openclaw/workspace/obsidian-vault/  → Caso 2 (Second Brain) con 3 notas

No requiere dependencias externas — solo Python 3.6+.
Uso: python3 demo/samples/setup-demo.py
     (install.sh lo ejecuta automáticamente)
"""

import os
import sys
from pathlib import Path
from datetime import date

HOME       = Path.home()
DEMO_DIR   = HOME / "taller-demo"
VAULT_DIR  = HOME / ".openclaw" / "workspace" / "obsidian-vault"
TODAY      = date.today().isoformat()

GREEN  = "\033[32m"
YELLOW = "\033[33m"
RESET  = "\033[0m"

def ok(msg):   print(f"{GREEN}[+]{RESET} {msg}")
def warn(msg): print(f"{YELLOW}[!]{RESET} {msg}")


# ── PDF mínimo en Python puro ─────────────────────────────────────────────────

def _build_pdf(lines: list[str]) -> bytes:
    """Genera un PDF válido (PDF 1.4) a partir de líneas de texto plano.
    Sin dependencias externas — escribe el formato PDF directamente.
    """
    # Construir stream de contenido (operadores de texto PDF)
    page_ops = ["BT", "/F1 10 Tf", "50 750 Td", "14 TL"]
    for line in lines:
        # Escapar caracteres especiales del formato PDF
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        page_ops.append(f"({safe}) Tj T*")
    page_ops.append("ET")
    stream_bytes = "\n".join(page_ops).encode("latin-1", errors="replace")

    # Objetos del PDF
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = (
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842]\n"
        b"  /Contents 4 0 R\n"
        b"  /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )
    obj4 = (
        f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode()
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )
    obj5 = b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n"

    header = b"%PDF-1.4\n"
    objs   = [obj1, obj2, obj3, obj4, obj5]

    # Calcular offsets para la tabla xref
    pos = len(header)
    offsets = []
    for obj in objs:
        offsets.append(pos)
        pos += len(obj)

    xref_start = pos
    xref_lines = ["xref", "0 6", "0000000000 65535 f "]
    for off in offsets:
        xref_lines.append(f"{off:010d} 00000 n ")
    xref_block = "\n".join(xref_lines) + "\n"

    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n"

    return header + b"".join(objs) + xref_block.encode() + trailer.encode()


# ── Caso 3: Factura PDF ───────────────────────────────────────────────────────

def crear_factura_pdf(dest: Path):
    lines = [
        "=" * 60,
        "           FACTURA ELECTRONICA",
        "=" * 60,
        "",
        "  Empresa:  Importaciones Del Valle S.A.",
        "  RUC:      3-101-456789 | San Jose, Costa Rica",
        f"  Fecha:    {TODAY}",
        "  Factura:  FE-00234",
        "",
        "-" * 60,
        "  Cliente:  Marcos Zamora",
        "  ID:       1-2345-6789",
        "  Correo:   marcos@ejemplo.com",
        "-" * 60,
        "",
        "  DETALLE",
        "",
        "  Descripcion                    Cant  P.Unit       Total",
        "  " + "-" * 54,
        "  Consultoria - Fase 1           10 h  CRC 15,000  CRC 150,000",
        "  Documentacion tecnica           5 h  CRC 10,000  CRC  50,000",
        "  Revision y entrega final        1 u  CRC 25,000  CRC  25,000",
        "  Licencia de software            1 u  CRC 45,000  CRC  45,000",
        "  " + "-" * 54,
        "",
        "  Subtotal:                                   CRC 270,000",
        "  IVA 13%:                                    CRC  35,100",
        "  TOTAL:                                      CRC 305,100",
        "",
        "=" * 60,
        "  Forma de pago:  Transferencia bancaria",
        "  Vencimiento:    30 dias a partir de la fecha",
        "  SINPE Movil:    8888-1234",
        "",
        "  Gracias por su preferencia.",
        "=" * 60,
    ]
    dest.write_bytes(_build_pdf(lines))
    ok(f"Factura PDF creada: {dest}")
    print(f"    → En el taller: procesar {dest}")


# ── Caso 4: Test Python ───────────────────────────────────────────────────────

def crear_test_python(dest: Path):
    content = '''\
# test_gastos.py — Módulo de análisis de gastos para el Caso 4
# Dev Assistant va a ejecutar estos tests, detectar el bug y proponer el fix.

import re


def parsear_monto(texto: str):
    """Extrae el monto numérico de una frase en lenguaje natural.
    Acepta: "gasté 8500", "CRC 8,500", "12400 colones"
    Devuelve el monto como int, o None si no encuentra nada.
    """
    texto = texto.lower().replace(",", "")
    match = re.search(r"(\\d+(?:\\.\\d+)?)", texto)
    if match:
        return int(float(match.group(1)))
    return None


def categorizar_gasto(descripcion: str) -> str:
    """Clasifica un gasto en una categoría basada en palabras clave."""
    desc = descripcion.lower()
    if any(p in desc for p in ["almuerzo", "cena", "soda", "restaurante", "cafe", "comida", "super"]):
        return "comida"
    if any(p in desc for p in ["bus", "uber", "taxi", "gasolina", "parqueo", "peaje"]):
        return "transporte"
    if any(p in desc for p in ["netflix", "spotify", "internet", "telefono", "electricidad", "agua"]):
        return "servicios"
    if any(p in desc for p in ["farmacia", "medico", "medicina", "dentista"]):
        return "salud"
    return "otro"


def calcular_total(gastos: list) -> int:
    """Suma una lista de montos. Falla si hay valores no numericos."""
    return sum(gastos)


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_parsear_monto_simple():
    assert parsear_monto("gaste 8500 en el almuerzo") == 8500

def test_parsear_monto_con_coma():
    # BUG: "CRC 8,500" — el .replace(",", "") deberia dar "8500"
    # pero re.search encuentra "8" (antes del punto en el regex)
    # El Dev Assistant debe detectar y corregir esto.
    assert parsear_monto("CRC 8,500") == 8500

def test_parsear_sin_monto():
    assert parsear_monto("pague con tarjeta") is None

def test_categorizar_almuerzo():
    assert categorizar_gasto("almuerzo en la soda del trabajo") == "comida"

def test_categorizar_bus():
    assert categorizar_gasto("tome el bus hasta el trabajo") == "transporte"

def test_categorizar_netflix():
    assert categorizar_gasto("Netflix mensual") == "servicios"

def test_calcular_total():
    assert calcular_total([8500, 3200, 12400]) == 24100

def test_calcular_total_vacio():
    assert calcular_total([]) == 0
'''
    dest.write_text(content, encoding="utf-8")
    ok(f"Test Python creado: {dest}")
    print(f"    → En el taller: correr los tests en {dest}")


# ── Caso 2: Vault de Obsidian con notas de muestra ───────────────────────────

NOTAS = {
    "Agentes IA y OpenClaw.md": f"""\
---
fecha: {TODAY}
tags: [agentes, IA, OpenClaw, arquitectura]
---

# Agentes IA y OpenClaw

Los agentes de IA son programas que usan un modelo de lenguaje para **tomar decisiones** sobre qué acciones ejecutar, no solo para generar texto.

La diferencia con un chatbot normal:
- Chatbot: recibe texto → genera texto → fin
- Agente: recibe texto → razona → decide acción → ejecuta → verifica → responde

## OpenClaw

OpenClaw es el runtime que gestiona el ciclo de vida del agente:
- Gateway WebSocket que recibe mensajes
- Canales de entrada (Telegram, web UI, API)
- Skills cargadas como contexto del sistema
- Workspace con memoria persistente

## Arquitectura de un mensaje

```
Usuario → canal (Telegram/web) → Gateway → LLM + Skills → Agente decide acción → Respuesta
```

## Conexiones
- [[Skills en OpenClaw]]
- [[Groq y los modelos de lenguaje]]
""",

    "Skills en OpenClaw.md": f"""\
---
fecha: {TODAY}
tags: [skills, OpenClaw, system-prompt, configuracion]
---

# Skills en OpenClaw

Una skill es un archivo Markdown (`SKILL.md`) que OpenClaw inyecta como **system prompt** al modelo de lenguaje.

Es el "manual de instrucciones" del agente, escrito en lenguaje natural.

## Estructura de una skill

```
---
name: nombre-skill
description: qué hace
---

# Nombre de la skill

Instrucciones para el agente...

## Comandos reconocidos
...

## Formato de respuesta
...
```

## Por qué funciona

El LLM recibe el contenido del SKILL.md como contexto antes de cada mensaje del usuario.
No hay código personalizado — solo instrucciones en español.

## Skills del taller

| Skill | Caso | Qué hace |
|---|---|---|
| expense-tracker | 1 | Registra gastos en CRC |
| second-brain | 2 | Gestiona notas Obsidian |
| pdf-extractor | 3 | Extrae datos de PDFs |
| dev-assistant | 4 | Ejecuta código Python |

## Conexiones
- [[Agentes IA y OpenClaw]]
- [[Groq y los modelos de lenguaje]]
""",

    "Groq y los modelos de lenguaje.md": f"""\
---
fecha: {TODAY}
tags: [groq, LLM, modelos, velocidad, API]
---

# Groq y los modelos de lenguaje

## ¿Qué es Groq?

Groq fabrica LPUs (Language Processing Units) — hardware especializado para inferencia de LLMs.
Resultado: respuestas en ~300ms con Llama 3.1 70B. Ideal para demos en vivo.

API compatible con OpenAI → cambio de proveedor sin reescribir código.

## Modelos disponibles (junio 2026)

| Modelo | Velocidad | Contexto | Uso recomendado |
|---|---|---|---|
| llama-3.1-70b-versatile | ~300ms | 128k | Taller (principal) |
| llama-3.1-8b-instant | ~80ms | 128k | Rate limit o demos rápidas |
| mixtral-8x7b | ~200ms | 32k | Alternativa |

## Rate limits (tier gratuito)

- 30 requests/minuto por modelo
- Si 20 personas usan el mismo modelo a la vez → throttling
- Solución: `llama-3.1-8b-instant` como fallback, o cada quien con su key

## Proveedores alternativos configurados

- **OpenRouter** — acceso a 100+ modelos, fallback automático
- **Ollama** — IA local en la Raspberry Pi, sin internet

## Conexiones
- [[Agentes IA y OpenClaw]]
- [[Skills en OpenClaw]]
""",

    "2026-06-10 Notas del taller.md": f"""\
---
fecha: {TODAY}
tags: [taller, notas, El Salvador]
---

# Notas del taller — {TODAY}

Primer taller de Agentes IA con OpenClaw en El Salvador.

## Ideas clave aprendidas

- Los agentes son más que chatbots: toman decisiones y ejecutan acciones
- Una skill es solo un archivo Markdown — no hay código
- Groq da velocidad de respuesta impresionante para demos en vivo
- El vault dashboard conecta visualmente el gateway con la audiencia

## Tareas pendientes

- [ ] Probar el expense-tracker con gastos reales
- [ ] Configurar el second-brain con mi vault de Obsidian personal
- [ ] Experimentar con el dev-assistant para automatizar tareas repetitivas

## Preguntas para explorar

- ¿Se puede conectar el expense-tracker con Google Sheets?
- ¿El second-brain puede leer PDFs directamente?
- ¿Cómo escalar a múltiples agentes especializados?

## Conexiones
- [[Agentes IA y OpenClaw]]
- [[Skills en OpenClaw]]
""",
}

def crear_vault(vault_dir: Path):
    vault_dir.mkdir(parents=True, exist_ok=True)
    creadas = 0
    for nombre, contenido in NOTAS.items():
        nota_path = vault_dir / nombre
        if not nota_path.exists():
            nota_path.write_text(contenido, encoding="utf-8")
            creadas += 1
    if creadas > 0:
        ok(f"Vault de Obsidian creado: {vault_dir} ({creadas} notas)")
    else:
        ok(f"Vault ya existe: {vault_dir}")
    print(f"    → En el taller: qué tengo sobre agentes IA")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n=== Setup de archivos demo para el taller ===\n")

    # Caso 3 — PDF
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    crear_factura_pdf(DEMO_DIR / "factura-ejemplo.pdf")

    # Caso 4 — Python
    crear_test_python(DEMO_DIR / "test_gastos.py")

    # Caso 2 — Second Brain
    crear_vault(VAULT_DIR)

    print()
    ok("Todo listo. Resumen:")
    print(f"    Caso 2 — vault:    {VAULT_DIR}")
    print(f"    Caso 3 — factura:  {DEMO_DIR}/factura-ejemplo.pdf")
    print(f"    Caso 4 — tests:    {DEMO_DIR}/test_gastos.py")
    print()


if __name__ == "__main__":
    main()
