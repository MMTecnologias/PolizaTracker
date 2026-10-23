"""
Módulo de Siniestros · Etapa 4: acciones de la tabla de Activos.
Detalle del siniestro (información, pagos, familia, bitácora), actualizar estatus,
notas de bitácora, registrar pago, montos, crear derivado, comunicaciones y cerrar.
"""
import mimetypes
import os
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from flask import jsonify, request, send_file
from flask_login import current_user
from werkzeug.utils import secure_filename

from app import db
from app.models import (Aseguradora, Cliente, Poliza, Recibo, Siniestro, SiniestroBitacora, SiniestroCampo,
                        SiniestroEstatus, SiniestroMensaje, SiniestroPago,
                        SiniestroPlantillaItem, SiniestroPlantillaReq, SiniestroProceso,
                        SiniestroTipo, SiniestroValor, Usuario)
from app.siniestros.modulos import api, _j, _req, CONCEPTOS
from app.siniestros.routes import _fmt, _plazo
from app.utils.document_storage import get_documentos_base

# Procesos entre los que se puede derivar, según el grupo del siniestro de origen.
DERIVA_A = {'GMM': ['CIR', 'PD', 'REM'], 'AUTOS': ['SI', 'RA'], 'VIDA': []}
EXT_COMPROBANTE = ('.pdf', '.jpg', '.jpeg', '.png')
MAX_COMPROBANTE = 10 * 1024 * 1024


def _dinero(v, campo, obligatorio=False):
    if v in (None, ''):
        if obligatorio:
            raise ValueError(f'«{campo}» es obligatorio.')
        return None
    try:
        d = Decimal(str(v).replace(',', '').replace('$', '').strip())
    except InvalidOperation:
        raise ValueError(f'«{campo}» no es un monto válido.')
    if d < 0 or d > Decimal('99999999999.99'):
        raise ValueError(f'«{campo}» debe ser un monto positivo.')
    return d.quantize(Decimal('0.01'))


def _f(d):
    return float(d) if d is not None else None


def _dt(s):
    return s.strftime('%d/%m/%Y %H:%M') if s else ''


def _siniestro(sid):
    s = Siniestro.query.get(sid)
    if not s:
        raise ValueError('El siniestro no existe.')
    return s


def _activo(sid):
    s = _siniestro(sid)
    if s.estado != 'Activo':
        raise ValueError('El siniestro está cerrado. Reábrelo desde el Historial para modificarlo.')
    return s


def _log(s, accion, detalle):
    db.session.add(SiniestroBitacora(siniestro_id=s.id, usuario_id=current_user.id, accion=accion, detalle=(detalle or '')[:500]))
    s.ultima_actualizacion = datetime.now()


def _nombre_cliente(c):
    return f'{c.nombre} {c.apellido}'.strip() if c else ''


def _contexto(s):
    pr = SiniestroProceso.query.get(s.proceso_id)
    po = Poliza.query.get(s.poliza_id)
    cl = Cliente.query.get(po.cliente_id) if po else None
    ase = Aseguradora.query.get(s.aseguradora_id)
    es = SiniestroEstatus.query.get(s.estatus_id)
    return pr, po, cl, ase, es


def _pagado(sid):
    rows = SiniestroPago.query.filter_by(siniestro_id=sid, estado='Vigente').all()
    return sum((r.monto for r in rows), Decimal('0'))


def _familia_ids(s):
    """Todos los siniestros de la familia: sube a la raíz y baja por los derivados."""
    raiz = s
    vistos = {s.id}
    while raiz.origen_id and raiz.origen_id not in vistos:
        raiz = Siniestro.query.get(raiz.origen_id)
        vistos.add(raiz.id)
    orden, cola, fam = [], [(raiz, 0)], set()
    while cola:
        n, nivel = cola.pop(0)
        if n.id in fam:
            continue
        fam.add(n.id)
        orden.append((n, nivel))
        for h in Siniestro.query.filter_by(origen_id=n.id).order_by(Siniestro.fecha_apertura).all():
            cola.append((h, nivel + 1))
    return orden


def _pago_json(p):
    return {'id': p.id, 'fecha': _fmt(p.fecha_pago), 'concepto': p.concepto, 'monto': float(p.monto), 'beneficiario': p.beneficiario or '',
            'estado': p.estado, 'motivo': p.motivo_cancelacion or '', 'comprobante': bool(p.comprobante)}


@api('siniestros/<int:sid>')
def detalle(sid):
    s = _siniestro(sid)
    pr, po, cl, ase, es = _contexto(s)
    ahora = datetime.now()
    nivel, ptxt = _plazo(s.fecha_limite, ahora) if s.estado == 'Activo' else ('none', '—')
    tipo = SiniestroTipo.query.get(s.tipo_id) if s.tipo_id else None
    pagos = SiniestroPago.query.filter_by(siniestro_id=s.id).order_by(SiniestroPago.fecha_pago.desc(), SiniestroPago.id.desc()).all()
    pagado = _pagado(s.id)
    aprobado = s.monto_aprobado
    usuarios = {u.id: f'{u.nombre} {u.apellido}'.strip() for u in Usuario.query.all()}
    bit = SiniestroBitacora.query.filter_by(siniestro_id=s.id).order_by(SiniestroBitacora.fecha.desc(), SiniestroBitacora.id.desc()).all()
    fam = _familia_ids(s)
    fam_pag, fam_apr, fam_rec = Decimal('0'), Decimal('0'), Decimal('0')
    familia = []
    for n, niv in fam:
        npr = SiniestroProceso.query.get(n.proceso_id)
        nes = SiniestroEstatus.query.get(n.estatus_id)
        pg = _pagado(n.id)
        fam_pag += pg
        fam_apr += n.monto_aprobado or 0
        fam_rec += n.monto_reclamado or 0
        familia.append({'id': n.id, 'folio': n.folio, 'proceso': npr.nombre, 'clave': npr.clave, 'estatus': nes.nombre, 'estado': n.estado,
                        'resultado': n.resultado or '', 'nivel': niv, 'apertura': _fmt(n.fecha_apertura), 'pagado': float(pg), 'actual': n.id == s.id})
    abiertos = Siniestro.query.filter_by(origen_id=s.id, estado='Activo').count()
    origen = Siniestro.query.get(s.origen_id) if s.origen_id else None
    return jsonify({
        'id': s.id, 'folio': s.folio, 'estado': s.estado, 'resultado': s.resultado or '',
        'proceso': {'clave': pr.clave, 'nombre': pr.nombre, 'grupo': pr.grupo}, 'tipo': tipo.nombre if tipo else '',
        'estatus': {'id': es.id, 'nombre': es.nombre, 'tipo': 'final' if es.es_final else es.tipo},
        'cliente': {'nombre': _nombre_cliente(cl), 'telefono': cl.tel_movil if cl else '', 'correo': cl.correo if cl else ''},
        'poliza': {'numero': po.poliza, 'inicio': _fmt(po.fecha_inicio), 'fin': _fmt(po.fecha_termino), 'status': po.status},
        'aseguradora': ase.aseguradora, 'apertura': _dt(s.fecha_apertura), 'limite': _dt(s.fecha_limite) if s.fecha_limite else '',
        'plazo': ptxt, 'plazo_nivel': nivel, 'ultima': _dt(s.ultima_actualizacion), 'cierre': _dt(s.fecha_cierre),
        'origen': {'id': origen.id, 'folio': origen.folio} if origen else None,
        'derivados_abiertos': abiertos,
        'montos': {'reclamado': _f(s.monto_reclamado), 'aprobado': _f(aprobado), 'deducible': _f(s.deducible), 'coaseguro': _f(s.coaseguro),
                   'pagado': float(pagado), 'pendiente': float(aprobado - pagado) if aprobado is not None else None},
        'datos': [{'campo': v.etiqueta, 'valor': v.valor or '', 'tipo': (SiniestroCampo.query.get(v.campo_id).tipo_dato if v.campo_id else 'Texto')} for v in SiniestroValor.query.filter_by(siniestro_id=s.id).order_by(SiniestroValor.id)],
        'pagos': [_pago_json(p) for p in pagos],
        'familia': familia,
        'familia_totales': {'reclamado': float(fam_rec), 'aprobado': float(fam_apr), 'pagado': float(fam_pag),
                            'pendiente': float(fam_apr - fam_pag) if fam_apr else None, 'siniestros': len(familia)},
        'bitacora': [{'fecha': _dt(b.fecha), 'usuario': usuarios.get(b.usuario_id, 'Sistema'), 'accion': b.accion, 'detalle': b.detalle or ''} for b in bit],
        'conceptos': CONCEPTOS,
    })


# --------------------------------------------------------------------------- estatus / nota
@api('siniestros/<int:sid>/estatus-opciones')
def estatus_opciones(sid):
    s = _siniestro(sid)
    q = SiniestroEstatus.query.filter_by(proceso_id=s.proceso_id, activo=True, es_final=False).order_by(SiniestroEstatus.orden)
    return jsonify({'items': [{'id': e.id, 'nombre': e.nombre} for e in q], 'actual': s.estatus_id})


@api('siniestros/<int:sid>/estatus', methods=['POST'])
def actualizar_estatus(sid):
    s = _activo(sid)
    d = _j()
    _req(d, 'estatus_id', 'comentario')
    es = SiniestroEstatus.query.get(int(d['estatus_id']))
    if not es or es.proceso_id != s.proceso_id or not es.activo:
        raise ValueError('Elige un estatus válido del proceso.')
    if es.es_final:
        raise ValueError('Para llegar a un estatus final usa «Cerrar siniestro».')
    if es.id == s.estatus_id:
        raise ValueError('El siniestro ya tiene ese estatus.')
    ant = SiniestroEstatus.query.get(s.estatus_id)
    extra = ''
    if d.get('fecha_limite'):
        try:
            s.fecha_limite = datetime.fromisoformat(d['fecha_limite'])
        except ValueError:
            raise ValueError('La fecha límite no es válida.')
        extra = f' Nuevo plazo: {_dt(s.fecha_limite)}.'
    s.estatus_id = es.id
    _log(s, 'Cambio de estatus', f'{ant.nombre} → {es.nombre}.{extra} {d["comentario"].strip()}')
    db.session.commit()
    return jsonify({'ok': True, 'estatus': es.nombre})


@api('siniestros/<int:sid>/nota', methods=['POST'])
def agregar_nota(sid):
    s = _siniestro(sid)
    d = _j()
    _req(d, 'texto')
    _log(s, 'Nota', d['texto'].strip())
    db.session.commit()
    return jsonify({'ok': True})


# --------------------------------------------------------------------------- montos y pagos
@api('siniestros/<int:sid>/montos', methods=['PUT'])
def guardar_montos(sid):
    s = _activo(sid)
    d = _j()
    nuevos = {k: _dinero(d.get(k), k.capitalize()) for k in ('monto_reclamado', 'monto_aprobado', 'deducible', 'coaseguro')}
    cambios = []
    for k, v in nuevos.items():
        if getattr(s, k) != v:
            cambios.append(f'{k.replace("monto_", "").capitalize()}: {_f(getattr(s, k)) or 0:,.2f} → {_f(v) or 0:,.2f}')
            setattr(s, k, v)
    if cambios:
        _log(s, 'Montos', '; '.join(cambios))
    db.session.commit()
    return jsonify({'ok': True})


def _carpeta_pagos(folio):
    ruta = os.path.join(get_documentos_base(), '_Siniestros', secure_filename(folio), 'pagos')
    os.makedirs(ruta, exist_ok=True)
    return ruta


@api('siniestros/<int:sid>/pagos', methods=['POST'])
def registrar_pago(sid):
    s = _activo(sid)
    f = request.form
    pr = SiniestroProceso.query.get(s.proceso_id)
    concepto = (f.get('concepto') or '').strip()
    if concepto not in CONCEPTOS:
        raise ValueError('Elige un concepto válido.')
    monto = _dinero(f.get('monto'), 'Monto', True)
    if monto <= 0:
        raise ValueError('El monto debe ser mayor a cero.')
    try:
        fecha = date.fromisoformat(f.get('fecha_pago') or '')
    except ValueError:
        raise ValueError('La fecha de pago no es válida.')
    if fecha > date.today():
        raise ValueError('La fecha de pago no puede ser futura.')
    benef = (f.get('beneficiario') or '').strip()[:120]
    if pr.clave == 'VI' and not benef:
        raise ValueError('En VIDA el beneficiario es obligatorio.')
    archivo = request.files.get('comprobante')
    nombre_arch = None
    if archivo and archivo.filename:
        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in EXT_COMPROBANTE:
            raise ValueError('El comprobante debe ser PDF, JPG o PNG.')
        datos = archivo.read()
        if len(datos) > MAX_COMPROBANTE:
            raise ValueError('El comprobante es demasiado grande (máximo 10 MB).')
        nombre_arch = f'p{uuid.uuid4().hex[:10]}{ext}'
        with open(os.path.join(_carpeta_pagos(s.folio), nombre_arch), 'wb') as out:
            out.write(datos)
    p = SiniestroPago(siniestro_id=s.id, fecha_pago=fecha, concepto=concepto, monto=monto, beneficiario=benef or None,
                      estado='Vigente', comprobante=nombre_arch, registrado_por=current_user.id)
    db.session.add(p)
    _log(s, 'Pago registrado', f'{concepto} por ${float(monto):,.2f}' + (f' a {benef}' if benef else '') + (' (con comprobante)' if nombre_arch else ''))
    db.session.commit()
    return jsonify({'ok': True, 'id': p.id})




@api('pagos/<int:pid>/comprobante')
def ver_comprobante(pid):
    p = SiniestroPago.query.get(pid)
    if not p or not p.comprobante:
        raise ValueError('El pago no tiene comprobante.')
    s = Siniestro.query.get(p.siniestro_id)
    ruta = os.path.join(_carpeta_pagos(s.folio), secure_filename(p.comprobante))
    if not os.path.isfile(ruta):
        raise ValueError('El archivo del comprobante no se encontró en el servidor.')
    return send_file(ruta, mimetype=mimetypes.guess_type(ruta)[0] or 'application/octet-stream', download_name=p.comprobante)


# --------------------------------------------------------------------------- derivados
def _validar_poliza_para(po):
    """(bloqueo|None, advertencia|None) sobre vigencia de póliza y pago del periodo."""
    hoy = date.today()
    if po.status in ('Cancelada', 'Finalizada'):
        return f'La póliza {po.poliza} está {po.status.lower()}; no se puede abrir un siniestro.', None
    rec = (Recibo.query.filter(Recibo.poliza_id == po.id, Recibo.fecha_inicio <= hoy, Recibo.fecha_vencimiento >= hoy,
                               Recibo.status != 'Cancelado').order_by(Recibo.fecha_inicio.desc()).first())
    if rec is None:
        rec = Recibo.query.filter(Recibo.poliza_id == po.id, Recibo.status == 'Vencido').first()
    if rec and rec.status == 'Vencido':
        return f'El recibo del periodo de la póliza {po.poliza} está vencido; no se puede abrir un siniestro.', None
    if rec and rec.status == 'Pendiente':
        return None, 'El recibo del periodo está pendiente de pago.'
    if po.status == 'Pendiente':
        return None, 'La póliza aún figura como pendiente.'
    return None, None


@api('siniestros/<int:sid>/derivados/opciones')
def derivado_opciones(sid):
    s = _siniestro(sid)
    pr = SiniestroProceso.query.get(s.proceso_id)
    claves = DERIVA_A.get(pr.grupo, [])
    po = Poliza.query.get(s.poliza_id)
    bloqueo, aviso = _validar_poliza_para(po)
    procs = SiniestroProceso.query.filter(SiniestroProceso.clave.in_(claves)).order_by(SiniestroProceso.id).all() if claves else []
    out = []
    for p in procs:
        tipos = SiniestroTipo.query.filter_by(proceso_id=p.id, activo=True).order_by(SiniestroTipo.nombre).all()
        out.append({'id': p.id, 'clave': p.clave, 'nombre': p.nombre, 'tipos': [{'id': t.id, 'nombre': t.nombre} for t in tipos]})
    return jsonify({'procesos': out, 'bloqueo': bloqueo, 'aviso': aviso, 'permitido': s.estado == 'Activo' and bool(procs),
                    'motivo': 'VIDA no genera derivados.' if not procs else ('El siniestro está cerrado.' if s.estado != 'Activo' else '')})


def _nuevo_folio(clave):
    hoy = datetime.now()
    pref = f'{clave}-{hoy.year}-{hoy.month:02d}-'
    mx = 0
    for (fol,) in db.session.query(Siniestro.folio).filter(Siniestro.folio.like(pref + '%')).all():
        m = re.search(r'-(\d+)$', fol)
        if m:
            mx = max(mx, int(m.group(1)))
    return f'{pref}{mx + 1:03d}'


@api('siniestros/<int:sid>/derivado', methods=['POST'])
def crear_derivado(sid):
    s = _activo(sid)
    d = _j()
    _req(d, 'proceso_id')
    pr_o = SiniestroProceso.query.get(s.proceso_id)
    pr = SiniestroProceso.query.get(int(d['proceso_id']))
    if not pr or pr.clave not in DERIVA_A.get(pr_o.grupo, []):
        raise ValueError('Ese proceso no es válido para derivar desde este siniestro.')
    po = Poliza.query.get(s.poliza_id)
    bloqueo, _aviso = _validar_poliza_para(po)
    if bloqueo:
        raise ValueError(bloqueo)
    tipo_id = None
    if d.get('tipo_id'):
        t = SiniestroTipo.query.get(int(d['tipo_id']))
        if not t or t.proceso_id != pr.id or not t.activo:
            raise ValueError('El tipo no corresponde al proceso elegido.')
        tipo_id = t.id
    est = SiniestroEstatus.query.filter_by(proceso_id=pr.id, activo=True, es_final=False).order_by(SiniestroEstatus.orden).first()
    if not est:
        raise ValueError(f'El proceso {pr.nombre} no tiene estatus activos; configúralos en Plantillas.')
    limite = None
    if d.get('fecha_limite'):
        try:
            limite = datetime.fromisoformat(d['fecha_limite'])
        except ValueError:
            raise ValueError('La fecha límite no es válida.')
    ahora = datetime.now()
    nuevo = Siniestro(folio=_nuevo_folio(pr.clave), proceso_id=pr.id, poliza_id=s.poliza_id, aseguradora_id=s.aseguradora_id,
                      estatus_id=est.id, origen_id=s.id, fecha_apertura=ahora, fecha_limite=limite, ultima_actualizacion=ahora,
                      estado='Activo', creado_por=current_user.id, tipo_id=tipo_id)
    db.session.add(nuevo)
    db.session.flush()
    nota = (d.get('comentario') or '').strip()
    db.session.add(SiniestroBitacora(siniestro_id=nuevo.id, usuario_id=current_user.id, accion='Apertura',
                                     detalle=f'Derivado de {s.folio}.' + (f' {nota}' if nota else '')))
    _log(s, 'Derivado', f'Se creó el siniestro derivado {nuevo.folio} ({pr.nombre}).' + (f' {nota}' if nota else ''))
    db.session.commit()
    return jsonify({'ok': True, 'id': nuevo.id, 'folio': nuevo.folio})


# --------------------------------------------------------------------------- comunicación
def _aplica(m, clave):
    return m.procesos == 'TODOS' or clave in m.procesos.split(',')


def _requisitos_texto(s):
    pl = SiniestroPlantillaReq.query.filter_by(proceso_id=s.proceso_id, aseguradora_id=s.aseguradora_id, tipo_id=s.tipo_id, activo=True).first() if s.tipo_id else None
    if not pl:
        return '(sin requisitos configurados)'
    its = SiniestroPlantillaItem.query.filter_by(plantilla_id=pl.id).order_by(SiniestroPlantillaItem.orden).all()
    return '\n'.join(f'• {i.nombre}{"" if i.obligatorio else " (opcional)"}' for i in its) or '(sin requisitos configurados)'


@api('siniestros/<int:sid>/comunicacion')
def comunicacion(sid):
    s = _siniestro(sid)
    pr, po, cl, ase, es = _contexto(s)
    pagado = _pagado(s.id)
    vars_ = {
        'cliente': _nombre_cliente(cl), 'asegurado': _nombre_cliente(cl), 'folio': s.folio, 'aseguradora': ase.aseguradora,
        'poliza': po.poliza, 'requisitos': _requisitos_texto(s),
        'fecha_limite': _dt(s.fecha_limite) if s.fecha_limite else 'por definir',
        'monto': f'${float(s.monto_aprobado):,.2f}' if s.monto_aprobado is not None else f'${float(pagado):,.2f}',
    }
    items = []
    for m in SiniestroMensaje.query.filter_by(activo=True).order_by(SiniestroMensaje.nombre).all():
        if not _aplica(m, pr.clave):
            continue
        txt = m.texto
        for k, v in vars_.items():
            txt = txt.replace('{' + k + '}', str(v))
        items.append({'id': m.id, 'nombre': m.nombre, 'uso': m.uso or '', 'texto': txt})
    return jsonify({'mensajes': items, 'telefono': cl.tel_movil if cl else '', 'correo': cl.correo if cl else '',
                    'cliente': _nombre_cliente(cl), 'folio': s.folio})


@api('siniestros/<int:sid>/comunicacion/registrar', methods=['POST'])
def comunicacion_registrar(sid):
    s = _siniestro(sid)
    d = _j()
    _req(d, 'mensaje', 'canal')
    if d['canal'] not in ('WhatsApp', 'Correo', 'Copiado'):
        raise ValueError('Canal no válido.')
    _log(s, 'Comunicación', f'{d["mensaje"]} · {d["canal"]}')
    db.session.commit()
    return jsonify({'ok': True})


# --------------------------------------------------------------------------- cerrar
@api('siniestros/<int:sid>/cerrar-opciones')
def cerrar_opciones(sid):
    s = _siniestro(sid)
    pr = SiniestroProceso.query.get(s.proceso_id)
    finales = SiniestroEstatus.query.filter_by(proceso_id=s.proceso_id, activo=True, es_final=True).order_by(SiniestroEstatus.orden).all()
    return jsonify({'estatus': [{'id': e.id, 'nombre': e.nombre} for e in finales],
                    'resultados': ['Cerrado'] if pr.clave == 'SI' else ['Procedente', 'Rechazado'],
                    'derivados_abiertos': Siniestro.query.filter_by(origen_id=s.id, estado='Activo').count()})


@api('siniestros/<int:sid>/cerrar', methods=['POST'])
def cerrar(sid):
    s = _activo(sid)
    d = _j()
    _req(d, 'estatus_id', 'resultado', 'comentario')
    pr = SiniestroProceso.query.get(s.proceso_id)
    validos = ['Cerrado'] if pr.clave == 'SI' else ['Procedente', 'Rechazado']
    if d['resultado'] not in validos:
        raise ValueError('Resultado no válido para este proceso.')
    es = SiniestroEstatus.query.get(int(d['estatus_id']))
    if not es or es.proceso_id != s.proceso_id or not es.es_final or not es.activo:
        raise ValueError('Elige un estatus final válido.')
    ab = Siniestro.query.filter_by(origen_id=s.id, estado='Activo').count()
    if ab:
        raise ValueError(f'No se puede cerrar: tiene {ab} siniestro(s) derivado(s) abierto(s). Ciérralos primero.')
    s.estatus_id = es.id
    s.estado = 'Cerrado'
    s.resultado = d['resultado']
    s.fecha_cierre = datetime.now()
    _log(s, 'Cierre', f'{d["resultado"]} · {es.nombre}. {d["comentario"].strip()}')
    db.session.commit()
    return jsonify({'ok': True})
