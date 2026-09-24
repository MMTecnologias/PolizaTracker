# flaskapp/scripts/limpiar_pdfs_temporales.py
"""
Script de mantenimiento: borra los PDFs "temporales" sueltos en
static/polizas_pdf/ y static/endosos_pdf/.

Por qué existen: al subir un PDF para crear una póliza o un endoso
NUEVO, el archivo se guarda ahí primero (antes de que la póliza/endoso
exista, para poder leerlo con IA). Si el usuario cancela el modal, cierra
la pestaña o el navegador se cae antes de dar clic en "Guardar", ese
archivo se queda huérfano: nadie lo referencia y nunca se mueve a la
carpeta protegida (el disco D o donde apunte DOCUMENTOS_BASE_PATH).

Qué SÍ se borra: archivos en esas dos carpetas que
  1. tienen más de RETENCION_DIAS de antigüedad, Y
  2. no están referenciados por ninguna Poliza.pdf_path / Endoso.pdf_path
     con el esquema viejo (ese path guarda "polizas_pdf/archivo.pdf" o
     "endosos_pdf/archivo.pdf").

Qué NUNCA se toca: cualquier otro archivo (facturas, avisos de cobro,
complementos, PDFs ya movidos a la carpeta protegida) -- este script
solo mira esas dos carpetas puntuales.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no borra nada, solo reporta qué haría:
        python scripts/limpiar_pdfs_temporales.py

    Modo real, borra los archivos huérfanos:
        python scripts/limpiar_pdfs_temporales.py --aplicar

    Cambiar cuántos días de antigüedad esperar (por defecto 2):
        python scripts/limpiar_pdfs_temporales.py --dias 5
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import Poliza, Endoso

RETENCION_DIAS_DEFAULT = 2
CARPETAS = ('polizas_pdf', 'endosos_pdf')


def _nombres_referenciados_esquema_viejo(subcarpeta):
    """Nombres de archivo (sin la carpeta) que alguna póliza/endoso
    todavía referencia con el esquema viejo ("polizas_pdf/x.pdf")."""
    prefijo = f"{subcarpeta}/"
    referenciados = set()
    for valor in [p.pdf_path for p in Poliza.query.with_entities(Poliza.pdf_path).all()] + \
                 [e.pdf_path for e in Endoso.query.with_entities(Endoso.pdf_path).all()]:
        if valor and valor.startswith(prefijo):
            referenciados.add(os.path.basename(valor))
    return referenciados


def limpiar_pdfs_temporales(aplicar=False, dias=RETENCION_DIAS_DEFAULT):
    with app.app_context():
        limite_segundos = dias * 24 * 60 * 60
        ahora = time.time()

        borrados = []
        conservados_reciente = 0
        conservados_referenciado = 0

        for subcarpeta in CARPETAS:
            carpeta = os.path.join(app.root_path, 'static', subcarpeta)
            if not os.path.isdir(carpeta):
                continue

            referenciados = _nombres_referenciados_esquema_viejo(subcarpeta)

            for nombre in os.listdir(carpeta):
                ruta = os.path.join(carpeta, nombre)
                if not os.path.isfile(ruta):
                    continue

                if nombre in referenciados:
                    conservados_referenciado += 1
                    continue

                antiguedad = ahora - os.path.getmtime(ruta)
                if antiguedad < limite_segundos:
                    conservados_reciente += 1
                    continue

                borrados.append(ruta)
                if aplicar:
                    try:
                        os.remove(ruta)
                    except Exception as error:
                        print(f"  ERROR al borrar {ruta}: {error}")

        print("=" * 60)
        print(f"Antigüedad mínima para borrar: {dias} día(s)")
        print(f"Archivos conservados (menos de {dias} día(s)): {conservados_reciente}")
        print(f"Archivos conservados (aún referenciados, esquema viejo): {conservados_referenciado}")
        print(f"Archivos {'BORRADOS' if aplicar else 'que se borrarían'}: {len(borrados)}")
        for ruta in borrados:
            print(f"  {ruta}")

        if not aplicar:
            print()
            print("⚠️  Esto fue un DRY-RUN -- no se borró nada todavía.")
            print("    Si el reporte se ve bien, vuelve a correr con --aplicar")


if __name__ == '__main__':
    modo_aplicar = '--aplicar' in sys.argv
    dias_arg = RETENCION_DIAS_DEFAULT
    if '--dias' in sys.argv:
        idx = sys.argv.index('--dias')
        if idx + 1 >= len(sys.argv):
            print("Falta el número después de --dias, ej.: --dias 5")
            sys.exit(1)
        try:
            dias_arg = int(sys.argv[idx + 1])
        except ValueError:
            print("--dias debe ser un número entero, ej.: --dias 5")
            sys.exit(1)
    limpiar_pdfs_temporales(aplicar=modo_aplicar, dias=dias_arg)
