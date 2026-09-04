1.- habilitar la carga automatica de los recibos, con el 10% de comisión por default y cargar el derecho de poliza que viene en el doc directamente y el calculo de los recibos habilitando los campos para ya solo para que le den click en guardar o bien modificar algun dato
2.- habilitar la carga y la lectura de las polizas cuando se vaya a renovar una poliza o bien al crear un nuevo endoso
3.- el modelo y la marca del coche debe estar en observaciones tambien
4.- añadir el boton del area de acciones para ver el documento pdf de la poliza cargada al sistema
5.- guardar los documentos en otro disco duro, no en C:

Gastos de expedición/DErecho de poliza

PENDIENTES - Portal del Asegurado (rama portal-asegurado):
6.- SEGURIDAD: /portal/api/mis-datos, /portal/api/buscar-cliente y /portal/descargar_pdf
    no tienen ningun control de acceso (cualquiera con el link puede ver/descargar
    datos de cualquier cliente). Esto es TEMPORAL mientras no existe el login del
    asegurado. En cuanto se defina el login (folio+apellido / correo / registro),
    hay que:
      - Quitar el buscador de cliente del dashboard.
      - Que esas 3 rutas tomen el cliente desde la sesion, no desde parametros
        de la URL (cliente_id / poliza_id abiertos).
