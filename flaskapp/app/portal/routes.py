# app/portal/routes.py
"""
Blueprint del Portal del Asegurado.

NOTA TEMPORAL: mientras no exista el login del asegurado, la selección
de cliente se hace vía el buscador dentro del dashboard (fetch a
/portal/api/buscar-cliente y /portal/api/mis-datos). Esto es solo para
demo. Cuando se defina el login definitivo, /portal/api/mis-datos
deberá tomar el cliente desde la sesión en vez de un parámetro.
"""
from flask import render_template, request, jsonify, current_app, send_from_directory, session, redirect, url_for
from sqlalchemy import func, or_
import os
from app import db
from app.models import Cliente, Poliza, Recibo, Aseguradora, Subramo, TipoPago, Grupo
from . import portal
from .auth_routes import portal_login_required


@portal.route('/dashboard', methods=['GET'])
@portal_login_required
def dashboard():
    return render_template('portal/dashboard.html')


@portal.route('/api/buscar-cliente', methods=['GET'])
def buscar_cliente():
    q = request.args.get('q', '').strip()

    if not q or len(q) < 2:
        return jsonify({'resultados': []})

    resultados = (db.session.query(Cliente)
                  .filter(Cliente.status == 'Activo')
                  .filter(or_(
                      Cliente.nombre.ilike(f'%{q}%'),
                      Cliente.apellido.ilike(f'%{q}%'),
                      func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(f'%{q}%'),
                  ))
                  .order_by(Cliente.nombre)
                  .limit(15)
                  .all())

    data = [{
        'id': c.id,
        'nombre_completo': f'{c.nombre} {c.apellido}',
        'rfc': c.rfc,
    } for c in resultados]

    return jsonify({'resultados': data})


def _polizas_y_recibos_de(cliente_ids, incluir_titular=False):
    """
    Trae pólizas + recibos para uno o varios cliente_id a la vez.
    Cuando incluir_titular=True (para el bloque 'grupo', que puede
    mezclar varias empresas), cada póliza trae también el nombre del
    Cliente dueño, para que el asegurado pueda distinguir de quién es
    cada una en pantalla.
    """
    if not cliente_ids:
        return [], []

    query = (db.session.query(Poliza,
                               Aseguradora.aseguradora.label('aseguradora'),
                               Subramo.subramo.label('subramo'),
                               TipoPago.tipo_pago.label('tipo_pago'),
                               TipoPago.pagos_anuales.label('cuotas'))
             .select_from(Poliza)
             .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
             .join(Subramo, Poliza.subramo_id == Subramo.id)
             .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id)
             .filter(Poliza.cliente_id.in_(cliente_ids)))

    if incluir_titular:
        query = query.add_columns(Cliente.nombre, Cliente.apellido).join(
            Cliente, Poliza.cliente_id == Cliente.id)

    rows = query.all()

    polizas_json = []
    poliza_ids = []

    for row in rows:
        if incluir_titular:
            poliza, aseguradora, subramo, tipo_pago, cuotas, titular_nombre, titular_apellido = row
            titular = f'{titular_nombre} {titular_apellido}'
        else:
            poliza, aseguradora, subramo, tipo_pago, cuotas = row
            titular = None

        poliza_ids.append(poliza.id)
        item = {
            'id': poliza.id,
            'numero': poliza.poliza,
            'tipo': subramo,
            'compania': aseguradora,
            'inicioVigencia': poliza.fecha_inicio.strftime('%d/%m/%Y'),
            'finVigencia': poliza.fecha_termino.strftime('%d/%m/%Y'),
            'primaNeta': float(poliza.prima_neta),
            'primaTotal': float(poliza.prima_total),
            'status': poliza.status,
            'frecuencia': (tipo_pago or '').lower(),
            'cuotasAlAño': cuotas or 1,
            'tienePdf': bool(poliza.pdf_path),
            'moneda': poliza.moneda,
        }
        if incluir_titular:
            item['titular'] = titular
        polizas_json.append(item)

    recibos_json = []
    if poliza_ids:
        recibos = (Recibo.query
                   .filter(Recibo.poliza_id.in_(poliza_ids))
                   .order_by(Recibo.fecha_vencimiento)
                   .all())
        recibos_json = [{
            'numero': r.no_de_recibo,
            'polizaId': r.poliza_id,
            'fechaInicio': r.fecha_inicio.strftime('%d/%m/%Y'),
            'fechaVencimiento': r.fecha_vencimiento.strftime('%d/%m/%Y'),
            'fechaPago': r.fecha_pago.strftime('%d/%m/%Y') if r.fecha_pago else None,
            'primaNeta': float(r.prima_neta),
            'primaTotal': float(r.prima_total),
            'status': r.status,
            'comprobante': r.comprobante,
        } for r in recibos]

    return polizas_json, recibos_json


@portal.route('/api/mis-datos', methods=['GET'])
@portal_login_required
def mis_datos():
    cliente_id = session.get('portal_cliente_id')

    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404

    # --- Bloque personal: solo lo que está a nombre de este Cliente ---
    personal_polizas, personal_recibos = _polizas_y_recibos_de([cliente_id])

    # --- Bloque grupo: el resto de Clientes (típicamente empresas) que
    # comparten el mismo grupo_id, ej. las empresas de un mismo asegurado ---
    companeros_grupo = (Cliente.query
                         .filter(Cliente.grupo_id == cliente.grupo_id)
                         .filter(Cliente.id != cliente_id)
                         .filter(Cliente.status == 'Activo')
                         .all())
    companeros_ids = [c.id for c in companeros_grupo]
    grupo_polizas, grupo_recibos = _polizas_y_recibos_de(
        companeros_ids, incluir_titular=True)

    grupo_obj = Grupo.query.get(cliente.grupo_id)

    return jsonify({
        'cliente': f'{cliente.nombre} {cliente.apellido}',
        'personal': {
            'polizas': personal_polizas,
            'recibos': personal_recibos,
            'siniestros': [],  # pendiente: aún no existe el sistema de siniestros
        },
        'grupo': {
            'nombre': grupo_obj.grupo if grupo_obj else None,
            'empresas': [f'{c.nombre} {c.apellido}' for c in companeros_grupo],
            'polizas': grupo_polizas,
            'recibos': grupo_recibos,
            'siniestros': [],
        },
    })



@portal.route('/descargar_pdf/<int:poliza_id>', methods=['GET'])
@portal_login_required
def descargar_pdf(poliza_id):
    """
    Sirve el PDF de una póliza, solo si le pertenece al cliente en sesión
    o a algún compañero de su mismo grupo (empresas relacionadas).
    """
    poliza = Poliza.query.get(poliza_id)
    if not poliza:
        return jsonify({'error': 'Póliza no encontrada'}), 404

    cliente_sesion = Cliente.query.get(session.get('portal_cliente_id'))
    if not cliente_sesion:
        return jsonify({'error': 'No autorizado'}), 403

    es_propia = poliza.cliente_id == cliente_sesion.id
    es_del_grupo = False
    if not es_propia:
        dueño = Cliente.query.get(poliza.cliente_id)
        es_del_grupo = bool(dueño) and dueño.grupo_id == cliente_sesion.grupo_id

    if not (es_propia or es_del_grupo):
        return jsonify({'error': 'No autorizado'}), 403

    if not poliza.pdf_path:
        return jsonify({'error': 'No hay PDF asociado a esta póliza'}), 404

    if os.path.isabs(poliza.pdf_path):
        directory = os.path.dirname(poliza.pdf_path)
        filename = os.path.basename(poliza.pdf_path)
        pdf_full_path = poliza.pdf_path
    else:
        directory = os.path.join(current_app.root_path, 'static')
        filename = poliza.pdf_path
        pdf_full_path = os.path.join(directory, filename)

    if not os.path.exists(pdf_full_path):
        return jsonify({'error': 'El archivo PDF no existe'}), 404

    return send_from_directory(
        directory,
        filename,
        as_attachment=True,
        download_name=f'poliza_{poliza.poliza}.pdf'
    )
