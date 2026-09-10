# flaskapp/scripts/generar_recibos_faltantes.py
"""
Script de mantenimiento para detectar pólizas SIN recibos reales en la
tabla `recibos` (sin importar lo que diga la bandera Poliza.recibos) y
generarlos usando los datos ya guardados en la propia póliza.

Por qué hace falta: un bug ya corregido dejaba pólizas creadas sin sus
recibos si algo fallaba a medias en el proceso original. Este script
limpia ese historial.

Supuestos usados para reconstruir el cálculo (confirmados con el
dueño del proyecto, ya que parte de esta información no queda
guardada de forma recuperable en la póliza):
  - IVA: siempre 16% (es una constante fija en todo el sistema).
  - Modo de reparto del derecho de póliza ("rec_pago"): "primer_recibo"
    (todo el derecho de póliza va en el primer pago). No hay forma de
    saber el modo real usado originalmente para pólizas huérfanas.
  - Número de recibos: TipoPago.pagos_anuales de la póliza.
  - % de comisión: SÍ se recupera de Poliza.comision — ese campo guarda
    el porcentaje original tal como se capturó, y solo se sobreescribe
    con el monto en dinero cuando los recibos se generan exitosamente;
    como estas pólizas nunca llegaron a ese paso, el porcentaje real
    sigue intacto ahí.

IMPORTANTE: todos los recibos se generan con estado 'Pendiente' — este
script NUNCA marca nada como pagado/Liquidado automáticamente. Esa
decisión se toma después, a mano, revisando el archivo de log que este
script genera.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no guarda nada, solo reporta qué haría:
        python scripts/generar_recibos_faltantes.py

    Modo real, aplica los cambios en la base de datos:
        python scripts/generar_recibos_faltantes.py --aplicar
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from app.models import Poliza, Recibo, TipoPago
from app.polizas.routes import _calcular_montos_recibos, _generar_registros_recibos

IVA_FIJO = 16.0
REC_PAGO_ASUMIDO = "primer_recibo"


def generar_recibos_faltantes(aplicar=False):
    with app.app_context():
        candidatas = Poliza.query.all()

        generadas = []
        bandera_inconsistente = []
        omitidas_datos_insuficientes = []
        derecho_poliza_vacio = []
        ya_tenian_recibos = 0

        for poliza in candidatas:
            tiene_recibos_reales = Recibo.query.filter(
                Recibo.poliza_id == poliza.id).first() is not None

            if tiene_recibos_reales:
                ya_tenian_recibos += 1
                continue

            # A partir de aquí: la póliza NO tiene ningún recibo real
            if poliza.recibos == 'Generados':
                bandera_inconsistente.append(poliza)

            if not poliza.prima_neta or not poliza.prima_total or not poliza.tipo_pago_id:
                omitidas_datos_insuficientes.append(poliza)
                continue

            tipo_pago = TipoPago.query.get(poliza.tipo_pago_id)
            if not tipo_pago:
                omitidas_datos_insuficientes.append(poliza)
                continue

            nopagos = 1 if tipo_pago.contado == "Si" else (
                tipo_pago.pagos_anuales or 1)

            # Distingue "derecho de póliza en $0 de verdad" de "nunca se
            # capturó" (None) -- ambos se tratan igual para el cálculo
            # (0 en cualquier caso), pero se reportan por separado para
            # poder revisarlos antes de aplicar: un derecho de póliza
            # faltante generaría un recibo cobrando de menos sin avisar.
            derecho_poliza_era_none = poliza.derecho_poliza is None
            if derecho_poliza_era_none:
                derecho_poliza_vacio.append(poliza)

            # IMPORTANTE: Poliza.comision guarda el PORCENTAJE original
            # (ej. 10 = 10%) tal como se capturó al crear la póliza.
            # Ese campo solo se sobreescribe con el MONTO en dinero
            # cuando los recibos se generan exitosamente — como estas
            # pólizas huérfanas nunca llegaron a ese paso, el porcentaje
            # real sigue intacto aquí, no hay que asumir nada.
            comision_pct = float(poliza.comision or 0)

            response = _calcular_montos_recibos(
                prima_total=float(poliza.prima_total),
                prima_neta=float(poliza.prima_neta),
                iva_pct=IVA_FIJO,
                derecho_poliza=float(poliza.derecho_poliza or 0),
                comision_pct=comision_pct,
                nopagos=nopagos,
                rec_pago_modo=REC_PAGO_ASUMIDO,
            )
            response['poliza_id'] = poliza.id

            monto_total = (response['firstpay']['totalPremium'] +
                           response['subspay']['totalPremium'] * (nopagos - 1)
                           if nopagos > 1 else response['firstpay']['totalPremium'])

            print(f"Póliza id={poliza.id} folio='{poliza.poliza}': "
                  f"generar {nopagos} recibo(s), monto total ≈ ${monto_total:,.2f} {poliza.moneda}"
                  f"{' [BANDERA DECÍA GENERADOS]' if poliza.recibos == 'Generados' else ''}"
                  f"{' [DERECHO DE PÓLIZA VACÍO -> se usará $0]' if derecho_poliza_era_none else ''}")

            if aplicar:
                _generar_registros_recibos(
                    poliza.id, None, response, poliza, poliza,
                    is_endoso=False, multiplier=1)

            generadas.append({
                'id': poliza.id,
                'folio': poliza.poliza,
                'moneda': poliza.moneda,
                'nopagos': nopagos,
                'monto_total': monto_total,
                'bandera_era_generados': poliza.recibos == 'Generados',
                'derecho_poliza_era_none': derecho_poliza_era_none,
            })

        print("\n" + "=" * 60)
        print(f"Pólizas revisadas: {len(candidatas)}")
        print(f"Ya tenían recibos reales (sin tocar): {ya_tenian_recibos}")
        print(f"Se {'generaron' if aplicar else 'generarían'} recibos para: {len(generadas)}")
        print(f"  De esas, con bandera inconsistente (decía 'Generados'): {len(bandera_inconsistente)}")
        print(f"  De esas, con derecho de póliza VACÍO (se usó $0): {len(derecho_poliza_vacio)}")
        print(f"Omitidas por datos insuficientes: {len(omitidas_datos_insuficientes)}")

        if derecho_poliza_vacio:
            print("\n⚠️  Pólizas con derecho de póliza VACÍO (se generó el recibo "
                  "con $0 de derecho de póliza -- revisa si de verdad no debían "
                  "cobrar nada, o si es un dato que falta capturar):")
            for p in derecho_poliza_vacio:
                print(f"  id={p.id} folio='{p.poliza}'")

        if omitidas_datos_insuficientes:
            print("\nPólizas omitidas por falta de datos (revisar a mano):")
            for p in omitidas_datos_insuficientes:
                print(f"  id={p.id} folio='{p.poliza}' "
                      f"prima_neta={p.prima_neta} prima_total={p.prima_total} tipo_pago_id={p.tipo_pago_id}")

        if aplicar:
            db.session.commit()
            print("\n✅ Cambios guardados en la base de datos.")
        else:
            print("\n⚠️  Esto fue un DRY-RUN — no se guardó nada todavía.")
            print("    Si el reporte se ve bien, vuelve a correr con --aplicar")

        # Archivo de log con el detalle, para decidir despues cuales
        # marcar como pagados
        if generadas:
            nombre_archivo = f"log_recibos_generados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(nombre_archivo, 'w', encoding='utf-8') as f:
                f.write("LOG DE RECIBOS GENERADOS - PÓLIZAS SIN RECIBOS PREVIOS\n")
                f.write(f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Modo: {'APLICADO' if aplicar else 'DRY-RUN (nada se guardó)'}\n")
                f.write("=" * 70 + "\n\n")
                f.write("Todos los recibos se generaron con estado 'Pendiente'.\n")
                f.write("Revisa esta lista para decidir cuáles marcar como pagados.\n\n")
                for item in generadas:
                    marca = " [BANDERA DECÍA 'GENERADOS' - REVISAR POR QUÉ]" if item['bandera_era_generados'] else ""
                    marca_derecho = " [DERECHO DE PÓLIZA VACÍO - se usó $0]" if item['derecho_poliza_era_none'] else ""
                    f.write(f"Póliza: {item['folio']} (id={item['id']}){marca}{marca_derecho}\n")
                    f.write(f"  Recibos generados: {item['nopagos']}\n")
                    f.write(f"  Monto total: ${item['monto_total']:,.2f} {item['moneda']}\n\n")
            print(f"\n📄 Log guardado en: {nombre_archivo}")


if __name__ == '__main__':
    modo_aplicar = '--aplicar' in sys.argv
    generar_recibos_faltantes(aplicar=modo_aplicar)
