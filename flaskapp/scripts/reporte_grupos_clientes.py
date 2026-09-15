# flaskapp/scripts/reporte_grupos_clientes.py
"""
Genera un reporte en Excel (.xlsx) con todos los grupos que existen y
qué clientes están en cada uno -- para poder revisar/armar los grupos
con calma, especialmente después de haber limpiado el grupo "General".

No modifica nada en la base de datos, solo lee y genera el archivo.

USO (parado en la carpeta flaskapp/):

    python scripts/reporte_grupos_clientes.py
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import Cliente, Grupo

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
except ImportError:
    print("Falta la librería openpyxl. Instálala con:")
    print("    pip install openpyxl==3.1.5")
    sys.exit(1)


def generar_reporte():
    with app.app_context():
        grupos = {g.id: g.grupo for g in Grupo.query.order_by(Grupo.grupo).all()}
        clientes = Cliente.query.order_by(Cliente.nombre).all()

        # Junta clientes por grupo (incluyendo "Sin grupo" para los que
        # tienen grupo_id vacío)
        clientes_por_grupo = {}
        for c in clientes:
            nombre_grupo = grupos.get(c.grupo_id, None) if c.grupo_id else None
            clave = nombre_grupo or "— Sin grupo —"
            clientes_por_grupo.setdefault(clave, []).append(c)

        # Se ordena: primero los grupos reales (alfabético), "Sin grupo"
        # al final
        nombres_ordenados = sorted(
            [k for k in clientes_por_grupo if k != "— Sin grupo —"])
        if "— Sin grupo —" in clientes_por_grupo:
            nombres_ordenados.append("— Sin grupo —")

        wb = Workbook()
        encabezado_fill = PatternFill(start_color="C94A1C", end_color="C94A1C", fill_type="solid")
        encabezado_font = Font(color="FFFFFF", bold=True)

        def escribir_encabezados(ws, columnas):
            ws.append(columnas)
            for cell in ws[1]:
                cell.fill = encabezado_fill
                cell.font = encabezado_font

        # -- Hoja "Resumen" --
        ws_resumen = wb.active
        ws_resumen.title = "Resumen"
        escribir_encabezados(ws_resumen, ["Grupo", "Cantidad de clientes"])
        for nombre in nombres_ordenados:
            ws_resumen.append([nombre, len(clientes_por_grupo[nombre])])
        ws_resumen.column_dimensions['A'].width = 35
        ws_resumen.column_dimensions['B'].width = 20

        # -- Hoja "Detalle" -- un renglón por cliente, agrupado --
        ws_detalle = wb.create_sheet("Detalle")
        escribir_encabezados(ws_detalle, ["Grupo", "Cliente", "RFC", "Status"])
        for nombre_grupo in nombres_ordenados:
            for c in sorted(clientes_por_grupo[nombre_grupo], key=lambda c: c.nombre):
                ws_detalle.append([
                    nombre_grupo,
                    f"{c.nombre} {c.apellido}".strip(),
                    c.rfc or "N/D",
                    c.status,
                ])
        for col, width in zip('ABCD', [35, 40, 18, 12]):
            ws_detalle.column_dimensions[col].width = width

        print(f"Grupos encontrados: {len(nombres_ordenados) - (1 if '— Sin grupo —' in nombres_ordenados else 0)}")
        for nombre in nombres_ordenados:
            print(f"  {nombre}: {len(clientes_por_grupo[nombre])} cliente(s)")

        nombre_archivo = f"reporte_grupos_clientes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        wb.save(nombre_archivo)
        print(f"\n📄 Reporte guardado en: {nombre_archivo}")


if __name__ == '__main__':
    generar_reporte()
