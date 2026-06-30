# Caso 3: PDF Extractor — Documentos a datos estructurados

**Tiempo estimado:** 25–35 minutos  
**Dificultad:** Intermedio  
**Modelo:** OpenRouter — gpt-4o-mini (key compartida del taller)  
**Plataforma:** Cualquier (web UI, Telegram, CLI)

---

## ¿Qué vas a construir?

Un agente que extrae texto de archivos PDF, identifica datos relevantes (tablas, montos, fechas, nombres) y los presenta en formato estructurado o CSV listo para Excel — todo por chat.

---

## Requisitos previos

- [ ] Instalador global ejecutado (`bash setup/install.sh`) → chatbot funcionando
- [ ] OpenRouter configurado (`OPENROUTER_API_KEY` en `.env`) → gpt-4o-mini
- [ ] `pdftotext` instalado (parte de `poppler-utils`) — instalalo ANTES del caso
- [ ] Caso instalado con `bash casos/pdf-extractor/install.sh`

```bash
# Linux / Raspberry Pi
sudo apt install poppler-utils

# CachyOS / Arch
sudo pacman -S poppler

# Verificar
pdftotext --version
```

---

## Paso 1 — Verificar que el gateway está activo (2 min)

```bash
systemctl --user status openclaw-gateway.service
bash setup/open-dashboard.sh
```

---

## Paso 2 — Confirmar la skill está disponible (2 min)

En el chat:

```
/skills
```

Verificar que `pdf-extractor 📄` aparece. Si no, corré el instalador del caso (avisa
si falta `pdftotext`):

```bash
bash casos/pdf-extractor/install.sh    # Windows: .\casos\pdf-extractor\install.ps1
```

---

## Paso 3 — Procesar tu primer PDF (10 min)

Conseguir un PDF de prueba (factura, recibo, contrato, informe — cualquiera sirve).

### Opción A: Indicar la ruta

```
procesar /home/usuario/Descargas/factura-ejemplo.pdf
```

### Opción B: Pegar texto directamente

Si ya tenés el texto extraído:

```
analizar este documento: [texto del PDF]
```

---

## Paso 4 — Resumir el documento (5 min)

```
resumir este PDF
```

**Respuesta esperada:**
```
Tipo: Factura comercial
Emisor: Empresa XYZ S.A.
Receptor: Juan Pérez
Fecha: 2026-05-15
Total: $1,250.00

Puntos clave:
• 3 líneas de detalle (servicios de consultoría)
• IVA 13% incluido
• Vence en 30 días
```

---

## Paso 5 — Extraer una tabla (8 min)

```
extraer la tabla de datos de este documento
```

El agente identifica filas y columnas por alineación y presenta como tabla Markdown:

```
| Descripción          | Cantidad | Precio Unit. | Total    |
|----------------------|----------|--------------|----------|
| Consultoría Fase 1   | 10 hrs   | $85.00       | $850.00  |
| Documentación        | 5 hrs    | $65.00       | $325.00  |
| Revisión final       | 1        | $75.00       | $75.00   |
```

Luego:

```
exportar esto como CSV
```

El CSV se guarda en `~/.openclaw/workspace/exports/YYYY-MM-DD_nombre.csv`.

---

## Paso 6 — Procesar una factura (5 min)

```
procesar esta factura
```

El agente extrae automáticamente: número de factura, fecha, emisor, receptor, líneas de detalle, impuestos, total.

---

## Paso 7 — Extraer datos específicos (5 min)

```
extraer todas las fechas del documento
```

```
listar todos los montos que aparecen
```

```
qué nombres propios aparecen en el contrato
```

---

## Paso 8 — Ver el CSV exportado (2 min)

```bash
ls ~/.openclaw/workspace/exports/
cat ~/.openclaw/workspace/exports/2026-06-10_factura.csv
```

Abrir en LibreOffice Calc o Google Sheets — los datos quedan limpios y listos para análisis.

---

## ¿Qué aprendiste?

- **pdftotext + LLM = OCR semántico:** La combinación extrae datos con comprensión del contexto, no solo texto crudo
- **Documentos no estructurados → datos estructurados:** El agente infiere qué datos son relevantes según el tipo de documento
- **Flag `-layout` de pdftotext:** Preserva columnas y tablas para facilitar la extracción
- **Limitación de PDFs escaneados:** Sin OCR adicional, los PDFs de imagen no se pueden procesar

---

## Próximos pasos

- [ ] Automatizar el procesamiento de facturas mensuales
- [ ] Combinar con expense-tracker: extraer total de factura y registrar como gasto
- [ ] Procesar un contrato y extraer cláusulas clave
- [ ] Configurar una carpeta de entrada para procesar PDFs automáticamente

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `pdftotext: command not found` | `sudo apt install poppler-utils` (Linux) |
| PDF devuelve texto vacío | El PDF puede estar escaneado — indica "está escaneado" |
| Tabla no se detecta bien | Probar con `-layout` explícito o pedir "extraer manualmente" |
| CSV no se crea | Crear directorio: `mkdir -p ~/.openclaw/workspace/exports` |
| Gateway caído | `systemctl --user restart openclaw-gateway.service` |
