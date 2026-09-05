# app/dashboard_gerencial/routes.py
"""
Panorama General del Dashboard Gerencial.

NOTA: 'Pólizas Vigentes', 'Pólizas por Renovar' y 'Recibos Pendientes de
Cobro' son siempre una foto del día de hoy (no dependen del filtro de
fecha global). 'Prima Neta Cobrada', 'Pólizas Nuevas' y 'Comisiones
Generadas' sí dependen del periodo elegido en el filtro.
"""
from datetime import date, timedelta
from flask import jsonify, request
from flask_login import login_required
from sqlalchemy import func
from app import db
from app.models import Poliza, Recibo
from . import dashboard_gerencial

DIAS_GRACIA_RECIBO = 30
DIAS_GRACIA_RENOVACION = 20


def _primer_y_ultimo_dia_mes(alguna_fecha):
    primer_dia = alguna_fecha.replace(day=1)
    if alguna_fecha.month == 12:
        ultimo_dia = alguna_fecha.replace(day=31)
    else:
        ultimo_dia = alguna_fecha.replace(
            month=alguna_fecha.month + 1, day=1) - timedelta(days=1)
    return primer_dia, ultimo_dia


def _resolver_periodo():
    """Lee ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD; si no vienen, usa el mes en curso."""
    hoy = date.today()
    desde_str = request.args.get('desde')
    hasta_str = request.args.get('hasta')

    if desde_str and hasta_str:
        try:
            desde = date.fromisoformat(desde_str)
            hasta = date.fromisoformat(hasta_str)
            return desde, hasta
        except ValueError:
            pass

    return _primer_y_ultimo_dia_mes(hoy)


def _recibos_estado_real(status_bd, fecha_vencimiento, hoy=None):
    """Replica la misma lógica de estadoRealRecibo() del Portal del
    Asegurado: Liquidado/Cancelado se respetan tal cual; lo demás se
    calcula por fecha con el periodo de gracia de 30 días."""
    if hoy is None:
        hoy = date.today()
    if status_bd in ('Liquidado', 'Cancelado'):
        return status_bd
    dias_transcurridos = (hoy - fecha_vencimiento).days
    return 'Vencido' if dias_transcurridos > DIAS_GRACIA_RECIBO else 'Pendiente'


@dashboard_gerencial.route('/api/panorama')
@login_required
def panorama():
    desde, hasta = _resolver_periodo()
    hoy = date.today()

    # 1) Prima Neta Cobrada (por moneda) — periodo seleccionado
    rows_prima = (db.session.query(
                    Poliza.moneda,
                    func.sum(Recibo.prima_neta),
                    func.count(func.distinct(Recibo.id)),
                    func.count(func.distinct(Poliza.id)))
                  .join(Poliza, Recibo.poliza_id == Poliza.id)
                  .filter(Recibo.status == 'Liquidado',
                          Recibo.fecha_pago >= desde,
                          Recibo.fecha_pago <= hasta)
                  .group_by(Poliza.moneda)
                  .all())
    prima_neta_cobrada = [{
        'moneda': moneda,
        'monto': float(monto or 0),
        'recibos': int(n_recibos or 0),
        'polizas': int(n_polizas or 0),
    } for moneda, monto, n_recibos, n_polizas in rows_prima]

    # 2) Pólizas Nuevas — periodo seleccionado
    polizas_nuevas = (Poliza.query
                       .filter(Poliza.fecha_captura >= desde,
                               Poliza.fecha_captura <= hasta)
                       .count())

    # 3) Pólizas Vigentes — siempre a hoy
    polizas_vigentes = Poliza.query.filter(Poliza.status == 'Vigente').count()

    # 4) Pólizas por Renovar — siempre a hoy (fecha_termino entre
    #    hoy-20 dias y fin del mes en curso), sin canceladas
    _, fin_mes_actual = _primer_y_ultimo_dia_mes(hoy)
    limite_gracia_renovacion = hoy - timedelta(days=DIAS_GRACIA_RENOVACION)
    polizas_por_renovar = (Poliza.query
                            .filter(Poliza.fecha_termino >= limite_gracia_renovacion,
                                    Poliza.fecha_termino <= fin_mes_actual,
                                    Poliza.status != 'Cancelada')
                            .count())

    # 5) Recibos Pendientes de Cobro — siempre a hoy, agencia completa
    limite_gracia_recibo = hoy - timedelta(days=DIAS_GRACIA_RECIBO)
    rows_pendientes = (db.session.query(Recibo, Poliza.moneda)
                        .join(Poliza, Recibo.poliza_id == Poliza.id)
                        .filter(Recibo.status.notin_(['Liquidado', 'Cancelado']),
                                Recibo.fecha_vencimiento >= limite_gracia_recibo)
                        .all())
    pendientes_por_moneda = {}
    polizas_pendientes_ids = {}
    for recibo, moneda in rows_pendientes:
        d = pendientes_por_moneda.setdefault(
            moneda, {'monto': 0.0, 'recibos': 0})
        d['monto'] += float(recibo.prima_total)
        d['recibos'] += 1
        polizas_pendientes_ids.setdefault(moneda, set()).add(recibo.poliza_id)

    recibos_pendientes = [{
        'moneda': moneda,
        'monto': datos['monto'],
        'recibos': datos['recibos'],
        'polizas': len(polizas_pendientes_ids.get(moneda, set())),
    } for moneda, datos in pendientes_por_moneda.items()]

    # 6) Comisiones Generadas (por moneda) — periodo seleccionado
    rows_comision = (db.session.query(
                        Poliza.moneda,
                        func.sum(Recibo.comision))
                      .join(Poliza, Recibo.poliza_id == Poliza.id)
                      .filter(Recibo.status == 'Liquidado',
                              Recibo.fecha_pago >= desde,
                              Recibo.fecha_pago <= hasta)
                      .group_by(Poliza.moneda)
                      .all())
    comisiones_generadas = [{
        'moneda': moneda,
        'monto': float(monto or 0),
    } for moneda, monto in rows_comision]

    return jsonify({
        'periodo': {'desde': desde.isoformat(), 'hasta': hasta.isoformat()},
        'primaNetaCobrada': prima_neta_cobrada,
        'polizasNuevas': polizas_nuevas,
        'polizasVigentes': polizas_vigentes,
        'polizasPorRenovar': polizas_por_renovar,
        'recibosPendientes': recibos_pendientes,
        'comisionesGeneradas': comisiones_generadas,
    })


@dashboard_gerencial.route('/api/polizas_por_renovar/listado')
@login_required
def polizas_por_renovar_listado():
    hoy = date.today()
    _, fin_mes_actual = _primer_y_ultimo_dia_mes(hoy)
    limite_gracia = hoy - timedelta(days=DIAS_GRACIA_RENOVACION)

    from app.models import Cliente, Aseguradora
    rows = (db.session.query(Poliza, Cliente, Aseguradora)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .filter(Poliza.fecha_termino >= limite_gracia,
                    Poliza.fecha_termino <= fin_mes_actual,
                    Poliza.status != 'Cancelada')
            .order_by(Poliza.fecha_termino)
            .all())

    data = [{
        'poliza': p.poliza,
        'cliente': f'{c.nombre} {c.apellido}'.strip(),
        'aseguradora': a.aseguradora,
        'fechaTermino': p.fecha_termino.strftime('%d/%m/%Y'),
        'status': p.status,
        'primaTotal': float(p.prima_total),
        'moneda': p.moneda,
    } for p, c, a in rows]

    return jsonify({'items': data})


@dashboard_gerencial.route('/api/recibos_pendientes/listado')
@login_required
def recibos_pendientes_listado():
    hoy = date.today()
    limite_gracia = hoy - timedelta(days=DIAS_GRACIA_RECIBO)

    from app.models import Cliente, Aseguradora
    rows = (db.session.query(Recibo, Poliza, Cliente, Aseguradora)
            .join(Poliza, Recibo.poliza_id == Poliza.id)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .filter(Recibo.status.notin_(['Liquidado', 'Cancelado']),
                    Recibo.fecha_vencimiento >= limite_gracia)
            .order_by(Recibo.fecha_vencimiento)
            .all())

    data = [{
        'recibo': r.no_de_recibo,
        'poliza': p.poliza,
        'cliente': f'{c.nombre} {c.apellido}'.strip(),
        'aseguradora': a.aseguradora,
        'fechaVencimiento': r.fecha_vencimiento.strftime('%d/%m/%Y'),
        'status': _recibos_estado_real(r.status, r.fecha_vencimiento, hoy),
        'primaTotal': float(r.prima_total),
        'moneda': p.moneda,
    } for r, p, c, a in rows]

    return jsonify({'items': data})
