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

## 1. Posible traslape de 1 día en la vigencia al renovar

**Archivo:** `flaskapp/app/static/assets/controladores/polizas.js`, línea 1544

```javascript
$('#VigenciaI').val(resp.data[0].fecha_termino);
```

**Qué pasa:** al abrir el formulario de renovación, la fecha de INICIO de
la póliza nueva se pre-llena con la fecha de FIN de la póliza vieja —
mismo día exacto, no el día siguiente. Esto deja un día donde,
técnicamente, ambas pólizas (la vieja y la nueva) están vigentes al
mismo tiempo.

**Por qué no se corrigió:** puede ser intencional (algunas aseguradoras
manejan la renovación así, sin "brincarse" un día) — nunca se confirmó
con el negocio si debería ser `fecha_termino + 1 día` en su lugar.

**Siguiente paso:** confirmar con el cliente/negocio cuál es el
comportamiento correcto antes de tocar el código.

---

## 2. Nombres de campos duplicados y confusos (poliza-anterior / polizaAnterior)

**Archivo:** `flaskapp/app/static/assets/controladores/polizas.js`

Hay 2 inputs con nombres casi idénticos que se actualizan en paralelo, en
al menos 3 lugares distintos del archivo:

```javascript
// línea 214-215 (lectura)
const previousPolicyValue = $('#polizaAnterior').val();
const previousPolicyDisplayValue = $('#poliza-anterior').val();

// línea 382-383 (restauración)
$('#polizaAnterior').val(previousPolicyValue);
$('#poliza-anterior')...

// línea 1054-1055 (reset)
$('#polizaAnterior').val('');
$('#poliza-anterior').val('').prop('disabled', false);

// línea 1539-1540 (al renovar)
$('#polizaAnterior').val(resp.data[0].poliza);
$('#poliza-anterior').val(resp.data[0].poliza).prop('disabled', true);
```

**Qué pasa:** `#polizaAnterior` es el campo que realmente se manda al
servidor (el que tiene `name="polizaAnterior"` en el HTML); `#poliza-anterior`
parece ser solo un campo de DESPLIEGUE visual, deshabilitado, para que el
usuario lo vea pero no lo edite. Funcionalmente parece funcionar hoy, pero
es frágil: cualquier cambio futuro que solo actualice uno de los dos
(por error) rompería silenciosamente la sincronización entre lo que se ve
en pantalla y lo que realmente se guarda.

**Siguiente paso:** decidir si de verdad se necesitan 2 campos separados
(uno oculto/real + uno visual/deshabilitado), o si se puede simplificar a
uno solo con un solo `id`, ajustando el CSS/HTML según haga falta.

---

## 3. La validación de folio duplicado podría bloquear renovaciones legítimas

**Archivo:** `flaskapp/app/polizas/routes.py`, líneas 416-418

```python
poliza = Poliza.query.filter(
    Poliza.poliza == arg_values["poliza"], Poliza.status != "Cancelada").first()
if poliza:
    return jsonify({'error': True, 'msg': f'Ya existe una póliza vigente con el mismo número {poliza.poliza}', 'title': 'Ya existe una póliza vigente con el mismo número'})
```

**Qué pasa:** si el número de póliza de la renovación es IGUAL al de la
póliza original (algunas aseguradoras mantienen el mismo folio entre
renovaciones, solo cambiando el endoso o el periodo), esta validación
bloquearía la renovación por completo, ya que técnicamente "ya existe"
una póliza vigente con ese mismo número (la vieja, hasta que se marque
como renovada).

**Por qué no se corrigió:** nunca se confirmó si esto pasa en la
práctica con las aseguradoras que maneja la agencia — depende del
negocio, no es algo que se pueda decidir solo revisando el código.

**Siguiente paso:** preguntar directamente si hay casos reales donde el
folio se repite entre la póliza vieja y su renovación. Si sí, hay que
excluir explícitamente a `poliza_old` de esta validación cuando el
`poliza_id` que se está renovando coincide.

---

## 4. Prints de depuración sueltos en producción

**Archivo:** `flaskapp/app/polizas/routes.py`

Quedan **24 líneas** con `print(...)` sueltas fuera de las funciones que
ya se tocaron en esta revisión (`create()`, `create_endoso()`, `edit()`,
`save_receipts()`, que ya se limpiaron). Algunos ejemplos:

```python
# línea 32
print(f"Poliza ID: {poliza_id}")

# línea 45
print(f"Endoso ID: {endoso_id}")

# línea 187
print('entro en search value')

# líneas 732-735, 781-782 (varios "DEBUG - ...")
print(f"DEBUG - Fecha inicio: {start_date}, Fecha fin: {end_date}")
print(f"DEBUG - Duración en meses: {policy_duration_months}")
```

**Qué pasa:** son prints de depuración que quedaron de desarrollo,
imprimiendo directo a la consola del servidor en producción. No rompen
nada, pero ensucian los logs y no siguen ninguna convención (no usan el
logger real de Flask, `current_app.logger`, que sí se empezó a usar en
las partes que se corrigieron esta revisión).

**Siguiente paso:** revisar cada uno y decidir: borrarlo, o convertirlo a
`current_app.logger.debug(...)` si de verdad aporta valor para
diagnosticar problemas en producción.

---

## Endosos: recibos no jalan correctamente (hallazgo separado, más reciente)

Este NO es parte de la lista de 4 puntos de arriba — es un hallazgo
posterior, encontrado durante las pruebas del flujo completo. Falta
platicar el detalle exacto antes de diagnosticar (qué datos salen mal:
montos, fechas, cantidad de recibos, si es endoso tipo A, D, o ambos).
