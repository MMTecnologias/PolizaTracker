1.- habilitar la carga automatica de los recibos, con el 10% de comisión por default y cargar el derecho de poliza que viene en el doc directamente y el calculo de los recibos habilitando los campos para ya solo para que le den click en guardar o bien modificar algun dato
2.- habilitar la carga y la lectura de las polizas cuando se vaya a renovar una poliza o bien al crear un nuevo endoso
3.- el modelo y la marca del coche debe estar en observaciones tambien
4.- añadir el boton del area de acciones para ver el documento pdf de la poliza cargada al sistema
5.- guardar los documentos en otro disco duro, no en C:

Gastos de expedición/DErecho de poliza

PENDIENTES - Extraccion de PDF con Ollama:
0.- Feature de extraccion automatica de datos de polizas desde PDF,
    corriendo Ollama localmente (modelo llama3.1:8b). Codigo en
    flaskapp/app/polizas/routes.py y flaskapp/app/endosos/routes.py
    (buscar "ollama"/"llama3" en esos archivos para ubicarlo).
    BUG CONOCIDO (nivel de detalle limitado -- esto se documento desde
    un resumen de conversacion anterior, no de una revision de codigo
    en vivo como los demas puntos de este archivo, asi que falta
    verificar los detalles exactos cuando se retome):
      - El preprocesamiento con regex (que corre ANTES o EN PARALELO al
        resultado de Ollama) esta pisando/sobreescribiendo lo que
        Ollama extrae correctamente, causando errores como:
          * confundir "suma asegurada" con "prima_neta"
          * fechas mal extraidas
          * el nombre del agente terminando en el campo de aseguradora
    ESTADO: arreglo pausado, en espera de que el cliente mande PDFs de
    muestra de las 24 aseguradoras que maneja, cubriendo los 10 ramos y
    32 subramos que usa el sistema -- sin esa muestra representativa no
    se puede validar bien el fix contra casos reales variados.
    SIGUIENTE PASO: cuando lleguen los PDFs de muestra, revisar a fondo
    el codigo real (linea por linea, como se hizo con renovacion) antes
    de tocar nada.

PENDIENTES - Portal del Asegurado (rama portal-asegurado):
6.- SEGURIDAD: /portal/api/mis-datos, /portal/api/buscar-cliente y /portal/descargar_pdf
    no tienen ningun control de acceso (cualquiera con el link puede ver/descargar
    datos de cualquier cliente). Esto es TEMPORAL mientras no existe el login del
    asegurado. En cuanto se defina el login (folio+apellido / correo / registro),
    hay que:
      - Quitar el buscador de cliente del dashboard.
      - Que esas 3 rutas tomen el cliente desde la sesion, no desde parametros
        de la URL (cliente_id / poliza_id abiertos).

PENDIENTES - Revision de renovacion de polizas:
7.- YA HECHO: se probo el flujo completo de renovar/crear/endoso/editar
    en el sistema real (varias rondas), se encontraron y corrigieron 5
    bugs adicionales durante las pruebas. De los 8 hallazgos originales
    de la revision, 4 quedan SIN resolver -- ver el detalle tecnico
    completo (ubicacion exacta en codigo, por que es un problema, y
    siguiente paso) en flaskapp/REVISION_RENOVACION_PENDIENTES.md:
      - Posible traslape de 1 dia en vigencia al renovar
      - Nombres de campos duplicados poliza-anterior/polizaAnterior
      - Validacion de folio duplicado podria bloquear renovaciones legitimas
      - Prints de debug sueltos (24 restantes)
8.- Los recibos de los endosos no estan jalando correctamente. Pendiente
    de platicar el detalle exacto del problema antes de diagnosticar/
    programar el fix (que datos salen mal: montos, fechas, cantidad de
    recibos, si es tipo A, D, o ambos).
