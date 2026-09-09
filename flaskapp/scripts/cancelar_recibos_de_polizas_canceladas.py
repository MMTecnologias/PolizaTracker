# flaskapp/scripts/cancelar_recibos_de_polizas_canceladas.py
"""
Script de UNA SOLA VEZ para corregir recibos existentes que se quedaron
sin cancelar cuando su póliza ya estaba cancelada.

Problema que corrige: al cancelar una póliza, el sistema nunca cancelaba
sus recibos relacionados -- si tenían recibos en estado 'Pendiente' o
'Vencido', se quedaban así para siempre, aunque la póliza ya no tuviera
ninguna obligación de cobro. Esto se veía, por ejemplo, en el Portal del
Asegurado: recibos de pólizas canceladas apareciendo como "pendientes de
pago".

Esto ya se corrigió hacia adelante en app/polizas/routes.py (la ruta
'/delete', que es la que cancela pólizas) -- ahora cancela también los
recibos en automático. Este script es solo para arreglar los datos de
pólizas que ya se habían cancelado ANTES de ese arreglo.

Qué NO toca: recibos ya 'Liquidado' (pagados) de una póliza cancelada se
dejan tal cual -- si ya se pagaron antes de cancelar, siguen contando
como pagados, no se les cambia el estado.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no guarda nada, solo reporta qué haría:
        python scripts/cancelar_recibos_de_polizas_canceladas.py

    Modo real, aplica los cambios en la base de datos:
        python scripts/cancelar_recibos_de_polizas_canceladas.py --aplicar
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from app.models import Poliza, Recibo


def corregir(aplicar=False):
    with app.app_context():
        recibos_a_corregir = (Recibo.query
                               .join(Poliza, Recibo.poliza_id == Poliza.id)
                               .filter(Poliza.status == 'Cancelada')
                               .filter(Recibo.status.in_(['Pendiente', 'Vencido']))
                               .all())

        if not recibos_a_corregir:
            print('No se encontraron recibos por corregir. Todo en orden.')
            return

        print(f'Se encontraron {len(recibos_a_corregir)} recibo(s) de pólizas '
              f'canceladas que seguían en estado Pendiente/Vencido:\n')

        for recibo in recibos_a_corregir:
            poliza = Poliza.query.get(recibo.poliza_id)
            print(f'  Recibo #{recibo.no_de_recibo} (id={recibo.id}) de la '
                  f'póliza {poliza.poliza} (id={poliza.id}) -- '
                  f'estado actual: {recibo.status}')
            if aplicar:
                recibo.status = 'Cancelado'

        if aplicar:
            db.session.commit()
            print(f'\n✅ Se cancelaron {len(recibos_a_corregir)} recibo(s). '
                  f'Cambios guardados.')
        else:
            print(f'\nModo de prueba -- no se guardó nada. Si el reporte se '
                  f've bien, vuelve a correr con --aplicar.')


if __name__ == '__main__':
    aplicar = '--aplicar' in sys.argv
    corregir(aplicar=aplicar)
