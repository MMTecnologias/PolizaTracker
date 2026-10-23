"""
Módulo de Siniestros.

Etapa 1: menú de inicio del rol "Siniestros" (menuSiniestros.html).
Etapa 2: Tabla de Siniestros activos (siniestros.html) y las tarjetas del
menú alimentadas con datos reales. Pendiente: tarjeta de pagos (requiere
la tabla de pagos).
"""
from datetime import datetime, timedelta

from flask import jsonify, redirect, render_template, url_for
from flask_login import current_user, login_required

from app import db
from app.models import (Acceso, Aseguradora, Cliente, Poliza, Servicio, Siniestro,
                        SiniestroEstatus, SiniestroProceso)
from app.siniestros import siniestros_route

NOMBRE_SERVICIO = 'Siniestros'

# Tarjetas del resumen -> nombre con el que el front pide su listado.
# Forma de cada item de cada listado (para cuando haya datos reales):
#   plazos          id, folio, cliente, aseguradora, estatus,
#                   plazo (texto, ej. "Vencido hace 2 días"),
#                   plazo_nivel ("vencido" | "por_vencer")
#   sin_movimiento  id, folio, cliente, aseguradora, estatus,
#                   ultima_actualizacion, dias_sin_movimiento
#   pagos           id, folio, cliente, aseguradora, monto_pagado,
#                   fecha_pago, contactos
#   aseguradora     id, folio, cliente, aseguradora, estatus,
#                   enviado_el, dias_en_espera
LISTADOS = ('plazos', 'sin_movimiento', 'pagos', 'aseguradora')


def tiene_acceso_siniestros():
    """True si el nivel del usuario tiene el servicio "Siniestros".

    A diferencia de main.routes.check_access, no truena si el servicio
    todavía no existe en la BD (migración sin correr): simplemente
    niega el acceso.
    """
    if not current_user.is_authenticated:
        return False
    servicio = Servicio.query.filter_by(nombre=NOMBRE_SERVICIO).first()
    if not servicio:
        return False
    return Acceso.query.filter_by(
        servicio_id=servicio.id, nivel_id=current_user.nivel_id
    ).first() is not None


# ---------------------------------------------------------------------------
# Consulta base de siniestros activos
# ---------------------------------------------------------------------------
DIAS_SIN_MOVIMIENTO = 3      # a partir de cuántos días sin cambios cuenta "sin movimiento"
HORAS_POR_VENCER = 72        # un plazo "por vencer" es el que vence en menos de esto


def _query_activos():
    return (
        db.session.query(Siniestro, SiniestroProceso, SiniestroEstatus,
                         Poliza, Cliente, Aseguradora)
        .join(SiniestroProceso, SiniestroProceso.id == Siniestro.proceso_id)
        .join(SiniestroEstatus, SiniestroEstatus.id == Siniestro.estatus_id)
        .join(Poliza, Poliza.id == Siniestro.poliza_id)
        .join(Cliente, Cliente.id == Poliza.cliente_id)
        .join(Aseguradora, Aseguradora.id == Siniestro.aseguradora_id)
        .filter(Siniestro.estado == 'Activo')
    )


def _plazo(fecha_limite, ahora):
    """(nivel, texto) del plazo. nivel: vencido | por_vencer | en_tiempo | none."""
    if fecha_limite is None:
        return 'none', '—'
    seg = (fecha_limite - ahora).total_seconds()
    vencido = seg < 0
    seg = abs(seg)
    horas, dias = int(seg // 3600), int(seg // 86400)
    if horas < 24:
        magnitud = 'menos de 1 hora' if horas < 1 else f'{horas} {"hora" if horas == 1 else "horas"}'
    else:
        magnitud = f'{dias} {"día" if dias == 1 else "días"}'
    if vencido:
        return 'vencido', f'Vencido hace {magnitud}'
    if horas < HORAS_POR_VENCER:
        return 'por_vencer', ('Vence mañana' if 24 <= horas < 48 else f'Vence en {magnitud}')
    return 'en_tiempo', f'En tiempo · {dias} días'


def _pick(d, *keys):
    return {k: d[k] for k in keys}


def _fmt(dt):
    return dt.strftime('%d/%m/%Y') if dt else ''


def _filas_activas():
    """Siniestros activos ya serializados, con su relación origen/derivado."""
    ahora = datetime.now()
    filas = _query_activos().all()
    folio_por_id = {s.id: s.folio for s, *_ in filas}
    derivados = {}
    for s, *_ in filas:
        if s.origen_id:
            derivados[s.origen_id] = derivados.get(s.origen_id, 0) + 1
    # el origen puede estar cerrado: se consulta su folio aparte
    faltan = {s.origen_id for s, *_ in filas if s.origen_id and s.origen_id not in folio_por_id}
    if faltan:
        for o in Siniestro.query.filter(Siniestro.id.in_(faltan)).all():
            folio_por_id[o.id] = o.folio
    out = []
    for s, pr, es, po, cl, ase in filas:
        nivel, texto = _plazo(s.fecha_limite, ahora)
        out.append({
            'id': s.id, 'folio': s.folio,
            'proceso': pr.nombre, 'proceso_clave': pr.clave,
            'cliente': f'{cl.nombre} {cl.apellido}'.strip(),
            'poliza': po.poliza, 'aseguradora': ase.aseguradora,
            'estatus': es.nombre, 'estatus_tipo': es.tipo,
            'plazo': texto, 'plazo_nivel': nivel,
            '_limite': s.fecha_limite,
            'apertura': _fmt(s.fecha_apertura),
            'apertura_iso': s.fecha_apertura.strftime('%Y-%m-%d'),
            'origen': folio_por_id.get(s.origen_id),
            'n_derivados': derivados.get(s.id, 0),
            '_ultima': s.ultima_actualizacion,
        })
    return out


def _resumen():
    filas = _filas_activas()
    ahora = datetime.now()
    limite = ahora - timedelta(days=DIAS_SIN_MOVIMIENTO)
    return {
        'plazos_vencidos': sum(1 for f in filas if f['plazo_nivel'] == 'vencido'),
        'plazos_por_vencer': sum(1 for f in filas if f['plazo_nivel'] == 'por_vencer'),
        'sin_movimiento': sum(1 for f in filas if f['_ultima'] <= limite),
        # TODO (etapa de pagos): requiere la tabla de pagos.
        'pagos_por_confirmar': 0,
        'en_espera_aseguradora': sum(1 for f in filas if f['estatus_tipo'] == 'aseguradora'),
    }


def _listado(tarjeta):
    filas = _filas_activas()
    ahora = datetime.now()
    items = []
    if tarjeta == 'plazos':
        sel = [f for f in filas if f['plazo_nivel'] in ('vencido', 'por_vencer')]
        sel.sort(key=lambda f: f['_limite'])
        for f in sel:
            items.append(_pick(f, 'id', 'folio', 'cliente', 'aseguradora', 'estatus', 'plazo',
                               'plazo_nivel'))
    elif tarjeta == 'sin_movimiento':
        limite = ahora - timedelta(days=DIAS_SIN_MOVIMIENTO)
        sel = [f for f in filas if f['_ultima'] <= limite]
        sel.sort(key=lambda f: f['_ultima'])
        for f in sel:
            items.append(dict(_pick(f, 'id', 'folio', 'cliente', 'aseguradora', 'estatus'),
                              ultima_actualizacion=_fmt(f['_ultima']),
                              dias_sin_movimiento=(ahora - f['_ultima']).days))
    elif tarjeta == 'aseguradora':
        sel = [f for f in filas if f['estatus_tipo'] == 'aseguradora']
        sel.sort(key=lambda f: f['_ultima'])
        for f in sel:
            items.append(dict(_pick(f, 'id', 'folio', 'cliente', 'aseguradora', 'estatus'),
                              enviado_el=_fmt(f['_ultima']),
                              dias_en_espera=(ahora - f['_ultima']).days))
    # 'pagos': TODO (etapa de pagos) -> lista vacía por ahora.
    return items


@siniestros_route.route('/')
@login_required
def index():
    if not tiene_acceso_siniestros():
        return redirect(url_for('main.index'))
    return render_template('siniestros.html', user=current_user)


@siniestros_route.route('/api/resumen')
@login_required
def api_resumen():
    if not tiene_acceso_siniestros():
        return jsonify({'error': 'Sin acceso'}), 403
    return jsonify(_resumen())


@siniestros_route.route('/api/listado/<tarjeta>')
@login_required
def api_listado(tarjeta):
    if not tiene_acceso_siniestros():
        return jsonify({'error': 'Sin acceso'}), 403
    if tarjeta not in LISTADOS:
        return jsonify({'error': 'Listado no encontrado'}), 404
    items = _listado(tarjeta)
    return jsonify({'items': items, 'total': len(items)})


@siniestros_route.route('/api/siniestros')
@login_required
def api_siniestros():
    """Todos los siniestros activos; la tabla filtra y pagina en el navegador."""
    if not tiene_acceso_siniestros():
        return jsonify({'error': 'Sin acceso'}), 403
    orden = {'vencido': 0, 'por_vencer': 1, 'en_tiempo': 2, 'none': 3}
    filas = _filas_activas()
    filas.sort(key=lambda f: (orden[f['plazo_nivel']], f['_limite'] or datetime.max, f['folio']))
    for f in filas:
        f.pop('_limite'); f.pop('_ultima')
    return jsonify({'items': filas, 'total': len(filas)})
