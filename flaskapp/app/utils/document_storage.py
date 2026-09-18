# app/utils/document_storage.py
"""
Punto único para calcular dónde vive cada documento subido al sistema
(PDF de póliza, factura, aviso de cobro, complemento de pago -- y a
futuro, endosos y siniestros).

La base de datos solo guarda el NOMBRE del archivo (como ya hacía
antes de este módulo); la carpeta se reconstruye aquí mismo cada vez,
a partir de a quién pertenece el documento. Así, si en el futuro se
quiere cambiar cómo se organizan las carpetas, se cambia en un solo
lugar.

Estructura resultante (bajo DOCUMENTOS_BASE_PATH):

    Cliente_{id}_{nombre}/
        Poliza_{id}_{numero}/
            documento_poliza/
            factura/
            recibos/
                Recibo_{id}/
                    aviso_cobro/
                    complemento_pago/
            endosos/
            siniestros/

Si DOCUMENTOS_BASE_PATH no está definido en config.py (por ejemplo en
un entorno local que no tiene el disco D:), se usa una carpeta dentro
de app/static/ como respaldo -- así el sistema sigue funcionando sin
tener que configurar nada extra en desarrollo.
"""
import os
from flask import current_app
from werkzeug.utils import secure_filename

CATEGORIAS_POR_RECIBO = ('aviso_cobro', 'complemento_pago')
CATEGORIAS_POR_POLIZA = ('documento_poliza', 'factura', 'endosos', 'siniestros')


def _slug(texto):
    limpio = secure_filename(str(texto or '').strip())
    return limpio or 'sin_nombre'


def get_documentos_base():
    base = current_app.config.get('DOCUMENTOS_BASE_PATH')
    if not base:
        base = os.path.join(current_app.root_path, 'static', 'documentos_locales')
    return base


def _carpeta_cliente(cliente):
    if cliente:
        nombre = f"{cliente.nombre or ''} {cliente.apellido or ''}".strip()
        return f"Cliente_{cliente.id}_{_slug(nombre)}"
    return "Cliente_sin_asignar"


def _carpeta_poliza(poliza):
    return f"Poliza_{poliza.id}_{_slug(poliza.poliza)}"


def get_carpeta_documento(cliente, poliza, categoria, recibo=None):
    """
    Devuelve (y crea si no existe) la carpeta donde debe vivir un
    documento. categoria debe ser una de CATEGORIAS_POR_POLIZA o
    CATEGORIAS_POR_RECIBO; para estas últimas, recibo es obligatorio.
    """
    if categoria in CATEGORIAS_POR_RECIBO and recibo is None:
        raise ValueError(f"La categoría '{categoria}' requiere un recibo")

    ruta = os.path.join(
        get_documentos_base(),
        _carpeta_cliente(cliente),
        _carpeta_poliza(poliza),
    )
    if categoria in CATEGORIAS_POR_RECIBO:
        ruta = os.path.join(ruta, 'recibos', f'Recibo_{recibo.id}', categoria)
    else:
        ruta = os.path.join(ruta, categoria)

    os.makedirs(ruta, exist_ok=True)
    return ruta
