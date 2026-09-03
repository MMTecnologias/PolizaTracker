# app/portal/routes.py
"""
Blueprint del Portal del Asegurado.

NOTA TEMPORAL: mientras no exista el login del asegurado, la selección
de cliente se hace vía el buscador dentro del dashboard (fetch a
/portal/api/buscar-cliente y /portal/api/mis-datos). Esto es solo para
demo. Cuando se defina el login definitivo, /portal/api/mis-datos
deberá tomar el cliente desde la sesión en vez de un parámetro.
"""
from flask import render_template, request, jsonify
from sqlalchemy import func, or_
from app import db
from app.models import Cliente, Poliza, Recibo, Aseguradora, Subramo, TipoPago
from . import portal


@portal.route('/dashboard', methods=['GET'])
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


@portal.route('/api/mis-datos', methods=['GET'])
def mis_datos():
    cliente_id = request.args.get('cliente_id', type=int)

    if not cliente_id:
        return jsonify({'error': 'Falta cliente_id'}), 400

    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404

    rows = (db.session.query(Poliza,
                              Aseguradora.aseguradora.label('aseguradora'),
                              Subramo.subramo.label('subramo'),
                              TipoPago.tipo_pago.label('tipo_pago'),
                              TipoPago.pagos_anuales.label('cuotas'))
            .select_from(Poliza)
            .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
            .join(Subramo, Poliza.subramo_id == Subramo.id)
            .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id)
            .filter(Poliza.cliente_id == cliente_id)
            .all())

    polizas_json = []
    poliza_ids = []

    for poliza, aseguradora, subramo, tipo_pago, cuotas in rows:
        poliza_ids.append(poliza.id)
        polizas_json.append({
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
        })

    recibos_json = []
    if poliza_ids:
        recibos = (Recibo.query
                   .filter(Recibo.poliza_id.in_(poliza_ids))
                   .order_by(Recibo.fecha_vencimiento)
                   .all())
        recibos_json = [{
            'numero': r.no_de_recibo,
            'polizaId': r.poliza_id,
            'fechaVencimiento': r.fecha_vencimiento.strftime('%d/%m/%Y'),
            'primaNeta': float(r.prima_neta),
            'primaTotal': float(r.prima_total),
            'status': r.status,
            'comprobante': r.comprobante,
        } for r in recibos]

    return jsonify({
        'cliente': f'{cliente.nombre} {cliente.apellido}',
        'polizas': polizas_json,
        'recibos': recibos_json,
        'siniestros': [],  # pendiente: aún no existe el sistema de siniestros
    })
