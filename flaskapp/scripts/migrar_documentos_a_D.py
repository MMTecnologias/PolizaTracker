# flaskapp/scripts/migrar_documentos_a_D.py
"""
Script de UNA SOLA VEZ: copia (no mueve) todos los documentos ya
subidos al sistema -- PDF general de póliza, factura de póliza, aviso
de cobro y complemento de pago de cada recibo -- hacia la nueva
carpeta organizada (DOCUMENTOS_BASE_PATH en config.py, ej.
D:/PolizaTracker/Documentos), estructurada por cliente > póliza >
categoría.

Los archivos originales NO se borran de donde estaban -- así, si algo
sale mal, no se pierde nada. Una vez confirmado que todo quedó bien
en la nueva ubicación, se pueden borrar a mano las carpetas viejas
cuando se quiera.

Cuando el valor guardado en la base de datos no corresponde a un
archivo real que se pudo encontrar (ya sea porque es texto viejo tipo
"TC"/"transfer", o porque parece un nombre de archivo real pero no
se encontró en disco), con --aplicar ese campo se deja vacío --
así el botón correspondiente en el sistema vuelve a mostrar "Cargar"
en vez de "Ver/Descargar", listo para que se pueda subir el
documento correcto de nuevo sin quedar "atorado" con una referencia
rota.

REQUISITO PREVIO:
- Las 3 migraciones SQL de esta seguidilla de cambios ya corridas
  (migracion_complemento_pago.sql, migracion_nombres_originales_
  documentos.sql, migracion_factura_poliza.sql).
- DOCUMENTOS_BASE_PATH definido en config.py.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no copia ni modifica nada, solo reporta qué
    encontró, a dónde lo copiaría, y qué campos quedarían vacíos --
    para revisar con calma antes de tocar nada:
        python scripts/migrar_documentos_a_D.py

    Modo real, copia y limpia de verdad:
        python scripts/migrar_documentos_a_D.py --aplicar
"""
import sys
import os
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import Cliente, Poliza, Recibo
from app.utils.document_storage import get_carpeta_documento

# Nombres reales de documentos SIEMPRE terminan en .pdf o .xml --
# vienen de dos orígenes distintos: los generados por el sistema (ej.
# r14403_3f098a09.pdf, cp99_a1b2c3d4.xml) y los más viejos, que
# conservan (normalizado) el nombre original con el que se subieron
# (ej. sergio_lopez_bonilla_1002000007277_cf367e0a.pdf). Cualquier
# valor SIN extensión .pdf/.xml (como "TC", "tc", "transfer") es dato
# viejo que no corresponde a un archivo real -- probablemente una
# anotación manual de antes de que existiera la función de subir
# documentos.
_EXTENSIONES_VALIDAS = ('.pdf', '.xml')


def _parece_archivo_real(valor):
    return bool(valor) and valor.lower().endswith(_EXTENSIONES_VALIDAS)


def _ruta_vieja_recibo_comprobante(recibo):
    return os.path.join(
        app.root_path, 'static', 'recibos_comprobantes', recibo.comprobante)


def _ruta_vieja_recibo_complemento(recibo, campo):
    filename = getattr(recibo, campo)
    return os.path.join(
        app.root_path, 'static', 'recibos_complementos_pago', filename)


def _ruta_vieja_poliza_factura(campo_valor):
    return os.path.join(
        app.root_path, 'static', 'polizas_facturas', campo_valor)


def _ruta_vieja_poliza_pdf(pdf_path):
    if os.path.isabs(pdf_path):
        return pdf_path
    return os.path.join(app.root_path, 'static', pdf_path)


def _es_pdf_path_esquema_nuevo(pdf_path):
    return (not os.path.isabs(pdf_path)
            and '/' not in pdf_path and '\\' not in pdf_path)


def _limpiar_campo(objeto, campo, campo_original, valor_vacio, aplicar, limpiados, motivo):
    """Deja vacío el campo (y su _original, si tiene) para que el botón
    correspondiente vuelva a mostrar 'Cargar'."""
    limpiados.append({
        'tabla': type(objeto).__name__,
        'id': objeto.id,
        'campo': campo,
        'valor_anterior': getattr(objeto, campo),
        'motivo': motivo,
    })
    if aplicar:
        setattr(objeto, campo, valor_vacio)
        if campo_original:
            setattr(objeto, campo_original, None)


def _procesar(origen, destino_folder, filename, aplicar, reporte,
              objeto, campo, campo_original, valor_vacio, limpiados):
    if not _parece_archivo_real(filename):
        _limpiar_campo(objeto, campo, campo_original, valor_vacio, aplicar, limpiados,
                        motivo=f"valor '{filename}' no es un nombre de archivo (sin .pdf/.xml)")
        return

    destino = os.path.join(destino_folder, filename)
    existe_origen = os.path.exists(origen)
    reporte.append({
        'origen': origen,
        'destino': destino,
        'existe_origen': existe_origen,
    })
    if not existe_origen:
        _limpiar_campo(objeto, campo, campo_original, valor_vacio, aplicar, limpiados,
                        motivo=f"'{filename}' parece un archivo real pero no se encontró en disco")
        return

    if aplicar:
        shutil.copy2(origen, destino)


def migrar(aplicar=False):
    with app.app_context():
        reporte = []
        limpiados = []
        clientes_cache = {}

        def cliente_de(poliza):
            if poliza.cliente_id not in clientes_cache:
                clientes_cache[poliza.cliente_id] = Cliente.query.get(poliza.cliente_id)
            return clientes_cache[poliza.cliente_id]

        # --- Pólizas: PDF general + factura ---
        polizas = Poliza.query.all()
        for poliza in polizas:
            cliente = cliente_de(poliza)

            if poliza.pdf_path and _es_pdf_path_esquema_nuevo(poliza.pdf_path):
                # Ya está en esquema nuevo (subido después de este cambio,
                # o ya migrado antes) -- no hay nada que migrar.
                pass
            elif poliza.pdf_path:
                origen = _ruta_vieja_poliza_pdf(poliza.pdf_path)
                filename = os.path.basename(poliza.pdf_path)
                destino_folder = get_carpeta_documento(cliente, poliza, 'documento_poliza')
                antes = len(reporte)
                # pdf_path es NOT NULL en la base de datos -- se deja
                # como cadena vacía, no None, cuando hay que limpiarlo.
                _procesar(origen, destino_folder, filename, aplicar, reporte,
                          poliza, 'pdf_path', None, '', limpiados)
                if aplicar and len(reporte) > antes and reporte[-1]['existe_origen']:
                    poliza.pdf_path = filename

            if poliza.factura_pdf:
                origen = _ruta_vieja_poliza_factura(poliza.factura_pdf)
                destino_folder = get_carpeta_documento(cliente, poliza, 'factura')
                _procesar(origen, destino_folder, poliza.factura_pdf, aplicar, reporte,
                          poliza, 'factura_pdf', 'factura_pdf_original', None, limpiados)

            if poliza.factura_xml:
                origen = _ruta_vieja_poliza_factura(poliza.factura_xml)
                destino_folder = get_carpeta_documento(cliente, poliza, 'factura')
                _procesar(origen, destino_folder, poliza.factura_xml, aplicar, reporte,
                          poliza, 'factura_xml', 'factura_xml_original', None, limpiados)

        # --- Recibos: aviso de cobro + complemento de pago ---
        recibos = Recibo.query.all()
        for recibo in recibos:
            poliza = Poliza.query.get(recibo.poliza_id)
            if not poliza:
                continue
            cliente = cliente_de(poliza)

            if recibo.comprobante:
                origen = _ruta_vieja_recibo_comprobante(recibo)
                destino_folder = get_carpeta_documento(
                    cliente, poliza, 'aviso_cobro', recibo=recibo)
                _procesar(origen, destino_folder, recibo.comprobante, aplicar, reporte,
                          recibo, 'comprobante', 'comprobante_original', None, limpiados)

            if recibo.complemento_pago_pdf:
                origen = _ruta_vieja_recibo_complemento(recibo, 'complemento_pago_pdf')
                destino_folder = get_carpeta_documento(
                    cliente, poliza, 'complemento_pago', recibo=recibo)
                _procesar(origen, destino_folder, recibo.complemento_pago_pdf, aplicar, reporte,
                          recibo, 'complemento_pago_pdf', 'complemento_pago_pdf_original',
                          None, limpiados)

            if recibo.complemento_pago_xml:
                origen = _ruta_vieja_recibo_complemento(recibo, 'complemento_pago_xml')
                destino_folder = get_carpeta_documento(
                    cliente, poliza, 'complemento_pago', recibo=recibo)
                _procesar(origen, destino_folder, recibo.complemento_pago_xml, aplicar, reporte,
                          recibo, 'complemento_pago_xml', 'complemento_pago_xml_original',
                          None, limpiados)

        # --- Reporte ---
        faltantes = [r for r in reporte if not r['existe_origen']]
        copiados_ok = [r for r in reporte if r['existe_origen']]

        print(f"\n{'='*90}")
        print(f"Documentos reales encontrados: {len(reporte)}  "
              f"(OK: {len(copiados_ok)} / no encontrados en disco: {len(faltantes)})")
        print(f"Campos que quedarían vacíos (listos para volver a subir): {len(limpiados)}")
        print(f"{'='*90}\n")

        for r in reporte:
            estado = "OK" if r['existe_origen'] else "!! NO ENCONTRADO, SE LIMPIARÁ !!"
            print(f"[{estado}]")
            print(f"  Origen : {r['origen']}")
            print(f"  Destino: {r['destino']}")
            print()

        if limpiados:
            print(f"{'='*90}")
            print(f"CAMPOS A LIMPIAR ({len(limpiados)}) -- se dejan vacíos para que el botón "
                  f"correspondiente vuelva a mostrar 'Cargar':")
            print(f"{'='*90}")
            for l in limpiados:
                print(f"  {l['tabla']} #{l['id']} . {l['campo']}: "
                      f"'{l['valor_anterior']}' -> vacío  ({l['motivo']})")
            print()

        if not aplicar:
            print("MODO DE PRUEBA -- no se copió ni se modificó nada todavía.")
            print("Revisa el reporte de arriba con calma. Si todo se ve correcto, "
                  "vuelve a correr con --aplicar para copiar los archivos reales y "
                  "limpiar las referencias rotas de verdad.\n")
        else:
            from app import db
            db.session.commit()
            print(f"LISTO -- se copiaron {len(copiados_ok)} archivo(s) a "
                  f"{app.config.get('DOCUMENTOS_BASE_PATH')}, y se limpiaron "
                  f"{len(limpiados)} referencia(s) rota(s) (sus botones ya están "
                  f"listos para volver a subir el documento correcto).")
            print("Los archivos originales NO se borraron -- puedes limpiarlos a mano "
                  "una vez que confirmes que todo quedó bien.\n")


if __name__ == '__main__':
    aplicar = '--aplicar' in sys.argv
    migrar(aplicar=aplicar)
