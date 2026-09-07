# Extracción de Datos de Póliza desde PDF (Ollama) — Pendiente

Este documento reemplaza la entrada vaga que había en `tasks.md` sobre este
tema. Lo anterior venía de un resumen de conversación, sin haber revisado
el código real. Esto sí es una revisión directa del código actual en
`flaskapp/app/polizas/routes.py`. `flaskapp/app/endosos/routes.py` no
tiene su propia copia de esta lógica — importa y reutiliza directamente
`call_ollama_model` desde `polizas/routes.py` (línea 339-369 de
`endosos/routes.py`), así que el mismo bug de abajo afecta a ambos flujos
por igual, sin duplicación de código que revisar por separado.

## Cómo funciona hoy (arquitectura real, confirmada en código)

1. Se extrae el texto crudo del PDF.
2. **En paralelo** corren 2 sistemas de extracción sobre ese mismo texto:
   - Un extractor basado en **regex** (funciones como `extract_prima_neta_value`,
     `extract_diagnostic_snippet`, y muchas más — hay decenas de patrones
     regex a lo largo del archivo, aprox. líneas 2394 a 3400+) que arma un
     diccionario `rule_hints`.
   - Ollama (`llama3.1:8b`, vía `call_ollama_model` → `query_ollama_json`,
     línea ~4954) que arma su propio diccionario `extracted_json`.
3. Ambos resultados se combinan en `merge_extraction_results(rule_hints, extracted_json)`
   (línea 4544).

## El bug confirmado — mecanismo exacto

Dentro de `merge_extraction_results`, línea ~4585:

```python
if key in ("prima_neta", "prima_total", "derecho_poliza", "gastos_expedicion"):
    ...
    merged[key] = rule_value or model_value
elif key in trusted_rule_fields:
    merged[key] = rule_value or model_value
else:
    merged[key] = model_value or rule_value
```

Donde `trusted_rule_fields` (línea ~4551) incluye:

```python
trusted_rule_fields = {
    "numero_de_poliza", "nombre_cliente", "rfc", "aseguradora", "agente",
    "ramo", "desde", "hasta", "forma_de_pago", "prima_neta", "prima_total",
    "moneda", "endoso", "derecho_poliza", "gastos_expedicion",
    "descripcion", "numero_serie"
}
```

**Es decir:** para casi todos los campos importantes, el valor que sacó el
**regex gana automáticamente sobre lo que dijo Ollama**, con tal de que el
regex haya encontrado ALGO (aunque sea el dato equivocado). Solo si el
regex no encontró nada (`rule_value` vacío/falsy) se usa lo que dijo Ollama.
Esto confirma exactamente el síntoma reportado ("el preprocesamiento con
regex pisa lo que Ollama extrae correctamente").

### Por qué esto puede confundir "suma asegurada" con "prima_neta"

En `extract_prima_neta_value` (línea ~2966), la cascada de patrones que
busca la prima neta es:

```python
direct_labels = [
    r'Prima neta',
    r'Prima del movimiento',
    r'Prima básica',
    r'Prima base',
    r'Prima'          # <- último recurso: solo la palabra "Prima" sola
]
```

El **último patrón de la cascada es literalmente la palabra "Prima" sin
más contexto** — si el layout de un PDF de una aseguradora en particular
no calza con los patrones más específicos de arriba, este último patrón
puede terminar agarrando un monto que esté cerca de la palabra "Prima" en
el documento pero que en realidad corresponda a otro concepto (por
ejemplo, si "Suma Asegurada" aparece cerca de la palabra "Prima" en el
layout de esa aseguradora en particular).

Existe una validación posterior (`sanitize_premium_fields`, línea 2952,
que usa `is_suspicious_premium_amount` para descartar montos que se ven
sospechosos) pero evidentemente no atrapa todos los casos reales.

## Qué NO se alcanzó a confirmar todavía

- **Fechas mal extraídas**: hay múltiples patrones regex de fecha (líneas
  2743-2833, con varios formatos: `dd/mm/aaaa`, fechas con espacios, meses
  en texto, formato "de"). No se identificó cuál patrón específico falla
  ni con qué aseguradora — falta reproducir el caso real.
- **Nombre del agente terminando en el campo de aseguradora**: hay lógica
  específica para extraer agente cerca de líneas 3277-3350 con manejo de
  "Ant." (antigüedad) como ruido a evitar, pero no se rastreó el caso
  exacto donde el agente termina en el campo equivocado.

## Por qué se pausó el arreglo

Este sistema de extracción tiene que funcionar con PDFs de **24
aseguradoras distintas**, cubriendo **10 ramos y 32 subramos** — cada
aseguradora tiene su propio layout de documento. Ajustar los patrones
regex (o cambiar la prioridad regex-vs-Ollama) sin tener ejemplos reales
de varias aseguradoras corre el riesgo de arreglar un caso y romper otros
3 sin darse cuenta.

## Siguiente paso

Cuando lleguen los PDFs de muestra:
1. Correr la extracción real sobre cada uno y comparar contra los datos
   correctos esperados, documentando exactamente qué campo falla y con
   qué aseguradora/layout.
2. Decidir si la solución es: ajustar/eliminar patrones regex demasiado
   genéricos (como la palabra suelta "Prima"), invertir la prioridad
   (que Ollama gane por default y el regex solo se use como respaldo si
   Ollama no encontró nada), o un enfoque híbrido por campo.
