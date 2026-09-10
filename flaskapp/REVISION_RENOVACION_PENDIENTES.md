# Revisión de Renovación de Pólizas — Puntos Pendientes

Este documento contiene el detalle completo de los hallazgos que quedaron
SIN resolver de la revisión a fondo del flujo de renovación de pólizas
(crear/renovar/endoso/editar). Se escribió aquí, en el repo, para que no
se pierda el contexto técnico exacto — antes solo vivía en una
conversación de chat.

Ya resueltos y NO incluidos aquí (ver historial de commits en
`fix-renovación-polizas`, ya fusionada a `design-fixing`):
- Métrica "Pólizas Renovadas" usaba `Poliza_renovada` en vez de
  `poliza_anterior` (Dashboard Gerencial).
- Mensaje de error con `renovacion` vacío + script de backfill histórico.
- Condición de carrera por doble clic (bloqueo de fila + transacción
  atómica en crear/renovar/endoso/editar).
- Bug crítico: `poliza_id` se reseteaba a `"New"` justo antes de guardar,
  rompiendo la detección de renovaciones duplicadas.
- Validación de longitud del número de póliza (máx 30 caracteres).
- Validación temprana (`/polizas/check_renovada`) al hacer clic en
  "Renovar", antes de abrir el formulario.
- Flujo "Editar y regenerar recibos": el borrado de recibos viejos ya no
  ocurre antes de que el usuario confirme el modal.

---

## 1. ✅ RESUELTO — Traslape de 1 día en la vigencia al renovar (confirmado intencional)

**Archivo:** `flaskapp/app/static/assets/controladores/polizas.js`, línea 1544

```javascript
$('#VigenciaI').val(resp.data[0].fecha_termino);
```

**Qué pasa:** al abrir el formulario de renovación, la fecha de INICIO de
la póliza nueva se pre-llena con la fecha de FIN de la póliza vieja —
mismo día exacto, no el día siguiente.

**Decisión confirmada con el negocio (2026-09-10):** este comportamiento
es intencional. Se deja tal cual, sin cambios de código. No es un bug.

---

## 2. ✅ RESUELTO — Campos duplicados consolidados en uno solo

**Archivo:** `flaskapp/app/static/assets/controladores/polizas.js`,
`flaskapp/app/templates/polizas.html`

**Causa raíz encontrada:** el formulario se envía con `$('#form-polizas').serialize()`,
y jQuery `.serialize()` **excluye automáticamente los campos `disabled`**
— por eso existía el campo oculto duplicado (`#polizaAnterior`), como
workaround para que el valor sí llegara al servidor aunque el campo
visual estuviera deshabilitado.

**Solución aplicada:** se eliminó el campo oculto duplicado. El campo
visible (`#poliza-anterior`) ahora tiene `name="polizaAnterior"`
(el nombre que espera el backend) y usa `.prop('readonly', true/false)`
en vez de `.prop('disabled', true/false)` — los campos `readonly` SÍ se
incluyen en `.serialize()`, y visualmente se ven idénticos a los
`disabled` gracias al CSS de Bootstrap ya existente en el proyecto
(`.form-control[readonly]{background-color:#e9ecef}`), así que no hubo
que tocar ningún estilo.

Un solo campo, un solo `id`, sin duplicación ni riesgo de que se
desincronicen.

---

## 3. ✅ RESUELTO Y CONFIRMADO — Validación de folio duplicado ya no bloquea renovaciones legítimas

**Archivos:** `flaskapp/app/polizas/routes.py` (función `create()`),
`flaskapp/app/templates/polizas.html`, `flaskapp/app/static/assets/controladores/polizas.js`

**Confirmado con el negocio (2026-09-10):** sí, algunas aseguradoras
mantienen el mismo folio al renovar (cambia vigencia, forma de pago,
etc., pero el número de póliza es idéntico) — el `id` interno es
justamente lo que ya usan para diferenciar esas pólizas de mismo folio.

**Solución aplicada:** la validación de duplicados ahora excluye a la
póliza que se está renovando por su **`id` interno**, no por folio.

Se agregó un campo nuevo (`#old_poliza_id` / `oldPolizaId`) que guarda
el `id` real de la póliza vieja en el momento de dar clic en "Renovar"
— separado de `#poliza_id`, que se resetea a `"New"` antes de guardar.
El backend usa ese `id` para excluir específicamente ese registro de la
búsqueda de duplicados.

**Por qué NO se hizo por folio (primer intento, con bug):** un primer
intento excluía por comparación de folio (`poliza_anterior`) en vez de
por `id` — eso tenía un bug real: si de verdad existieran dos pólizas
DISTINTAS con el mismo número (el caso que sí se quiere seguir
bloqueando), ambas habrían quedado excluidas por error, dejando pasar
un duplicado real sin detectarlo. Corregido antes de confirmar.

**Verificado con el escenario exacto planteado por el cliente:**
renovar la póliza 1234 con el mismo número 1234 → pasa sin problema.
Si existiera otra póliza con `id` distinto también con folio 1234 →
sigue bloqueando correctamente.

---

## 4. ✅ RESUELTO Y CONFIRMADO — Prints de depuración convertidos al logger real

**Archivos:** `flaskapp/app/polizas/routes.py`, `flaskapp/app/__init__.py`

Se revisaron los 21 `print(...)` sueltos que quedaban fuera de las
funciones ya limpiadas en revisiones anteriores. Cada uno se clasificó:

- **Puro ruido sin valor** (IDs sueltos, un booleano sin etiqueta,
  `'entro en search value'`, etc.) → se borraron directamente.
- **Con valor real de diagnóstico** (fechas/duración de endosos, cálculo
  de pagos, `[CALCULAR_RECIBOS]`, advertencias de PDF vacío) →
  convertidos a `current_app.logger.debug(...)` / `.warning(...)`.
- **Manejo de excepciones** (`print(e)` dentro de un `except`) →
  convertidos a `current_app.logger.exception(...)`, que además
  registra el traceback completo (antes solo se veía el mensaje suelto).
- Se dejó **1 print intencional** (línea ~2137) como respaldo, solo
  para cuando la función corre fuera de un contexto de Flask (un script
  standalone) donde no hay logger disponible.

**Decisión confirmada con el cliente:** los mensajes convertidos a
`logger.debug(...)` seguían siendo útiles para "ir viendo cómo se va
dando el proceso" en la terminal — no se quería perder esa visibilidad
solo por prolijidad de código. Se agregó `app.logger.setLevel(logging.DEBUG)`
en `app/__init__.py`, que **garantiza** que todos esos mensajes se sigan
viendo en consola exactamente igual que antes, ahora con hora, nivel, y
tracebacks completos en los errores. Si en algún momento se quiere
silenciar ese detalle en producción, basta con subir ese nivel
(`logging.INFO` o `logging.WARNING`) en una sola línea.

---

