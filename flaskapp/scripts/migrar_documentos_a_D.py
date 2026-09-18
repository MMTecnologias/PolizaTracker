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

REQUISITO PREVIO:
- Las 3 migraciones SQL de esta seguidilla de cambios ya corridas
  (migracion_complemento_pago.sql, migracion_nombres_originales_
  documentos.sql, migracion_factura_poliza.sql).
- DOCUMENTOS_BASE_PATH definido en config.py.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no copia nada, solo reporta qué encontró y a
    dónde lo copiaría -- para revisar con calma que cada documento
    sí le pertenece a la póliza/recibo correcto antes de tocar nada:
        python scripts/migrar_documentos_a_D.py

    Modo real, copia de verdad:
        python scripts/migrar_documentos_a_D.py --aplicar
"""
import sys
import os
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import Cliente, Poliza, Recibo
from app.utils.document_storage import get_carpeta_documento


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


def _copiar(origen, destino_folder, filename, aplicar, reporte):
    destino = os.path.join(destino_folder, filename)
    existe_origen = os.path.exists(origen)
    reporte.append({
        'origen': origen,
        'destino': destino,
        'existe_origen': existe_origen,
    })
    if aplicar and existe_origen:
        shutil.copy2(origen, destino)


def migrar(aplicar=False):
    with app.app_context():
        reporte = []
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
                _copiar(origen, destino_folder, filename, aplicar, reporte)
                if aplicar:
                    poliza.pdf_path = filename

            if poliza.factura_pdf:
                origen = _ruta_vieja_poliza_factura(poliza.factura_pdf)
                destino_folder = get_carpeta_documento(cliente, poliza, 'factura')
                _copiar(origen, destino_folder, poliza.factura_pdf, aplicar, reporte)

            if poliza.factura_xml:
                origen = _ruta_vieja_poliza_factura(poliza.factura_xml)
                destino_folder = get_carpeta_documento(cliente, poliza, 'factura')
                _copiar(origen, destino_folder, poliza.factura_xml, aplicar, reporte)

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
                _copiar(origen, destino_folder, recibo.comprobante, aplicar, reporte)

            if recibo.complemento_pago_pdf:
                origen = _ruta_vieja_recibo_complemento(recibo, 'complemento_pago_pdf')
                destino_folder = get_carpeta_documento(
                    cliente, poliza, 'complemento_pago', recibo=recibo)
                _copiar(origen, destino_folder, recibo.complemento_pago_pdf, aplicar, reporte)

            if recibo.complemento_pago_xml:
                origen = _ruta_vieja_recibo_complemento(recibo, 'complemento_pago_xml')
                destino_folder = get_carpeta_documento(
                    cliente, poliza, 'complemento_pago', recibo=recibo)
                _copiar(origen, destino_folder, recibo.complemento_pago_xml, aplicar, reporte)

        # --- Reporte ---
        print(f"\n{'='*90}")
        print(f"Documentos encontrados: {len(reporte)}")
        print(f"{'='*90}\n")

        faltantes = [r for r in reporte if not r['existe_origen']]

        for r in reporte:
            estado = "OK" if r['existe_origen'] else "!! ARCHIVO ORIGEN NO ENCONTRADO !!"
            print(f"[{estado}]")
            print(f"  Origen : {r['origen']}")
            print(f"  Destino: {r['destino']}")
            print()

        if faltantes:
            print(f"{'='*90}")
            print(f"ADVERTENCIA: {len(faltantes)} archivo(s) no se encontraron en su ubicación "
                  f"esperada -- revisa esos casos a mano antes de confiar en la migración.")
            print(f"{'='*90}\n")

        if not aplicar:
            print("MODO DE PRUEBA -- no se copió ni se modificó nada todavía.")
            print("Revisa el reporte de arriba con calma. Si todo se ve correcto "
                  "(cada documento en la carpeta de la póliza/cliente que le "
                  "corresponde), vuelve a correr con --aplicar para copiar de verdad.\n")
        else:
            from app import db
            db.session.commit()
            print(f"LISTO -- se copiaron {len(reporte) - len(faltantes)} archivo(s) a "
                  f"{app.config.get('DOCUMENTOS_BASE_PATH')}.")
            print("Los archivos originales NO se borraron -- puedes limpiarlos a mano "
                  "una vez que confirmes que todo quedó bien.\n")


if __name__ == '__main__':
    aplicar = '--aplicar' in sys.argv
    migrar(aplicar=aplicar)
