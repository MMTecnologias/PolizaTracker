"""
Módulo de Siniestros · Etapa 5: Nuevo siniestro.
Flujo: buscar póliza → validar (vigencia y recibo del periodo) → proceso/tipo → campos del catálogo → crear.
El siniestro solo guarda el vínculo a la póliza; cliente, aseguradora y vigencia se leen de ahí.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from flask import jsonify, request
from flask_login import current_user
from sqlalchemy import or_

from app import db
from app.models import (Aseguradora, Cliente, Poliza, Ramo, Siniestro, SiniestroBitacora, SiniestroCampo,
                        SiniestroCampoProceso, SiniestroCampoTipo, SiniestroEstatus, SiniestroPlantillaItem,
                        SiniestroPlantillaReq, SiniestroProceso, SiniestroTipo, SiniestroValor, Subramo)
from app.siniestros.activos import _nuevo_folio, _validar_poliza_para
from app.siniestros.modulos import METAS, api, _j, _req
from app.siniestros.routes import _fmt

# Ramo de la póliza → grupo de procesos de siniestros (otros ramos aún no tienen proceso).
GRUPO_POR_RAMO = {'GASTOS MEDICOS': 'GMM', 'AUTOS': 'AUTOS', 'AUTOMOVILES RESIDENTES': 'AUTOS', 'VIDA': 'VIDA'}


def _norm(s):
    t = (s or '').upper().replace('Ó', 'O').replace('É', 'E').replace('Í', 'I').replace('Á', 'A').replace('Ú', 'U')
    return ' '.join(t.replace('�', 'O').split())


def _grupo(ramo):
    """GM → GMM, Vida → VIDA y, por ahora, cualquier otro ramo se atiende como AUTOS (se afinará con el cliente)."""
    n = _norm(ramo)
    if n == 'GASTOS MEDICOS':
        return 'GMM'
    if n == 'VIDA':
        return 'VIDA'
    return 'AUTOS'


def sumar_dias_habiles(dt, n):
    d = dt
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def plazo_estimado(clave, desde):
    """Plazo provisional según las metas del proceso (REM corre desde «documentación completa»; SI sin meta)."""
    m = METAS.get(clave)
    if not m or clave == 'REM':
        return None
    return desde + timedelta(hours=m['meta']) if m['unidad'] == 'horas' else sumar_dias_habiles(desde, m['meta'])


def _fila_poliza(po, cl, ase, ra, sr):
    return {'id': po.id, 'poliza': po.poliza, 'cliente': f'{cl.nombre} {cl.apellido}'.strip(), 'rfc': cl.rfc, 'aseguradora': ase.aseguradora, 'aseguradora_id': po.aseguradora_id,
            'ramo': ra.ramo, 'subramo': sr.subramo, 'status': po.status, 'inicio': _fmt(po.fecha_inicio), 'fin': _fmt(po.fecha_termino),
            'grupo': _grupo(ra.ramo)}


def _q_polizas():
    return (db.session.query(Poliza, Cliente, Aseguradora, Ramo, Subramo)
            .join(Cliente, Cliente.id == Poliza.cliente_id).join(Aseguradora, Aseguradora.id == Poliza.aseguradora_id)
            .join(Ramo, Ramo.id == Poliza.ramo_id).join(Subramo, Subramo.id == Poliza.subramo_id))


@api('polizas/buscar')
def buscar_polizas():
    q = (request.args.get('q') or '').strip()
    if len(q) < 2:
        return jsonify({'items': []})
    like = f'%{q}%'
    rows = (_q_polizas().filter(or_(Poliza.poliza.like(like), Cliente.nombre.like(like), Cliente.apellido.like(like), Cliente.rfc.like(like),
                                    db.func.concat(Cliente.nombre, ' ', Cliente.apellido).like(like)))
            .order_by(Poliza.fecha_termino.desc()).limit(15).all())
    items = []
    for r in rows:
        f = _fila_poliza(*r)
        f['bloqueo'], f['aviso'] = _validar_poliza_para(r[0])
        items.append(f)
    items.sort(key=lambda f: bool(f['bloqueo']))
    return jsonify({'items': items})


@api('polizas/<int:pid>/validar')
def validar_poliza(pid):
    r = _q_polizas().filter(Poliza.id == pid).first()
    if not r:
        raise ValueError('La póliza no existe.')
    po, cl, ase, ra, sr = r
    info = _fila_poliza(*r)
    bloqueo, aviso = _validar_poliza_para(po)
    procesos = []
    if not bloqueo:
        for p in SiniestroProceso.query.filter_by(grupo=info['grupo']).order_by(SiniestroProceso.id):
            tipos = SiniestroTipo.query.filter_by(proceso_id=p.id, activo=True).order_by(SiniestroTipo.nombre).all()
            procesos.append({'id': p.id, 'clave': p.clave, 'nombre': p.nombre, 'tipos': [{'id': t.id, 'nombre': t.nombre} for t in tipos]})
    activos = Siniestro.query.filter_by(poliza_id=po.id, estado='Activo').count()
    return jsonify({'poliza': info, 'bloqueo': bloqueo, 'aviso': aviso, 'procesos': procesos, 'activos': activos,
                    'asegurado': info['cliente']})


def _campos_aplicables(proceso_id, tipo_id):
    ids = [r.campo_id for r in SiniestroCampoProceso.query.filter_by(proceso_id=proceso_id)]
    out = []
    for c in SiniestroCampo.query.filter(SiniestroCampo.id.in_(ids or [0]), SiniestroCampo.activo == True).order_by(SiniestroCampo.id):  # noqa: E712
        tipos = [r.tipo_id for r in SiniestroCampoTipo.query.filter_by(campo_id=c.id)]
        if tipos and (not tipo_id or tipo_id not in tipos):
            continue
        out.append(c)
    return out


@api('nuevo/campos')
def nuevo_campos():
    pid = int(request.args.get('proceso_id') or 0)
    tid = int(request.args.get('tipo_id') or 0) or None
    aid = int(request.args.get('aseguradora_id') or 0)
    pr = SiniestroProceso.query.get(pid)
    if not pr:
        raise ValueError('Proceso no válido.')
    campos = [{'id': c.id, 'nombre': c.nombre, 'tipo_dato': c.tipo_dato, 'opciones': [o.strip() for o in (c.opciones or '').split(',') if o.strip()],
               'obligatorio': bool(c.obligatorio)} for c in _campos_aplicables(pid, tid)]
    reqs = []
    if tid:
        pl = SiniestroPlantillaReq.query.filter_by(proceso_id=pid, aseguradora_id=aid, tipo_id=tid, activo=True).first()
        if pl:
            reqs = [{'nombre': i.nombre, 'obligatorio': bool(i.obligatorio)} for i in
                    SiniestroPlantillaItem.query.filter_by(plantilla_id=pl.id).order_by(SiniestroPlantillaItem.orden)]
    pe = plazo_estimado(pr.clave, datetime.now())
    meta = METAS.get(pr.clave)
    return jsonify({'campos': campos, 'requisitos': reqs, 'plazo': pe.strftime('%Y-%m-%dT%H:%M') if pe else '',
                    'plazo_texto': meta['texto'] if meta else 'Sin plazo definido para este proceso',
                    'plazo_nota': 'El plazo corre desde «Documentación completa».' if pr.clave == 'REM' else ''})


def _valida_valor(c, v):
    if v in (None, ''):
        if c.obligatorio:
            raise ValueError(f'«{c.nombre}» es obligatorio.')
        return None
    v = str(v).strip()
    t = c.tipo_dato
    try:
        if t == 'Fecha':
            date.fromisoformat(v)
        elif t == 'Fecha y hora':
            datetime.fromisoformat(v)
        elif t in ('Número', 'Monto'):
            n = Decimal(v.replace(',', '').replace('$', ''))
            if n < 0:
                raise ValueError
            v = str(n)
    except (ValueError, InvalidOperation):
        raise ValueError(f'«{c.nombre}» no tiene un valor válido.')
    if t == 'Sí / No' and v not in ('Sí', 'No'):
        raise ValueError(f'«{c.nombre}» debe ser Sí o No.')
    if t == 'Lista' and v not in [o.strip() for o in (c.opciones or '').split(',')]:
        raise ValueError(f'«{c.nombre}»: elige una opción de la lista.')
    return v[:2000]


@api('siniestros', methods=['POST'])
def crear_siniestro():
    d = _j()
    _req(d, 'poliza_id', 'proceso_id')
    po = Poliza.query.get(int(d['poliza_id']))
    if not po:
        raise ValueError('La póliza no existe.')
    ra = Ramo.query.get(po.ramo_id)
    bloqueo, _aviso = _validar_poliza_para(po)
    if bloqueo:
        raise ValueError(bloqueo)
    pr = SiniestroProceso.query.get(int(d['proceso_id']))
    if not pr or pr.grupo != _grupo(ra.ramo):
        raise ValueError('Ese proceso no corresponde al ramo de la póliza.')
    tipos_act = SiniestroTipo.query.filter_by(proceso_id=pr.id, activo=True).count()
    tipo_id = None
    if d.get('tipo_id'):
        t = SiniestroTipo.query.get(int(d['tipo_id']))
        if not t or t.proceso_id != pr.id or not t.activo:
            raise ValueError('El tipo no corresponde al proceso elegido.')
        tipo_id = t.id
    elif tipos_act:
        raise ValueError('Elige el tipo de siniestro.')
    est = SiniestroEstatus.query.filter_by(proceso_id=pr.id, activo=True, es_final=False).order_by(SiniestroEstatus.orden).first()
    if not est:
        raise ValueError(f'El proceso {pr.nombre} no tiene estatus activos; configúralos en Plantillas.')
    vals = d.get('campos') or {}
    registros, monto = [], None
    for c in _campos_aplicables(pr.id, tipo_id):
        v = _valida_valor(c, vals.get(str(c.id)))
        if v is not None:
            registros.append((c, v))
            if c.nombre == 'Monto reclamado':
                monto = Decimal(v).quantize(Decimal('0.01'))
    ahora = datetime.now()
    limite = None
    if d.get('fecha_limite'):
        try:
            limite = datetime.fromisoformat(d['fecha_limite'])
        except ValueError:
            raise ValueError('La fecha límite no es válida.')
    else:
        limite = plazo_estimado(pr.clave, ahora)
    s = Siniestro(folio=_nuevo_folio(pr.clave), proceso_id=pr.id, poliza_id=po.id, aseguradora_id=po.aseguradora_id, estatus_id=est.id,
                  fecha_apertura=ahora, fecha_limite=limite, ultima_actualizacion=ahora, estado='Activo', creado_por=current_user.id,
                  tipo_id=tipo_id, monto_reclamado=monto)
    db.session.add(s)
    db.session.flush()
    for c, v in registros:
        db.session.add(SiniestroValor(siniestro_id=s.id, campo_id=c.id, etiqueta=c.nombre, valor=v))
    nota = (d.get('comentario') or '').strip()
    db.session.add(SiniestroBitacora(siniestro_id=s.id, usuario_id=current_user.id, accion='Apertura',
                                     detalle=(f'Siniestro {s.folio} registrado.' + (f' {nota}' if nota else ''))[:500]))
    db.session.commit()
    return jsonify({'ok': True, 'id': s.id, 'folio': s.folio})
