# Caso 4: Dev Assistant — El agente que ejecuta código de verdad

**Tiempo estimado:** 25–35 minutos  
**Dificultad:** Avanzado  
**Modelo:** OpenRouter — Llama 3.3 70B (key compartida del taller)  
**Plataforma:** Linux / Raspberry Pi / WSL2

---

## ¿Qué vas a construir?

Un asistente de desarrollo que no solo sugiere código — lo ejecuta, verifica el output y propone fixes si falla. Puede correr scripts Python, analizar tracebacks, ejecutar tests y refactorizar código, todo desde el chat.

---

## Requisitos previos

- [ ] OpenClaw instalado y gateway corriendo (`node setup/check.js`)
- [ ] Groq configurado (verificar con `node setup/check.js`)
- [ ] Skill `dev-assistant` instalada en el workspace
- [ ] Python 3 instalado (`python3 --version`)

```bash
# Si no tenés Python
sudo apt install python3 python3-pip   # Debian/Ubuntu/Pi
sudo pacman -S python                   # CachyOS/Arch
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

Verificar que `dev-assistant 💻` aparece. Si no:

```bash
mkdir -p ~/.openclaw/workspace/skills/dev-assistant
cp -r skills/dev-assistant/. ~/.openclaw/workspace/skills/dev-assistant/
```

---

## Paso 3 — Ejecutar código simple (5 min)

```
ejecutar este código:
print("Hola desde el agente")
for i in range(5):
    print(f"  iteración {i+1}")
```

**Respuesta esperada:**
```
Ejecutando Python...

Hola desde el agente
  iteración 1
  iteración 2
  iteración 3
  iteración 4
  iteración 5

✓ Código ejecutado sin errores.
```

> **¿Qué está pasando?** El agente guarda el código en un archivo temporal en `/tmp/`, lo ejecuta con `python3` y te muestra el output real — no simulado.

---

## Paso 4 — Analizar un error (8 min)

Enviar este código con un bug intencional:

```
ejecutar este código:
numeros = [1, 2, 3, 4, 5]
total = sum(numeros)
promedio = total / len(numeros)
print(f"Promedio: {promedio}")
print(f"Máximo: {max(numeros)}")
numeros.append("texto")
print(f"Nuevo promedio: {sum(numeros) / len(numeros)}")
```

El agente va a detectar el `TypeError` y responder:

```
Error detectado:
  TypeError: unsupported operand type(s) for +: 'int' and 'str'
  → Línea 8: sum(numeros) con una lista mezclada int/str

Causa: Se agregó "texto" (string) a una lista de números. 
sum() no puede operar con tipos mixtos.

Fix propuesto:
  numeros.append(6)   # usar un número, no un string

¿Pruebo el fix? (sí/no)
```

---

## Paso 5 — Instalar una dependencia (5 min)

```
instalar requests
```

El agente pide confirmación, luego:

```bash
pip install requests
```

Verifica que la instalación fue exitosa mostrando el output de pip.

---

## Paso 6 — Correr tests (8 min)

Crear un archivo de test de ejemplo:

```bash
cat > /tmp/test_calculadora.py << 'EOF'
def suma(a, b): return a + b
def resta(a, b): return a - b
def dividir(a, b): return a / b

def test_suma():        assert suma(2, 3) == 5
def test_resta():       assert resta(5, 2) == 3
def test_dividir_ok():  assert dividir(10, 2) == 5.0
def test_dividir_cero():
    import pytest
    with pytest.raises(ZeroDivisionError):
        dividir(1, 0)
EOF
```

En el chat:

```
correr los tests en /tmp/test_calculadora.py
```

El agente ejecuta pytest y muestra:

```
Resultados de tests:
  ✓ test_suma         PASSED
  ✓ test_resta        PASSED
  ✓ test_dividir_ok   PASSED
  ✓ test_dividir_cero PASSED

4 passed in 0.12s
```

---

## Paso 7 — Refactorizar código (5 min)

```
refactorizar esto:
def f(x,y,z):
    if x>0:
        if y>0:
            return x*y+z
        else:
            return z
    else:
        return 0
```

El agente muestra el diff y la versión mejorada antes de aplicar cambios.

---

## ¿Qué aprendiste?

- **LLM + ejecución real = asistente honesto:** No puede mentir sobre el output porque lo ejecuta de verdad
- **Ciclo debug → fix → verificar:** El agente cierra el loop completo en una sola conversación
- **Seguridad por diseño:** La skill define qué comandos requieren confirmación (`rm`, `sudo`, POST a internet)
- **Casos reales:** Ideal para automatizar tareas repetitivas, analizar scripts existentes o aprender de errores

---

## Próximos pasos

- [ ] Modificar `SKILL.md` para agregar soporte a otros lenguajes (Node.js, bash)
- [ ] Agregar integración con tu editor de código favorito vía Telegram
- [ ] Crear un script que el agente optimice iterativamente
- [ ] Combinar con pdf-extractor: extraer datos de un PDF y procesarlos con Python

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `python3: command not found` | `sudo apt install python3` |
| `pytest: command not found` | `pip install pytest` |
| El agente ejecuta sin pedir confirmación | Verificar que el SKILL.md esté cargado correctamente |
| Output truncado en el chat | Para scripts largos, guardar output en archivo y leer con `cat` |
| Gateway caído | `systemctl --user restart openclaw-gateway.service` |
