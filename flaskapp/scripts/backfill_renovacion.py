# flaskapp/scripts/backfill_renovacion.py
"""
Script de UNA SOLA VEZ para corregir el historial de renovaciones de
pólizas ya existentes.

Problema que corrige: cuando se renueva una póliza, el código nunca
guardó en la póliza VIEJA el folio de la póliza NUEVA que la reemplazó
(el campo `renovacion`) — solo marcaba `Poliza_renovada = 'Si'`, sin
decir a cuál. Esto ya se corrigió hacia adelante en
`app/polizas/routes.py` (función create()), pero las renovaciones
pasadas quedaron con ese dato vacío o desactualizado.

Este script recorre las pólizas que SÍ tienen `poliza_anterior` lleno
(es decir, que son una renovación de otra), busca la póliza vieja
correspondiente por su folio, y le corrige `Poliza_renovada` y
`renovacion` si hace falta.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no guarda nada, solo reporta qué haría:
        python scripts/backfill_renovacion.py

    Modo real, aplica los cambios en la base de datos:
        python scripts/backfill_renovacion.py --aplicar
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from app.models import Poliza


def backfill(aplicar=False):
    with app.app_context():
        nuevas_con_anterior = (Poliza.query
                                .filter(Poliza.poliza_anterior.isnot(None),
                                        Poliza.poliza_anterior != '')
                                .all())

        actualizadas = 0
        ya_estaba_bien = 0
        sin_coincidencia = []

        for nueva in nuevas_con_anterior:
            vieja = Poliza.query.filter(
                Poliza.poliza == nueva.poliza_anterior).first()

            if not vieja:
                sin_coincidencia.append(
                    (nueva.id, nueva.poliza, nueva.poliza_anterior))
                continue

            necesita_cambio = (
                vieja.Poliza_renovada != 'Si' or vieja.renovacion != nueva.poliza
            )

            if necesita_cambio:
                print(f"Póliza vieja id={vieja.id} folio='{vieja.poliza}': "
                      f"Poliza_renovada '{vieja.Poliza_renovada}' -> 'Si', "
                      f"renovacion '{vieja.renovacion}' -> '{nueva.poliza}'")
                if aplicar:
                    vieja.Poliza_renovada = 'Si'
                    vieja.renovacion = nueva.poliza
                actualizadas += 1
            else:
                ya_estaba_bien += 1

        print("\n" + "=" * 60)
        print(f"Total pólizas con poliza_anterior lleno: {len(nuevas_con_anterior)}")
        print(f"Ya estaban correctas (sin cambio): {ya_estaba_bien}")
        print(f"Se {'actualizaron' if aplicar else 'actualizarían'}: {actualizadas}")
        print(f"Sin coincidencia (poliza_anterior no encontrado): {len(sin_coincidencia)}")

        if sin_coincidencia:
            print("\nDetalle de casos sin coincidencia (revisar a mano):")
            for id_, folio, anterior in sin_coincidencia:
                print(f"  póliza id={id_} folio='{folio}' "
                      f"busca poliza_anterior='{anterior}' → no encontrado")

        if aplicar:
            db.session.commit()
            print("\n✅ Cambios guardados en la base de datos.")
        else:
            print("\n⚠️  Esto fue un DRY-RUN — no se guardó nada todavía.")
            print("    Si el reporte se ve bien, vuelve a correr con --aplicar")


if __name__ == '__main__':
    modo_aplicar = '--aplicar' in sys.argv
    backfill(aplicar=modo_aplicar)
