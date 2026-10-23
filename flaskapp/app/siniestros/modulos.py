"""
Módulo de Siniestros · Etapa 3: Historial, Pagos, Plantillas (requisitos,
campos, tipos, estatus, mensajes) y Reportes.  Todo es JSON: la pantalla
(siniestros_modulos.js) filtra y pagina en el navegador igual que la tabla de activos.
"""
import re
from datetime import date, datetime, timedelta
from functools import wraps

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func

from app import db
from app.models import (Aseguradora, Cliente, Poliza, Siniestro, SiniestroBitacora,
                        SiniestroCampo, SiniestroCampoProceso, SiniestroCampoTipo,
                        SiniestroEstatus, SiniestroMensaje, SiniestroPago,
                        SiniestroPlantillaItem, SiniestroPlantillaReq, SiniestroProceso,
                        SiniestroRequisitoCat, SiniestroTipo, Usuario)
from app.siniestros import siniestros_route
from app.siniestros.routes import _fmt, tiene_acceso_siniestros

CONCEPTOS = ['Pago a hospital', 'Reembolso al asegurado', 'Indemnización', 'Pago a beneficiario', 'Honorarios médicos']
TIPOS_DATO = ['Texto', 'Texto largo', 'Número', 'Monto', 'Fecha', 'Fecha y hora', 'Sí / No', 'Lista']
TIPOS_ESTATUS = ['Aseguradora', 'Pendiente', 'Otro', 'Final']
CANALES = ['WhatsApp / Correo', 'WhatsApp', 'Correo']

# Metas de los indicadores (PROVISIONAL, a confirmar con el cliente).
#   unidad: horas | dias_habiles ; meta: tope de tiempo ; pct: % de casos que debe cumplirlo
METAS = {
    'CIR': {'meta': 9, 'unidad': 'días hábiles', 'pct': 95, 'texto': '≤ 9 días hábiles'},
    'PD': {'meta': 3, 'unidad': 'horas', 'pct': 95, 'texto': '≤ 3 horas'},
    'REM': {'meta': 10, 'unidad': 'días hábiles', 'pct': 95, 'texto': '≤ 10 días hábiles desde «Documentación completa»'},
    'RA': {'meta': 10, 'unidad': 'días hábiles', 'pct': 95, 'texto': '≤ 10 días hábiles'},
    'VI': {'meta': 15, 'unidad': 'días hábiles', 'pct': 95, 'texto': '≤ 15 días hábiles (+ dictamen ≤ 30 días naturales)'},
    'SI': None,
}
META_PROCEDENTE = 95


def api(path, **kw):
    """Ruta protegida (login + acceso al módulo) con manejo de errores uniforme."""
    def deco(fn):
        @siniestros_route.route('/api/' + path, **kw)
        @login_required
        @wraps(fn)
        def inner(*a, **k):
            if not tiene_acceso_siniestros():
                return jsonify({'error': 'Sin acceso'}), 403
            try:
                return fn(*a, **k)
            except ValueError as e:
                db.session.rollback()
                return jsonify({'error': str(e)}), 400
            except Exception as e:   # noqa: BLE001
                db.session.rollback()
                return jsonify({'error': f'Error del servidor: {e}'}), 500
        return inner
    return deco


def _j():
    return request.get_json(silent=True) or {}


def _req(d, *claves):
    for c in claves:
        if d.get(c) in (None, '', []):
            raise ValueError(f'Falta el campo «{c}».')


def _proceso(clave_o_id):
    q = SiniestroProceso.query
    p = q.filter_by(id=clave_o_id).first() if isinstance(clave_o_id, int) else q.filter_by(clave=clave_o_id).first()
    if not p:
        raise ValueError('Proceso no válido.')
    return p


# ---------------------------------------------------------------------------
# Catálogos generales (para llenar combos)
# ---------------------------------------------------------------------------
@api('catalogos')
def catalogos():
    return jsonify({
        'procesos': [{'id': p.id, 'clave': p.clave, 'nombre': p.nombre} for p in SiniestroProceso.query.order_by(SiniestroProceso.id)],
        'aseguradoras': [{'id': a.id, 'nombre': a.aseguradora} for a in Aseguradora.query.order_by(Aseguradora.aseguradora)],
        'conceptos': CONCEPTOS, 'tipos_dato': TIPOS_DATO, 'tipos_estatus': TIPOS_ESTATUS, 'canales': CANALES,
        'metas': METAS,
    })


# ---------------------------------------------------------------------------
# Días hábiles (sin sábados, domingos ni feriados oficiales de México) y plazos
# ---------------------------------------------------------------------------
def _nth_weekday(y, m, wd, n):
    d = date(y, m, 1)
    d += timedelta(days=(wd - d.weekday()) % 7)
    return d + timedelta(weeks=n - 1)


def feriados_mx(y):
    """Feriados oficiales (LFT art. 74): 1 ene, 1.er lunes de feb, 3.er lunes de mar, 1 may,
    16 sep, 3.er lunes de nov, 1 oct cada 6 años (cambio de Poder Ejecutivo) y 25 dic."""
    f = {date(y, 1, 1), _nth_weekday(y, 2, 0, 1), _nth_weekday(y, 3, 0, 3), date(y, 5, 1),
         date(y, 9, 16), _nth_weekday(y, 11, 0, 3), date(y, 12, 25)}
    if y >= 2024 and (y - 2024) % 6 == 0:
        f.add(date(y, 10, 1))
    return f


def es_habil(d):
    d = d.date() if isinstance(d, datetime) else d
    return d.weekday() < 5 and d not in feriados_mx(d.year)


def sumar_dias_habiles(dt, n):
    d = dt
    while n > 0:
        d += timedelta(days=1)
        if es_habil(d):
            n -= 1
    return d


def dias_habiles_entre(a, b):
    """Días hábiles transcurridos después de la fecha de `a` hasta la fecha de `b` (mismo día = 0)."""
    n, d, fin = 0, a.date(), b.date()
    while d < fin:
        d += timedelta(days=1)
        if es_habil(d):
            n += 1
    return n


def plazo_desde(clave, desde, estatus_nombre=''):
    """Fecha límite de un siniestro que empieza a medirse en `desde` (apertura o reapertura).
    REM corre desde «Documentación completa»; SI no tiene meta."""
    m = METAS.get(clave)
    if not m:
        return None
    if clave == 'REM' and 'documentación completa' not in (estatus_nombre or '').lower():
        return None
    return desde + timedelta(hours=m['meta']) if m['unidad'] == 'horas' else sumar_dias_habiles(desde, m['meta'])


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------
def _tiempo_total(ini, fin, clave):
    """Tiempo del ciclo vigente (desde la apertura o la última reapertura hasta el cierre)."""
    if clave == 'PD':
        mins = max(0, int((fin - ini).total_seconds() // 60))
        return f'{mins // 60} h {mins % 60:02d} min'
    d = dias_habiles_entre(ini, fin)
    return f'{d} {"día hábil" if d == 1 else "días hábiles"}'


def _dtf(dt):
    return dt.strftime('%d/%m/%Y %H:%M') if dt else ''


@api('historial')
def historial():
    filas = (db.session.query(Siniestro, SiniestroProceso, Poliza, Cliente, Aseguradora)
             .join(SiniestroProceso, SiniestroProceso.id == Siniestro.proceso_id)
             .join(Poliza, Poliza.id == Siniestro.poliza_id)
             .join(Cliente, Cliente.id == Poliza.cliente_id)
             .join(Aseguradora, Aseguradora.id == Siniestro.aseguradora_id)
             .filter(Siniestro.estado == 'Cerrado').order_by(Siniestro.fecha_cierre.desc()).all())
    ids = [f[0].id for f in filas]
    nombres = {u.id: f'{u.nombre} {u.apellido}'.strip() for u in Usuario.query.all()}
    tipos = {t.id: t.nombre for t in SiniestroTipo.query.all()}
    pagado, reaps, cierre_por = {}, {}, {}
    if ids:
        for sid, tot in (db.session.query(SiniestroPago.siniestro_id, func.sum(SiniestroPago.monto))
                         .filter(SiniestroPago.siniestro_id.in_(ids), SiniestroPago.estado == 'Pagado')
                         .group_by(SiniestroPago.siniestro_id).all()):
            pagado[sid] = float(tot or 0)
        bit = (SiniestroBitacora.query.filter(SiniestroBitacora.siniestro_id.in_(ids),
                                              SiniestroBitacora.accion.in_(['Reapertura', 'Cierre']))
               .order_by(SiniestroBitacora.fecha, SiniestroBitacora.id).all())
        for b in bit:
            if b.accion == 'Cierre':
                cierre_por[b.siniestro_id] = b.usuario_id          # el último cierre es el vigente
            else:
                m = re.match(r'Reabierto en «(.*?)»\.(?: Nuevo plazo: (.*?)\.)? Motivo: (.*)', b.detalle or '', re.S)
                reaps.setdefault(b.siniestro_id, []).append({
                    'fecha': _dtf(b.fecha), 'usuario': nombres.get(b.usuario_id, '—'),
                    'estatus': m.group(1) if m else '', 'plazo': (m.group(2) or '') if m else '',
                    'motivo': m.group(3) if m else (b.detalle or '')})
    out = []
    for s, pr, po, cl, ase in filas:
        cumple = None if s.fecha_limite is None or s.fecha_cierre is None else s.fecha_cierre <= s.fecha_limite
        rs = reaps.get(s.id, [])
        ini = s.fecha_apertura
        if rs:
            ult = [b for b in bit if b.siniestro_id == s.id and b.accion == 'Reapertura'][-1]
            ini = ult.fecha or ini
        uid = cierre_por.get(s.id)
        out.append({'id': s.id, 'folio': s.folio, 'proceso': pr.nombre, 'proceso_clave': pr.clave,
                    'tipo': tipos.get(s.tipo_id, '—'), 'cliente': f'{cl.nombre} {cl.apellido}'.strip(), 'poliza': po.poliza,
                    'aseguradora': ase.aseguradora, 'resultado': s.resultado or 'Cerrado',
                    'apertura': _fmt(s.fecha_apertura), 'cierre': _fmt(s.fecha_cierre),
                    'cierre_iso': s.fecha_cierre.strftime('%Y-%m-%d') if s.fecha_cierre else '',
                    'tiempo': _tiempo_total(ini, s.fecha_cierre, pr.clave) if s.fecha_cierre else '', 'cumple': cumple,
                    'inicio_ciclo': _dtf(ini), 'plazo': _dtf(s.fecha_limite), 'pagado': pagado.get(s.id, 0.0),
                    'cerrado_por': nombres.get(uid, '—') if uid else '—', 'cerrado_por_id': uid or 0,
                    'reaperturas': rs, 'n_reap': len(rs)})
    cierran = sorted({(o['cerrado_por_id'], o['cerrado_por']) for o in out if o['cerrado_por_id']}, key=lambda x: x[1])
    return jsonify({'items': out, 'total': len(out), 'cierran': [{'id': i, 'nombre': n} for i, n in cierran],
                    'tipos': sorted({o['tipo'] for o in out if o['tipo'] != '—'})})


@api('siniestros/<int:sid>/reabrir', methods=['POST'])
def reabrir(sid):
    d = _j()
    _req(d, 'estatus_id', 'motivo')
    if len(d['motivo'].strip()) < 5:
        raise ValueError('El motivo es obligatorio.')
    s = Siniestro.query.get_or_404(sid)
    if s.estado != 'Cerrado':
        raise ValueError('El siniestro no está cerrado.')
    es = SiniestroEstatus.query.get(int(d['estatus_id']))
    if not es or es.proceso_id != s.proceso_id or es.es_final:
        raise ValueError('Elige un estatus válido del proceso.')
    ahora = datetime.now()
    clave = SiniestroProceso.query.get(s.proceso_id).clave
    # Reapertura = el siniestro vuelve a medirse como nuevo, desde el estatus elegido.
    s.estado, s.estatus_id, s.resultado = 'Activo', es.id, None
    s.fecha_cierre, s.ultima_actualizacion = None, ahora
    s.fecha_limite = plazo_desde(clave, ahora, es.nombre)
    plazo = f' Nuevo plazo: {_dtf(s.fecha_limite)}.' if s.fecha_limite else ''
    db.session.add(SiniestroBitacora(siniestro_id=s.id, usuario_id=current_user.id, accion='Reapertura',
                                     detalle=f'Reabierto en «{es.nombre}».{plazo} Motivo: {d["motivo"].strip()}'[:500]))
    db.session.commit()
    return jsonify({'ok': True, 'folio': s.folio, 'estatus': es.nombre, 'plazo': _dtf(s.fecha_limite)})


# ---------------------------------------------------------------------------
# Pagos
# ---------------------------------------------------------------------------
@api('pagos')
def pagos():
    filas = (db.session.query(SiniestroPago, Siniestro, SiniestroProceso, Poliza, Cliente, Aseguradora)
             .join(Siniestro, Siniestro.id == SiniestroPago.siniestro_id)
             .join(SiniestroProceso, SiniestroProceso.id == Siniestro.proceso_id)
             .join(Poliza, Poliza.id == Siniestro.poliza_id)
             .join(Cliente, Cliente.id == Poliza.cliente_id)
             .join(Aseguradora, Aseguradora.id == Siniestro.aseguradora_id)
             .order_by(SiniestroPago.fecha_pago.is_(None).desc(), SiniestroPago.fecha_pago.desc(), SiniestroPago.id.desc()).all())
    nombres = {u.id: u.username for u in Usuario.query.all()}
    tipos = {t.id: t.nombre for t in SiniestroTipo.query.all()}
    out = [{'id': p.id, 'siniestro_id': s.id, 'fecha': _fmt(p.fecha_pago) if p.fecha_pago else 'Sin fecha',
            'fecha_iso': p.fecha_pago.strftime('%Y-%m-%d') if p.fecha_pago else '',
            'folio': s.folio, 'proceso': pr.nombre, 'proceso_clave': pr.clave, 'tipo': tipos.get(s.tipo_id, '—'),
            'cliente': f'{cl.nombre} {cl.apellido}'.strip(), 'beneficiario': p.beneficiario or '—',
            'aseguradora': ase.aseguradora, 'concepto': p.concepto, 'monto': float(p.monto), 'estado': p.estado,
            'motivo': p.motivo_cancelacion, 'comprobante': bool(p.comprobante),
            'registro': nombres.get(p.registrado_por, '—'), 'registro_id': p.registrado_por or 0,
            'activo': s.estado == 'Activo'} for p, s, pr, po, cl, ase in filas]
    reg = sorted({(o['registro_id'], o['registro']) for o in out if o['registro_id']}, key=lambda x: x[1])
    return jsonify({'items': out, 'total': len(out), 'registran': [{'id': i, 'nombre': n} for i, n in reg],
                    'tipos': sorted({o['tipo'] for o in out if o['tipo'] != '—'})})


@api('pagos/<int:pid>/cancelar', methods=['POST'])
def cancelar_pago(pid):
    d = _j()
    _req(d, 'motivo')
    p = SiniestroPago.query.get_or_404(pid)
    if p.estado == 'Cancelado':
        raise ValueError('El pago ya está cancelado.')
    p.estado, p.motivo_cancelacion = 'Cancelado', d['motivo'].strip()[:255]
    db.session.add(SiniestroBitacora(siniestro_id=p.siniestro_id, usuario_id=current_user.id, accion='Pago cancelado',
                                     detalle=f'Pago #{p.id} por ${float(p.monto):,.2f}. Motivo: {p.motivo_cancelacion}'[:500]))
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Tipos de siniestro
# ---------------------------------------------------------------------------
def _uso_tipo(tid):
    pl = SiniestroPlantillaReq.query.filter_by(tipo_id=tid).count()
    ca = SiniestroCampoTipo.query.filter_by(tipo_id=tid).count()
    si = Siniestro.query.filter_by(tipo_id=tid).count()
    return pl, ca, si


def _tipo_json(t, claves):
    pl, ca, si = _uso_tipo(t.id)
    return {'id': t.id, 'proceso': claves[t.proceso_id], 'nombre': t.nombre, 'activo': bool(t.activo),
            'plantillas': pl, 'campos': ca, 'siniestros': si}


def _claves():
    return {p.id: p.clave for p in SiniestroProceso.query.all()}


@api('tipos')
def tipos_lista():
    cl = _claves()
    items = [_tipo_json(t, cl) for t in SiniestroTipo.query.order_by(SiniestroTipo.proceso_id, SiniestroTipo.nombre)]
    return jsonify({'items': items, 'total': len(items)})


def _guardar_tipo(t, d):
    _req(d, 'proceso', 'nombre')
    p = _proceso(d['proceso'])
    nombre = d['nombre'].strip()[:60]
    dup = SiniestroTipo.query.filter(SiniestroTipo.proceso_id == p.id, func.lower(SiniestroTipo.nombre) == nombre.lower())
    if t:
        dup = dup.filter(SiniestroTipo.id != t.id)
    if dup.first():
        raise ValueError('Ese tipo ya existe en el proceso.')
    if not t:
        t = SiniestroTipo(activo=True)
        db.session.add(t)
    elif t.proceso_id != p.id and (_uso_tipo(t.id) != (0, 0, 0)):
        raise ValueError('No se puede cambiar de proceso un tipo que ya se usa. Crea uno nuevo en el otro proceso.')
    t.proceso_id, t.nombre = p.id, nombre
    db.session.commit()
    return jsonify(_tipo_json(t, _claves()))


@api('tipos', methods=['POST'])
def tipos_crear():
    return _guardar_tipo(None, _j())


@api('tipos/<int:i>', methods=['PUT'])
def tipos_editar(i):
    return _guardar_tipo(SiniestroTipo.query.get_or_404(i), _j())


@api('tipos/<int:i>/toggle', methods=['POST'])
def tipos_toggle(i):
    t = SiniestroTipo.query.get_or_404(i)
    t.activo = not t.activo
    db.session.commit()
    return jsonify({'ok': True, 'activo': bool(t.activo)})


@api('tipos/<int:i>', methods=['DELETE'])
def tipos_borrar(i):
    t = SiniestroTipo.query.get_or_404(i)
    pl, ca, si = _uso_tipo(i)
    if pl or ca or si:
        usos = [x for x in (f'{pl} plantilla(s) de requisitos' if pl else '', f'{ca} campo(s)' if ca else '',
                            f'{si} siniestro(s)' if si else '') if x]
        return jsonify({'error': 'Lo usan ' + ', '.join(usos) + '.', 'en_uso': True}), 409
    db.session.delete(t)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Campos para crear siniestros
# ---------------------------------------------------------------------------
def _campo_json(c, claves):
    procs = [claves[r.proceso_id] for r in SiniestroCampoProceso.query.filter_by(campo_id=c.id)]
    tipos = [r.tipo_id for r in SiniestroCampoTipo.query.filter_by(campo_id=c.id)]
    nombres = {t.id: t.nombre for t in SiniestroTipo.query.filter(SiniestroTipo.id.in_(tipos or [0]))}
    return {'id': c.id, 'nombre': c.nombre, 'tipo_dato': c.tipo_dato, 'opciones': c.opciones or '', 'obligatorio': bool(c.obligatorio),
            'activo': bool(c.activo), 'procesos': sorted(procs, key=['CIR', 'PD', 'REM', 'RA', 'SI', 'VI'].index),
            'tipos': tipos, 'tipos_nombres': [nombres[t] for t in tipos if t in nombres]}


@api('campos')
def campos_lista():
    cl = _claves()
    items = [_campo_json(c, cl) for c in SiniestroCampo.query.order_by(SiniestroCampo.id)]
    return jsonify({'items': items, 'total': len(items)})


def _guardar_campo(c, d):
    _req(d, 'nombre', 'procesos')
    if d.get('tipo_dato') not in TIPOS_DATO:
        raise ValueError('Tipo de dato no válido.')
    if d['tipo_dato'] == 'Lista' and not (d.get('opciones') or '').strip():
        raise ValueError('Escribe las opciones de la lista.')
    nombre = d['nombre'].strip()[:80]
    dup = SiniestroCampo.query.filter(func.lower(SiniestroCampo.nombre) == nombre.lower())
    if c:
        dup = dup.filter(SiniestroCampo.id != c.id)
    if dup.first():
        raise ValueError('Ya existe un campo con ese nombre.')
    if not c:
        c = SiniestroCampo(activo=True)
        db.session.add(c)
    c.nombre, c.tipo_dato = nombre, d['tipo_dato']
    c.opciones = (d.get('opciones') or '').strip()[:255] if d['tipo_dato'] == 'Lista' else None
    c.obligatorio = bool(d.get('obligatorio'))
    db.session.flush()
    SiniestroCampoProceso.query.filter_by(campo_id=c.id).delete()
    SiniestroCampoTipo.query.filter_by(campo_id=c.id).delete()
    procs = [_proceso(k) for k in d['procesos']]
    for p in procs:
        db.session.add(SiniestroCampoProceso(campo_id=c.id, proceso_id=p.id))
    ids_validos = {p.id for p in procs}
    for tid in d.get('tipos') or []:
        t = SiniestroTipo.query.get(int(tid))
        if not t or t.proceso_id not in ids_validos:
            raise ValueError('Un tipo elegido no pertenece a los procesos del campo.')
        db.session.add(SiniestroCampoTipo(campo_id=c.id, tipo_id=t.id))
    db.session.commit()
    return jsonify(_campo_json(c, _claves()))


@api('campos', methods=['POST'])
def campos_crear():
    return _guardar_campo(None, _j())


@api('campos/<int:i>', methods=['PUT'])
def campos_editar(i):
    return _guardar_campo(SiniestroCampo.query.get_or_404(i), _j())


@api('campos/<int:i>/toggle', methods=['POST'])
def campos_toggle(i):
    c = SiniestroCampo.query.get_or_404(i)
    c.activo = not c.activo
    db.session.commit()
    return jsonify({'ok': True, 'activo': bool(c.activo)})


@api('campos/<int:i>', methods=['DELETE'])
def campos_borrar(i):
    db.session.delete(SiniestroCampo.query.get_or_404(i))   # relaciones en cascada
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Estatus
# ---------------------------------------------------------------------------
def _est_tipo(e):
    return 'Final' if e.es_final else e.tipo.capitalize()


def _est_json(e, claves):
    uso = Siniestro.query.filter_by(estatus_id=e.id, estado='Activo').count()
    return {'id': e.id, 'proceso': claves[e.proceso_id], 'orden': e.orden, 'nombre': e.nombre, 'tipo': _est_tipo(e),
            'activo': bool(e.activo), 'uso': uso}


@api('estatus')
def estatus_lista():
    cl = _claves()
    items = [_est_json(e, cl) for e in SiniestroEstatus.query.order_by(SiniestroEstatus.proceso_id, SiniestroEstatus.orden)]
    return jsonify({'items': items, 'total': len(items)})


def _guardar_estatus(e, d):
    _req(d, 'proceso', 'nombre')
    if d.get('tipo') not in TIPOS_ESTATUS:
        raise ValueError('Tipo de estatus no válido.')
    p = _proceso(d['proceso'])
    nombre = d['nombre'].strip()[:40]
    dup = SiniestroEstatus.query.filter(SiniestroEstatus.proceso_id == p.id, func.lower(SiniestroEstatus.nombre) == nombre.lower())
    if e:
        dup = dup.filter(SiniestroEstatus.id != e.id)
    if dup.first():
        raise ValueError('Ese estatus ya existe en el proceso.')
    if e and e.proceso_id != p.id and Siniestro.query.filter_by(estatus_id=e.id).count():
        raise ValueError('No se puede cambiar de proceso un estatus que ya tiene siniestros.')
    try:
        orden = int(d.get('orden') or 0)
    except (TypeError, ValueError):
        raise ValueError('El orden debe ser un número.')
    if not orden:
        orden = (db.session.query(func.max(SiniestroEstatus.orden)).filter_by(proceso_id=p.id).scalar() or 0) + 1
    if not e:
        e = SiniestroEstatus(activo=True)
        db.session.add(e)
    e.proceso_id, e.nombre, e.orden = p.id, nombre, orden
    e.es_final = d['tipo'] == 'Final'
    e.tipo = 'otro' if d['tipo'] in ('Final', 'Otro') else d['tipo'].lower()
    db.session.commit()
    return jsonify(_est_json(e, _claves()))


@api('estatus', methods=['POST'])
def estatus_crear():
    return _guardar_estatus(None, _j())


@api('estatus/<int:i>', methods=['PUT'])
def estatus_editar(i):
    return _guardar_estatus(SiniestroEstatus.query.get_or_404(i), _j())


@api('estatus/<int:i>/toggle', methods=['POST'])
def estatus_toggle(i):
    e = SiniestroEstatus.query.get_or_404(i)
    e.activo = not e.activo
    db.session.commit()
    return jsonify({'ok': True, 'activo': bool(e.activo)})


@api('estatus/<int:i>', methods=['DELETE'])
def estatus_borrar(i):
    e = SiniestroEstatus.query.get_or_404(i)
    n = Siniestro.query.filter_by(estatus_id=i).count()
    if n:
        return jsonify({'error': f'Hay {n} siniestro(s) con este estatus.', 'en_uso': True}), 409
    db.session.delete(e)
    db.session.commit()
    return jsonify({'ok': True})


@api('estatus/proceso/<clave>')
def estatus_de_proceso(clave):
    """Estatus activos y no finales de un proceso (para reabrir)."""
    p = _proceso(clave)
    q = SiniestroEstatus.query.filter_by(proceso_id=p.id, activo=True, es_final=False).order_by(SiniestroEstatus.orden)
    return jsonify({'items': [{'id': e.id, 'nombre': e.nombre} for e in q]})


# ---------------------------------------------------------------------------
# Plantillas de requisitos
# ---------------------------------------------------------------------------
def _pl_json(pl, claves, aseg, tipos):
    items = (SiniestroPlantillaItem.query.filter_by(plantilla_id=pl.id).order_by(SiniestroPlantillaItem.orden, SiniestroPlantillaItem.id).all())
    return {'id': pl.id, 'proceso': claves[pl.proceso_id], 'aseguradora_id': pl.aseguradora_id, 'aseguradora': aseg.get(pl.aseguradora_id, '—'),
            'tipo_id': pl.tipo_id, 'tipo': tipos.get(pl.tipo_id, '—'), 'activo': bool(pl.activo),
            'requisitos': [{'nombre': i.nombre, 'obligatorio': bool(i.obligatorio)} for i in items],
            'modificada': pl.updated_at.strftime('%d/%m/%Y') if pl.updated_at else ''}


def _maps():
    return ({a.id: a.aseguradora for a in Aseguradora.query.all()}, {t.id: t.nombre for t in SiniestroTipo.query.all()})


@api('plantillas')
def plantillas_lista():
    cl, (aseg, tipos) = _claves(), _maps()
    items = [_pl_json(p, cl, aseg, tipos) for p in SiniestroPlantillaReq.query.order_by(SiniestroPlantillaReq.proceso_id, SiniestroPlantillaReq.aseguradora_id)]
    return jsonify({'items': items, 'total': len(items),
                    'catalogo': [r.nombre for r in SiniestroRequisitoCat.query.order_by(SiniestroRequisitoCat.nombre)]})


def _guardar_plantilla(pl, d):
    _req(d, 'proceso', 'aseguradora_id', 'tipo_id')
    p = _proceso(d['proceso'])
    if p.clave == 'SI':
        raise ValueError('Siniestro Inicial no usa plantilla de requisitos.')
    t = SiniestroTipo.query.get(int(d['tipo_id']))
    if not t or t.proceso_id != p.id:
        raise ValueError('El tipo no pertenece al proceso.')
    if not Aseguradora.query.get(int(d['aseguradora_id'])):
        raise ValueError('Aseguradora no válida.')
    reqs, vistos = [], set()
    for r in d.get('requisitos') or []:
        n = (r.get('nombre') or '').strip()[:120]
        if n and n.lower() not in vistos:
            vistos.add(n.lower())
            reqs.append((n, bool(r.get('obligatorio'))))
    if not any(o for _, o in reqs):
        raise ValueError('Agrega al menos un requisito obligatorio.')
    dup = SiniestroPlantillaReq.query.filter_by(proceso_id=p.id, aseguradora_id=int(d['aseguradora_id']), tipo_id=t.id)
    if pl:
        dup = dup.filter(SiniestroPlantillaReq.id != pl.id)
    if dup.first():
        raise ValueError('Ya existe una plantilla para ese proceso, aseguradora y tipo. Edítala o duplícala.')
    if not pl:
        pl = SiniestroPlantillaReq(activo=True)
        db.session.add(pl)
    pl.proceso_id, pl.aseguradora_id, pl.tipo_id = p.id, int(d['aseguradora_id']), t.id
    pl.updated_at = datetime.now()
    db.session.flush()
    SiniestroPlantillaItem.query.filter_by(plantilla_id=pl.id).delete()
    for i, (n, o) in enumerate(reqs):
        db.session.add(SiniestroPlantillaItem(plantilla_id=pl.id, nombre=n, obligatorio=o, orden=i))
    db.session.commit()
    aseg, tipos = _maps()
    return jsonify(_pl_json(pl, _claves(), aseg, tipos))


@api('plantillas', methods=['POST'])
def plantillas_crear():
    return _guardar_plantilla(None, _j())


@api('plantillas/<int:i>', methods=['PUT'])
def plantillas_editar(i):
    return _guardar_plantilla(SiniestroPlantillaReq.query.get_or_404(i), _j())


@api('plantillas/<int:i>/toggle', methods=['POST'])
def plantillas_toggle(i):
    pl = SiniestroPlantillaReq.query.get_or_404(i)
    pl.activo = not pl.activo
    db.session.commit()
    return jsonify({'ok': True, 'activo': bool(pl.activo)})


@api('plantillas/<int:i>', methods=['DELETE'])
def plantillas_borrar(i):
    db.session.delete(SiniestroPlantillaReq.query.get_or_404(i))
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Mensajes
# ---------------------------------------------------------------------------
def _ms_json(m):
    return {'id': m.id, 'nombre': m.nombre, 'uso': m.uso or '', 'procesos': m.procesos, 'canal': m.canal, 'texto': m.texto, 'activo': bool(m.activo)}


def _guardar_mensaje(m, d):
    _req(d, 'nombre', 'texto')
    if d.get('canal') not in CANALES:
        raise ValueError('Canal no válido.')
    claves = [c for c in (d.get('procesos') or []) if c in ('CIR', 'PD', 'REM', 'RA', 'SI', 'VI')]
    if not m:
        m = SiniestroMensaje(activo=True)
        db.session.add(m)
    m.nombre, m.uso, m.canal, m.texto = d['nombre'].strip()[:80], (d.get('uso') or '').strip()[:100], d['canal'], d['texto'].strip()
    m.procesos = 'TODOS' if len(claves) in (0, 6) else ','.join(claves)
    db.session.commit()
    return jsonify(_ms_json(m))


@api('mensajes')
def mensajes_lista():
    items = [_ms_json(m) for m in SiniestroMensaje.query.order_by(SiniestroMensaje.id)]
    return jsonify({'items': items, 'total': len(items)})


@api('mensajes', methods=['POST'])
def mensajes_crear():
    return _guardar_mensaje(None, _j())


@api('mensajes/<int:i>', methods=['PUT'])
def mensajes_editar(i):
    return _guardar_mensaje(SiniestroMensaje.query.get_or_404(i), _j())


@api('mensajes/<int:i>/toggle', methods=['POST'])
def mensajes_toggle(i):
    m = SiniestroMensaje.query.get_or_404(i)
    m.activo = not m.activo
    db.session.commit()
    return jsonify({'ok': True, 'activo': bool(m.activo)})


@api('mensajes/<int:i>', methods=['DELETE'])
def mensajes_borrar(i):
    db.session.delete(SiniestroMensaje.query.get_or_404(i))
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Reportes (solo siniestros cerrados)
# ---------------------------------------------------------------------------
def _rango(periodo, desde, hasta):
    hoy = date.today()
    if periodo == 'tri':
        ini = date(hoy.year, 3 * ((hoy.month - 1) // 3) + 1, 1)
    elif periodo == 'anio':
        ini = date(hoy.year, 1, 1)
    elif periodo == 'rango':
        try:
            ini, fin = date.fromisoformat(desde), date.fromisoformat(hasta)
        except (TypeError, ValueError):
            raise ValueError('Elige las dos fechas del rango.')
        if fin < ini:
            raise ValueError('La fecha final es anterior a la inicial.')
        return ini, fin
    else:
        ini = date(hoy.year, hoy.month, 1)
    return ini, hoy


def _cerrados(clave, ini, fin, aseg_id):
    q = (db.session.query(Siniestro).join(SiniestroProceso, SiniestroProceso.id == Siniestro.proceso_id)
         .filter(Siniestro.estado == 'Cerrado', SiniestroProceso.clave == clave,
                 Siniestro.fecha_cierre >= datetime.combine(ini, datetime.min.time()),
                 Siniestro.fecha_cierre < datetime.combine(fin + timedelta(days=1), datetime.min.time())))
    if aseg_id:
        q = q.filter(Siniestro.aseguradora_id == aseg_id)
    return q.all()


def _metricas(clave, ini, fin, aseg_id):
    lista = _cerrados(clave, ini, fin, aseg_id)
    n = len(lista)
    con_meta = [s for s in lista if s.fecha_limite is not None]
    dentro = sum(1 for s in con_meta if s.fecha_cierre <= s.fecha_limite)
    proced = sum(1 for s in lista if s.resultado == 'Procedente')
    rech = sum(1 for s in lista if s.resultado == 'Rechazado')
    fuera = len(con_meta) - dentro
    # Incidencias (PROVISIONAL): VIDA = dictámenes rechazados; resto = casos fuera de plazo.
    inc = rech if clave == 'VI' else fuera
    pct = lambda a, b: round(100 * a / b) if b else None   # noqa: E731
    return {'cerrados': n, 'pct_plazo': pct(dentro, len(con_meta)), 'pct_procedente': pct(proced, n), 'incidencias': inc}


def _suma_meses(d, k):
    m = d.month - 1 + k
    return date(d.year + m // 12, m % 12 + 1, 1)


@api('reportes')
def reportes():
    a = request.args
    clave = a.get('proceso', 'CIR')
    if clave not in METAS:
        raise ValueError('Proceso no válido.')
    aseg_id = int(a['aseguradora_id']) if a.get('aseguradora_id') else None
    ini, fin = _rango(a.get('periodo', 'mes'), a.get('desde'), a.get('hasta'))
    dias = (fin - ini).days + 1
    pini, pfin = ini - timedelta(days=dias), ini - timedelta(days=1)
    actual, previo = _metricas(clave, ini, fin, aseg_id), _metricas(clave, pini, pfin, aseg_id)
    hoy = date.today()
    tendencia = []
    for k in range(-4, 1):
        m0 = _suma_meses(date(hoy.year, hoy.month, 1), k)
        m1 = _suma_meses(m0, 1) - timedelta(days=1)
        met = _metricas(clave, m0, m1, aseg_id)
        tendencia.append({'mes': ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m0.month - 1],
                          'valor': met['pct_plazo'], 'casos': met['cerrados']})
    tabla = []
    for k in ['CIR', 'PD', 'REM', 'RA', 'SI', 'VI']:
        m = _metricas(k, ini, fin, aseg_id)
        tabla.append(dict(m, proceso=k, proceso_nombre=SiniestroProceso.query.filter_by(clave=k).first().nombre, meta=METAS[k]))
    return jsonify({'proceso': clave, 'meta': METAS[clave], 'meta_procedente': META_PROCEDENTE, 'desde': ini.isoformat(), 'hasta': fin.isoformat(),
                    'actual': actual, 'previo': previo, 'tendencia': tendencia, 'tabla': tabla})
