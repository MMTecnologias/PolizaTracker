# app/dashboard_gerencial/routes.py
"""
Panorama General del Dashboard Gerencial.

'Pólizas Vigentes' es siempre una foto del día de hoy (total agencia).
Todo lo demás ('Prima Neta Cobrada', 'Pólizas Nuevas', 'Comisiones
Generadas', 'Pólizas por Renovar' y 'Recibos Pendientes de Cobro')
depende del periodo elegido en el filtro de fecha global.

Regla de "periodo de gracia" (aplica a Recibos Pendientes y Pólizas
por Renovar): si el rango elegido queda COMPLETAMENTE en el pasado
(su 'hasta' ya pasó), solo importa lo que seguía sin resolver dentro
de ESE rango exacto — no se agrega nada de gracia respecto a hoy,
porque ya no aplica. Si el rango incluye el día de hoy o es futuro,
se le suma lo atrasado (respecto a hoy) que siga dentro de su
periodo de gracia, igual que ya se hace en el Portal del Asegurado.

'Pólizas Nuevas' y 'Pólizas Renovadas' se filtran por fecha_inicio,
NO por fecha_captura: se confirmó con datos reales que las pólizas
renovadas cargadas por migración comparten una misma fecha_captura
falsa (fecha en que se metieron al sistema, no la real de renovación),
lo que hacía que nunca aparecieran fuera de esa fecha de migración.
fecha_inicio sí refleja la fecha real de negocio.
"""
from datetime import date, timedelta
from flask import jsonify, request
from flask_login import login_required
from sqlalchemy import func, or_, and_
from app import db
from app.models import Poliza, Recibo, Cliente, Aseguradora, Ramo, Subramo
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


def _filtro_con_gracia(columna_fecha, desde, hasta, dias_gracia):
    """Arma el filtro SQL para 'dentro del periodo elegido, o atrasado
    respecto a HOY pero aún en gracia'. Si el periodo elegido ya quedó
    completamente en el pasado, NO se agrega la gracia — solo aplica
    el rango exacto elegido."""
    hoy = date.today()

    if hasta < hoy:
        # Periodo totalmente pasado: sin gracia extra, solo el rango tal cual
        return and_(columna_fecha >= desde, columna_fecha <= hasta)

    limite_gracia = hoy - timedelta(days=dias_gracia)
    return or_(
        and_(columna_fecha >= desde, columna_fecha <= hasta),
        and_(columna_fecha < hoy, columna_fecha >= limite_gracia),
    )


@dashboard_gerencial.route('/api/panorama')
@login_required
def panorama():
    desde, hasta = _resolver_periodo()

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
                       .filter(Poliza.fecha_inicio >= desde,
                               Poliza.fecha_inicio <= hasta)
                       .count())

    # De esas mismas pólizas capturadas en el periodo, cuántas son
    # renovaciones (Poliza_renovada = 'Si')
    polizas_renovadas = (Poliza.query
                          .filter(Poliza.fecha_inicio >= desde,
                                  Poliza.fecha_inicio <= hasta,
                                  Poliza.Poliza_renovada == 'Si')
                          .count())

    # 3) Pólizas Vigentes — siempre a hoy
    polizas_vigentes = Poliza.query.filter(Poliza.status == 'Vigente').count()

    # 4) Pólizas por Renovar — AHORA depende del periodo elegido (antes
    #    era fija; se ajustó a petición explícita)
    filtro_renovar = _filtro_con_gracia(
        Poliza.fecha_termino, desde, hasta, DIAS_GRACIA_RENOVACION)
    polizas_por_renovar = (Poliza.query
                            .filter(filtro_renovar,
                                    Poliza.status != 'Cancelada')
                            .count())

    # 5) Recibos Pendientes de Cobro — depende del periodo elegido
    filtro_recibos = _filtro_con_gracia(
        Recibo.fecha_vencimiento, desde, hasta, DIAS_GRACIA_RECIBO)
    rows_pendientes = (db.session.query(Recibo, Poliza.moneda)
                        .join(Poliza, Recibo.poliza_id == Poliza.id)
                        .filter(Recibo.status.notin_(['Liquidado', 'Cancelado']),
                                filtro_recibos)
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
        'polizasRenovadas': polizas_renovadas,
        'polizasVigentes': polizas_vigentes,
        'polizasPorRenovar': polizas_por_renovar,
        'recibosPendientes': recibos_pendientes,
        'comisionesGeneradas': comisiones_generadas,
    })


@dashboard_gerencial.route('/api/polizas_nuevas/listado')
@login_required
def polizas_nuevas_listado():
    """Listado combinado de pólizas Nuevas + Renovadas del periodo
    (para el modal que se abre al hacer clic en la card)."""
    desde, hasta = _resolver_periodo()

    rows = (db.session.query(Poliza, Cliente, Aseguradora)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .filter(Poliza.fecha_inicio >= desde,
                    Poliza.fecha_inicio <= hasta)
            .order_by(Poliza.fecha_inicio)
            .all())

    data = [{
        'poliza': p.poliza,
        'cliente': f'{c.nombre} {c.apellido}'.strip(),
        'aseguradora': a.aseguradora,
        'fechaCaptura': p.fecha_inicio.strftime('%d/%m/%Y'),  # ojo: es fecha_inicio, ver nota arriba
        'tipo': 'Renovada' if p.Poliza_renovada == 'Si' else 'Nueva',
        'primaTotal': float(p.prima_total),
        'moneda': p.moneda,
    } for p, c, a in rows]

    return jsonify({'items': data})


@dashboard_gerencial.route('/api/polizas_por_renovar/listado')
@login_required
def polizas_por_renovar_listado():
    desde, hasta = _resolver_periodo()
    filtro_renovar = _filtro_con_gracia(
        Poliza.fecha_termino, desde, hasta, DIAS_GRACIA_RENOVACION)

    rows = (db.session.query(Poliza, Cliente, Aseguradora)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .filter(filtro_renovar,
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
    desde, hasta = _resolver_periodo()
    filtro_recibos = _filtro_con_gracia(
        Recibo.fecha_vencimiento, desde, hasta, DIAS_GRACIA_RECIBO)

    rows = (db.session.query(Recibo, Poliza, Cliente, Aseguradora)
            .join(Poliza, Recibo.poliza_id == Poliza.id)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .filter(Recibo.status.notin_(['Liquidado', 'Cancelado']),
                    filtro_recibos)
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


@dashboard_gerencial.route('/api/poliza_info/<path:numero_poliza>')
@login_required
def poliza_info(numero_poliza):
    """Datos clave de una póliza por su folio, para el mini-modal de
    detalle que se abre al hacer clic en un número de póliza."""
    fila = (db.session.query(Poliza, Cliente, Aseguradora, Ramo, Subramo)
            .join(Cliente, Poliza.cliente_id == Cliente.id)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .join(Ramo, Poliza.ramo_id == Ramo.id)
            .join(Subramo, Poliza.subramo_id == Subramo.id)
            .filter(Poliza.poliza == numero_poliza)
            .first())

    if not fila:
        return jsonify({'error': 'Póliza no encontrada'}), 404

    p, c, a, ramo, subramo = fila
    return jsonify({
        'poliza': p.poliza,
        'cliente': f'{c.nombre} {c.apellido}'.strip(),
        'aseguradora': a.aseguradora,
        'ramo': ramo.ramo,
        'subramo': subramo.subramo,
        'fechaInicio': p.fecha_inicio.strftime('%d/%m/%Y'),
        'fechaTermino': p.fecha_termino.strftime('%d/%m/%Y'),
        'status': p.status,
        'primaNeta': float(p.prima_neta),
        'primaTotal': float(p.prima_total),
        'moneda': p.moneda,
        'renovada': p.Poliza_renovada,
    })

