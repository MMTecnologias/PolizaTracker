# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask import request as flask_request
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import polizas_route
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased
from app.models import export_to_csv, export_to_pdf


@polizas_route.route('/get_receipts', methods=['POST'])
@login_required
def get_receipts():
    # Recibe
    poliza_id = flask_request.form.get('poliza_id')
    print(f"Poliza ID: {poliza_id}")
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))

    endoso_id = flask_request.form.get('endoso_id')
    if endoso_id:
        recibos_query = Recibo.query.filter_by(endoso_id=endoso_id)
        print(f"Endoso ID: {endoso_id}")
        poliza_id = Endoso.query.get(endoso_id).poliza_id
        print(f"Poliza ID de endoso: {poliza_id}")
    else:
        recibos_query = Recibo.query.filter_by(
            poliza_id=poliza_id, endoso_id=None)
    moneda = Poliza.query.get(int(poliza_id)).moneda
    # Get total count of records without filtering
    total_records = recibos_query.count()
    # Apply pagination
    recibos = recibos_query.offset(start).limit(length).all()

    poliza = Poliza.query.get(poliza_id)
    # Format data as required by DataTables
    data = []
    for recibo in recibos:
        data.append({
            'numero': recibo.no_de_recibo,
            'fecha_recibo': recibo.fecha_inicio.strftime('%Y-%m-%d'),
            "vencimiento": recibo.fecha_vencimiento.strftime('%Y-%m-%d'),
            "prima_neta": float(recibo.prima_neta),
            "prima_total": float(recibo.prima_total),
            "comision": float(recibo.comision),
            "pagado": True if recibo.status == 'Liquidado' else False,
            "fecha_pago": "" if recibo.fecha_pago is None else recibo.fecha_pago.strftime('%Y-%m-%d'),
            "comprobante": "" if recibo.comprobante is None else recibo.comprobante,
            "cancelado": True if poliza.status == 'Cancelada' else False,
            'id': recibo.id,
            'moneda': moneda,
            'endoso_id': recibo.endoso_id,
            'poliza_id': poliza.id,
            'poliza_status': poliza.status
            # Add more fields as needed
        })
    # 'Liquidado', 'Pendiente', 'Vencido', 'Cancelado'), nullable=False,default='Pendiente')

    # Prepare response
    response = {
        # 'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }
    return jsonify(response)


@polizas_route.route('/search_clients', methods=['POST'])
@login_required
def search_clients():
    # Get search query from request data
    search_query = flask_request.form.get('query')
    clients_query = db.session.query(Cliente.id, Cliente.nombre, Cliente.apellido) \
        .filter(Cliente.status == 'Activo') \
        .filter(or_(
            func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(
                f'%{search_query}%')
        )) \
        .order_by(desc(Cliente.id)) \
        .limit(20)

    # Fetch client options
    options = [{'id': client.id, 'name': f"{client.nombre} {client.apellido}"}
               for client in clients_query]

    return jsonify({'options': options})


def _build_polizas_query():
    return db.session.query(Poliza,
                            Cliente.nombre.label("client_name"),
                            Cliente.apellido.label("client_lastname"),
                            Aseguradora.aseguradora.label("aseguradora"),
                            Ramo.ramo.label("ramo"),
                            Subramo.subramo.label("subramo"),
                            TipoPago.tipo_pago.label("tipo_pago"),
                            Agente.nombre.label("agente"),
                            Vendedor.nombre.label("vendedor")) \
        .select_from(Poliza) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .outerjoin(Grupo, Cliente.grupo_id == Grupo.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Subramo, Poliza.subramo_id == Subramo.id) \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id)


def _format_poliza_data(poliza_row):
    poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor = poliza_row
    poliza_data = {}
    for column in Poliza.__table__.columns:
        value = getattr(poliza, column.name)
        if isinstance(value, date):
            value = value.strftime('%Y-%m-%d')
        elif isinstance(value, Decimal):
            value = float(value)
        poliza_data[column.name] = value
    # Formatear notas con saltos de línea cada 16 caracteres
    notas_text = poliza.notas if poliza.notas else ''
    notas_formatted = '\n'.join([notas_text[i:i+16]
                                for i in range(0, len(notas_text), 16)])
    poliza_data.update({
        'cliente': f"{nombre} {apellido}",
        'aseguradora': aseguradora,
        'vigencia': f"{poliza.fecha_inicio.strftime('%Y-%m-%d')} to {poliza.fecha_termino.strftime('%Y-%m-%d')}",
        'ramo': f"{ramo}",
        'subramo': f"{subramo}",
        'tipoPago': f"{tipo_pago}",
        'agente': f"{agente}",
        'vendedor': f"{vendedor}",
        'Notas': notas_formatted,
        'prima_neta': f"${float(poliza.prima_neta):,.2f}",
        'prima_total': f"${float(poliza.prima_total):,.2f}",
        'fecha_termino': poliza.fecha_termino.strftime('%Y-%m-%d')
    })
    return poliza_data


@polizas_route.route('/get', methods=['POST'])
@login_required
def get():
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))
    search_value = flask_request.form.get('searchValue')
    order = bool(flask_request.form.get('order'))
    poliza_id = flask_request.form.get('poliza_id')
    polizas_query = _build_polizas_query()
    if order:
        polizas_query = polizas_query.order_by(desc(Poliza.fecha_inicio))
    else:
        polizas_query = polizas_query.order_by('poliza')
    if poliza_id:
        polizas_query = polizas_query.filter(Poliza.id == int(poliza_id))
    if search_value:
        polizas_query = polizas_query.filter(or_(
            Cliente.nombre.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%'),
            Grupo.grupo.ilike(f'%{search_value}%'),
            func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(
                f'%{search_value}%'),
            Poliza.poliza.ilike(f'{search_value}%'),
        ))
    total_records = polizas_query.count()
    polizas = polizas_query.offset(start).limit(
        length).all() if length and start else polizas_query.all()
    data = [_format_poliza_data(poliza_row) for poliza_row in polizas]
    headers = ['poliza', 'cliente', 'aseguradora', 'vigencia', 'ramo', 'subramo',
               'tipoPago', 'vendedor', 'Notas', 'prima_neta', 'prima_total', 'status']
    real_headers = ['Póliza', 'Cliente', 'Aseguradora', 'Vigencia', 'Ramo', 'Subramo',
                    'Forma de Pago', 'vendedor', 'Notas', 'Prima Neta', 'Prima Total', 'Estado']
    if flask_request.form.get('export_csv'):
        return export_to_csv(headers, data, 'polizas.csv', real_headers)
    if flask_request.form.get('export_pdf'):
        # Calcular totales
        total_prima_neta = sum(
            float(row['prima_neta'].replace('$', '').replace(',', '')) for row in data)
        total_prima_total = sum(
            float(row['prima_total'].replace('$', '').replace(',', '')) for row in data)
        # Agregar fila de totales
        total_row = {header: '' for header in headers}
        total_row['Notas'] = 'TOTAL:'
        total_row['prima_neta'] = f"${total_prima_neta:,.2f}"
        total_row['prima_total'] = f"${total_prima_total:,.2f}"
        data.append(total_row)
        to_multiline = ["Cliente", "Aseguradora",
                        "Ramo", "Subramo", "Agente", "Vendedor"]
        return export_to_pdf(headers, data, 'polizas.pdf', real_headers, to_multiline, "Pólizas")
    return jsonify({
        'recordsTotal': total_records,
        'data': data
    })


@polizas_route.route('/create', methods=['POST'])
@login_required
def create():
    # if not check_access("Clientes"):
    #    return redirect(url_for('main.index'))
    # flask_request.form.get('start')
    poliza_id = flask_request.form.get('poliza_id')
    print("Here")
    poliza_old = None
    if not (poliza_id == "New"):
        try:
            poliza_id = int(poliza_id)
        except:
            return jsonify({'error': True, 'msg': 'No se encontró la póliza a renovar'})
        poliza_old = Poliza.query.get(poliza_id)
        if not poliza_old:
            return jsonify({'error': True, 'msg': 'No se encontró la póliza a renovar'})
        if poliza_old.Poliza_renovada == "Si":
            return jsonify({'error': True, 'msg': f'esta póliza ya ha sido renovada con el número de póliza {poliza_old.renovacion}'})

    if not poliza_id:
        return jsonify({'error': True, 'msg': 'No se encontró la póliza'})

    def check_new_form():
        argdict = {}

        ramo = flask_request.form.get('ramo')
        nuevo_ramo = flask_request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class(
            Agente, agente, nuevo_agente, "nombre")
        return argdict

    # fecha_captura
    # alter table polizas add column conducta_pago varchar(30) default null;
    column_name_mapping = {
        'cliente_id': 'selected-client-id',
        'fecha_inicio': 'VigenciaI',
        'fecha_termino': 'VigenciaF',
        'moneda': 'Moneda',
        'tipo_pago_id': 'Pago',
        'serie': 'serie',
        'notas': 'notas',
        'poliza_anterior': 'polizaAnterior',
        'renovacion': 'renovacion',
        'prima_neta': 'prima_neta',
        'prima_total': 'prima_total',
        'poliza': 'Poliza',
        'conducta_pago': 'conducto_pago'
    }
    form_value_mapping = {
        'selected-client-id': flask_request.form.get('selected-client-id'),
        'VigenciaI': flask_request.form.get('VigenciaI'),
        'VigenciaF': flask_request.form.get('VigenciaF'),
        'Moneda': flask_request.form.get('Moneda'),
        'Pago': flask_request.form.get('Pago'),
        'serie': flask_request.form.get('serie'),
        'notas': flask_request.form.get('notas'),
        'polizaAnterior': flask_request.form.get('polizaAnterior'),
        'renovacion': flask_request.form.get('renovacion'),
        'prima_neta': flask_request.form.get('prima_neta'),
        'prima_total': flask_request.form.get('prima_total'),
        'Poliza': flask_request.form.get('Poliza'),
        'conducto_pago': flask_request.form.get('conducto_pago')
    }
    arg_values = {col: form_value_mapping[map] for col, map in column_name_mapping.items(
    ) if form_value_mapping[map]}
    # print(form_value_mapping)
    # return arg_values

    # If cliente_id is "New", then it's a new client creation
    # if poliza_id == "New":
    arg_values.update(check_new_form())
    arg_values["fecha_captura"] = datetime.now().strftime('%Y-%m-%d')
    # Create a new client

    # check if there is a poliza with the same number and not canceled

    poliza = Poliza.query.filter(
        Poliza.poliza == arg_values["poliza"], Poliza.status != "Cancelada").first()
    if poliza:
        return jsonify({'error': True, 'msg': f'Ya existe una póliza vigente con el mismo número {poliza.poliza}', 'title': 'Ya existe una póliza vigente con el mismo número'})
    # check for pending cancelation request of the same poliza
    request = Request.query.filter(Request.description == f"Cancelar póliza {arg_values['poliza']}",
                                   Request.status == "Pendiente").first()
    if request:
        return jsonify({'error': True, 'msg': 'Existe una solicitud de cancelación pendiente para esta póliza', 'title': 'Existe una solicitud de cancelación pendiente para esta póliza'})

    new_poliza = Poliza(**arg_values)
    # Save the new client to the database
    db.session.add(new_poliza)
    db.session.commit()

    if poliza_old:
        poliza_old.Poliza_renovada = "Si"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Renovar póliza {poliza_old.poliza} a {new_poliza.poliza}",
                                status="Aceptada",
                                table_name='Poliza',
                                row_id=new_poliza.id)
        db.session.add(request_entry)
        db.session.commit()
    else:
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Crear poliza {new_poliza.poliza}",
                                status="Aceptada",
                                table_name='Poliza',
                                row_id=new_poliza.id)
        db.session.add(request_entry)
        db.session.commit()

    """for col,value in arg_values.items():
        log_entry = Log(request_id=request_entry.id,
                        column_name=col,
                        old_value="",
                        new_value=value)
        db.session.add(log_entry)
    db.session.commit() """

    return jsonify({
        'error': False,
        'redirect': url_for('main.polizas'),
        'msg': arg_values,
        'title': 'Poliza registrada exitosamente',
        'poliza_id': new_poliza.id
    })
    # else:
    #    return jsonify({
    #       'error': False,
    #      'redirect': url_for('main.polizas'),
    #     'msg': 'Solo se puede editar poliza en endosos',
    #    'title': 'Sin cambios'
    # })


@polizas_route.route('/edit', methods=['POST'])
@login_required
def edit():
    # Get the ID of the Poliza to edit
    poliza_id = flask_request.form.get('poliza_id')
    if not poliza_id:
        return jsonify({'error': True, 'msg': 'No se proporcionó el ID de la póliza'})

    # Fetch the Poliza from the database
    poliza = Poliza.query.get(poliza_id)
    if not poliza:
        return jsonify({'error': True, 'msg': 'No se encontró la póliza'})

    # Define mappings for form fields to Poliza columns
    column_name_mapping = {
        'cliente_id': 'selected-client-id',
        'fecha_inicio': 'VigenciaI',
        'fecha_termino': 'VigenciaF',
        'moneda': 'Moneda',
        'tipo_pago_id': 'Pago',
        'serie': 'serie',
        'notas': 'notas',
        'poliza_anterior': 'polizaAnterior',
        'renovacion': 'renovacion',
        'prima_neta': 'prima_neta',
        'prima_total': 'prima_total',
        'poliza': 'Poliza',
        'conducta_pago': 'conducto_pago'
    }

    # Map form values to Poliza attributes
    form_value_mapping = {
        'selected-client-id': flask_request.form.get('selected-client-id'),
        'VigenciaI': flask_request.form.get('VigenciaI'),
        'VigenciaF': flask_request.form.get('VigenciaF'),
        'Moneda': flask_request.form.get('Moneda'),
        'Pago': flask_request.form.get('Pago'),
        'serie': flask_request.form.get('serie'),
        'notas': flask_request.form.get('notas'),
        'polizaAnterior': flask_request.form.get('polizaAnterior'),
        'renovacion': flask_request.form.get('renovacion'),
        'prima_neta': flask_request.form.get('prima_neta'),
        'prima_total': flask_request.form.get('prima_total'),
        'Poliza': flask_request.form.get('Poliza'),
        'conducto_pago': flask_request.form.get('conducto_pago')
    }

    # Update Poliza attributes
    for col, form_field in column_name_mapping.items():
        if form_value_mapping[form_field]:
            setattr(poliza, col, form_value_mapping[form_field])

    # Handle related entities (e.g., Ramo, Subramo, Aseguradora, etc.)
    def check_new_form():
        argdict = {}

        ramo = flask_request.form.get('ramo')
        nuevo_ramo = flask_request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class(
            Agente, agente, nuevo_agente, "nombre")

        return argdict

    # Update related entities
    related_entities = check_new_form()
    for key, value in related_entities.items():
        setattr(poliza, key, value)

    # Save changes to the database
    try:
        db.session.commit()
        # Log the edit action
        request_entry = Request(
            usuario_id=current_user.id,
            description=f"Editar póliza {poliza.poliza}",
            status="Aceptada",
            table_name='Poliza',
            row_id=poliza.id
        )
        db.session.add(request_entry)
        db.session.commit()

        return jsonify({'error': False, 'msg': 'Póliza actualizada exitosamente', 'poliza_id': poliza.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': True, 'msg': f'Error al actualizar la póliza: {str(e)}'})


@polizas_route.route('/delete', methods=['POST'])
@login_required
def delete():
    poliza_id = int(flask_request.form.get('poliza_id'))
    razon = flask_request.form.get('razon')
    poliza = Poliza.query.get(poliza_id)
    if poliza:
        # Update the poliza's status to "Eliminado"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Cancelar póliza {poliza.poliza}",
                                table_name='Poliza',
                                row_id=poliza.id,
                                notas=razon)
        db.session.add(request_entry)
        db.session.commit()
        log_entry = Log(request_id=request_entry.id,
                        column_name='status',
                        old_value=poliza.status,
                        new_value='Cancelada')

        db.session.add(log_entry)
        poliza.status = "Cancelada"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Póliza cancelada', 'msg': 'La póliza ha sido cancelada con éxito, esta acción está sujeta a revisión y puede ser revertida por el administrador.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró la póliza.'})


"""Recibos aun sin uso"""
# Ruta para obtener los valores de la póliza


@polizas_route.route('/get_policy_values', methods=['POST'])
@login_required
def get_policy_values():
    # Buscar la póliza en la base de datos por su ID
    fecha_inicio = flask_request.form.get('fecha_inicio')
    fecha_termino = flask_request.form.get('fecha_termino')
    tipo_pago_id = flask_request.form.get('tipo_pago_id')
    prima_neta = flask_request.form.get('prima_neta')
    prima_total = flask_request.form.get('prima_total')

    # Calcular la duración de la póliza en años, considerando años bisiestos
    start_date = datetime.strptime(fecha_inicio, '%Y-%m-%d')
    end_date = datetime.strptime(fecha_termino, '%Y-%m-%d')

    # Calcular la duracion en meses con funcion de floor
    def diff_month(d1, d2):
        return (d1.year - d2.year) * 12 + d1.month - d2.month

    policy_duration_months = diff_month(end_date, start_date)

    # Duración en años, considerando años bisiestos y redondeado a entero
    # policy_duration = int(round((end_date - start_date).days / 365.2425))

    # Obtener el tipo de pago de la póliza
    tipo_pago = TipoPago.query.get(tipo_pago_id)
    if not tipo_pago:
        return jsonify({'error': True, 'msg': 'Tipo de pago no encontrado'})

    endoso = flask_request.form.get('is_endoso')
    msg = ""

    if endoso == "true":
        poliza_id = flask_request.form.get('poliza_id')
        poliza = Poliza.query.get(poliza_id)
        if not poliza:
            return jsonify({'error': True, 'msg': 'Poliza no encontrada'})
        if start_date.date() > poliza.fecha_termino:
            return jsonify({'error': True, 'msg': 'El endoso no puede empezar una vez vencida la poliza'})
        print(TipoPago.query.get(poliza.tipo_pago_id).tipo_pago ==
              tipo_pago.tipo_pago)
        if tipo_pago.contado != "Si" and TipoPago.query.get(poliza.tipo_pago_id).tipo_pago == tipo_pago.tipo_pago and poliza.fecha_termino == end_date.date():
            # Obtener el numero de pagos de la poliza que estan entre las fechas esocgidas
            num_payments = Recibo.query.filter(
                Recibo.poliza_id == poliza_id, Recibo.fecha_vencimiento <= end_date.date(), Recibo.endoso_id == None).count()
            return jsonify({'error': False,
                            'netPremium': float(prima_neta),
                            'totalPremium': float(prima_total),
                            'numReceipts': int(num_payments),
                            'msg': msg
                            # 'policyDuration': int(policy_duration),  # Convertir a entero
                            })
        if tipo_pago.contado == "Si":
            msg = ""
        msg = "Los recibos del endoso no coincidiran con los de la poliza, para esto seleccione el tipo de pago: %s y la fecha de termino de la poliza: %s" % (
            TipoPago.query.get(poliza.tipo_pago_id).tipo_pago, poliza.fecha_termino.strftime('%d/%m/%Y'))
        print(msg)
        # return jsonify({'error': True, 'msg': msg})

    # Obtener el número de pagos según el tipo de pago
    if tipo_pago.contado == "Si":
        num_payments = 1
    else:
        # De lo contrario, el número de pagos es igual a los pagos mensuales
        deltames = 12/tipo_pago.pagos_anuales
        if deltames > policy_duration_months:
            return jsonify({'error': True, 'msg': 'Este tipo de pago no es valido para la duracion de la poliza/endoso. Porfavor, intente con otro'})
        if policy_duration_months % deltames == 0:
            num_payments = policy_duration_months // deltames
        else:
            return jsonify({'error': True, 'msg': 'Este tipo de pago no es válido para la duración de la póliza/endoso. Por favor, intente con otro'})

    # Devolver los valores como un objeto JSON
    return jsonify({'error': False,
                    'netPremium': float(prima_neta),
                    'totalPremium': float(prima_total),
                    'numReceipts': int(num_payments),
                    'msg': msg
                    # 'policyDuration': int(policy_duration),  # Convertir a entero
                    })


def calcular_recibos():
    # Retrieve data from the form
    prima_total = float(flask_request.form.get('totalPremium'))
    prima_neta = float(flask_request.form.get('netPremium'))
    iva = float(flask_request.form.get('iva'))
    derecho_poliza = float(flask_request.form.get('insurance'))
    derecho_poliza_con_iva = derecho_poliza * (1+iva / 100)
    iva = prima_total*iva / (100+iva)
    commission = float(flask_request.form.get('commission'))
    commission = prima_neta * commission/100
    # Assuming this is the number of payments
    nopagos = int(flask_request.form.get('receipts'))

    recargo_por_pago = prima_total - iva-prima_neta-derecho_poliza

    # Es "primer_recibo" o "dividir_recibos"
    rec_pago = flask_request.form.get('rec_pago')
    print(rec_pago)
    print(nopagos)
    print(derecho_poliza_con_iva)

    # Perform calculations
    response = {
        'firstpay': {
            "netPremium": "",
            "comision": "",
            "totalPremium": ""
        },
        'subspay': {
            "netPremium": "",
            "comision": "",
            "totalPremium": ""
        }
    }

    # Calculate the values for the first payment
    total_premium = (prima_total-derecho_poliza_con_iva) / \
        nopagos if rec_pago == "primer_recibo" else prima_total/nopagos
    net_premium = prima_neta / nopagos
    commission_pp = commission / nopagos

    response['firstpay']['netPremium'] = net_premium
    response['firstpay']['totalPremium'] = total_premium + \
        derecho_poliza_con_iva if rec_pago == "primer_recibo" else total_premium
    response['firstpay']['comision'] = commission_pp

    # If there are subsequent payments, calculate their values as well
    if nopagos > 1:
        response['subspay']['netPremium'] = net_premium
        response['subspay']['totalPremium'] = total_premium
        response['subspay']['comision'] = commission_pp

    response['derecho_poliza'] = derecho_poliza
    response['iva'] = iva
    response['rec_pago'] = recargo_por_pago
    response['comision'] = commission
    response['poliza_id'] = flask_request.form.get('selectPoliza')
    response['nopagos'] = nopagos

    print(response)
    return response


def add_months(start_date, num_months):
    # Convertir la cadena de fecha en un objeto datetime

    start_date = str(start_date)
    start_date = datetime.strptime(start_date, '%Y-%m-%d')

    new_date = start_date + relativedelta(months=num_months)
    # Devolver la nueva fecha como cadena
    return new_date.strftime('%Y-%m-%d')


@polizas_route.route('/calculate_receipts', methods=['POST'])
@login_required
def calculate_receipts():
    response = calcular_recibos()
    return jsonify(response)


@polizas_route.route('/save_receipts', methods=['POST'])
@login_required
def save_receipts():
    response = calcular_recibos()
    poliza_id = response['poliza_id']

    poliza = Poliza.query.get(poliza_id)
    endoso_id = flask_request.form.get('endoso_id')
    multiplier = 1
    endoso_or_poliza = poliza
    is_endoso = False
    if endoso_id:
        endoso = Endoso.query.get(endoso_id)
        if not endoso:
            return jsonify({'error': True, 'msg': 'Endoso no encontrado'})
        elif not poliza:
            poliza = Poliza.query.get(endoso.poliza_id)
            poliza_id = poliza.id
        elif endoso.poliza_id != poliza.id:
            return jsonify({'error': True, 'msg': 'Endoso no pertenece a esta poliza'})

        if endoso.tipo_endoso == "A":
            return jsonify({'error': True, 'msg': 'Los Endosos tipo A no generan recibos'})
        elif endoso.tipo_endoso == "D":
            multiplier = -1

        if endoso.recibos == "Generados":
            return jsonify({'error': True, 'msg': 'Este endoso ya tiene recibos generados'})
        endoso_or_poliza = endoso
        is_endoso = True

    elif not poliza:
        return jsonify({'error': True, 'msg': 'Poliza no encontrada'})
    elif poliza.recibos == "Generados":
        return jsonify({'error': True, 'msg': 'Esta poliza ya tiene recibos generados'})

    try:
        # Ejecuta el bucle para crear registros
        start_date = endoso_or_poliza.fecha_inicio
        end_date = endoso_or_poliza.fecha_termino
        tipo_pago = TipoPago.query.get(endoso_or_poliza.tipo_pago_id)
        print(tipo_pago.tipo_pago)
        if tipo_pago.contado == "Si":
            print("done")
            nuevo_recibo = Recibo(fecha_inicio=start_date,
                                  fecha_vencimiento=end_date,
                                  poliza_id=poliza_id,
                                  endoso_id=endoso_id,
                                  prima_neta=multiplier *
                                  response['firstpay']['netPremium'],
                                  prima_total=multiplier *
                                  response['firstpay']['totalPremium'],
                                  comision=multiplier *
                                  response['firstpay']['comision']
                                  )
            db.session.add(nuevo_recibo)
        else:
            num_months = int(12/tipo_pago.pagos_anuales)
            fecha_inicio = start_date
            fecha_vencimiento = add_months(fecha_inicio, num_months)
            if is_endoso:
                if TipoPago.query.get(poliza.tipo_pago_id).tipo_pago == tipo_pago.tipo_pago and poliza.fecha_termino == end_date:
                    recibo = Recibo.query.filter(Recibo.poliza_id == poliza_id, Recibo.fecha_vencimiento <=
                                                 end_date, Recibo.endoso_id == None).order_by(Recibo.id).first()
                    fecha_vencimiento = recibo.fecha_vencimiento.strftime(
                        '%Y-%m-%d')
            nopagos = response['nopagos']
            print(nopagos)
            nuevo_recibo = Recibo(fecha_inicio=fecha_inicio,
                                  fecha_vencimiento=fecha_vencimiento,
                                  poliza_id=poliza_id,
                                  endoso_id=endoso_id,
                                  prima_neta=multiplier *
                                  response['firstpay']['netPremium'],
                                  prima_total=multiplier *
                                  response['firstpay']['totalPremium'],
                                  comision=multiplier *
                                  response['firstpay']['comision'],
                                  no_de_recibo="1 / "+str(nopagos)
                                  )
            db.session.add(nuevo_recibo)
            for nopay in range(2, nopagos+1):
                fecha_inicio = fecha_vencimiento
                fecha_vencimiento = end_date if nopay == nopagos else add_months(
                    fecha_inicio, num_months)
                nuevo_recibo = Recibo(fecha_inicio=fecha_inicio,
                                      fecha_vencimiento=fecha_vencimiento,
                                      poliza_id=poliza_id,
                                      endoso_id=endoso_id,
                                      prima_neta=multiplier *
                                      response['subspay']['netPremium'],
                                      prima_total=multiplier *
                                      response['subspay']['totalPremium'],
                                      comision=multiplier *
                                      response['subspay']['comision'],
                                      no_de_recibo=str(
                                          nopay)+" / "+str(nopagos)
                                      )
                db.session.add(nuevo_recibo)

        endoso_or_poliza.derecho_poliza = response['derecho_poliza']
        endoso_or_poliza.iva = round(response['iva'], 2)
        endoso_or_poliza.rec_pago = response['rec_pago']
        endoso_or_poliza.comision = response['comision']
        endoso_or_poliza.recibos = "Generados"

        # Realiza el commit después de completar las inserciones
        db.session.commit()

        return jsonify({'error': False, 'msg': 'Recibos generados con exito'})
    except Exception as e:
        # Si ocurre algún error, realiza un rollback
        db.session.rollback()
        print(e)
        return jsonify({'error': True, 'msg': 'Error en la creación de recibos '+str(e)})


"""Endosos"""


@polizas_route.route('/check_delete_receipts', methods=['POST'])
@login_required
def check_delete_receipts():
    """
    Elimina recibos de una póliza o endoso para que puedan ser generados de nuevo.

    Los requisitos son:
    - La póliza o endoso debe tener recibos generados.
    - La póliza o endoso no debe estar cancelada o finalizada.
    - No debe haber recibos pagados o cancelados.
    - No debe haber endosos con recibos asociados a la póliza (si es una póliza).
    """
    poliza_id = flask_request.form.get('poliza_id')
    endoso_id = flask_request.form.get('endoso_id')

    # Determinar si se está trabajando con una póliza o un endoso
    if endoso_id:
        endoso_or_poliza = Endoso.query.get(endoso_id)
        if not endoso_or_poliza:
            return jsonify({'error': True, 'msg': 'Endoso no encontrado'})
        poliza_id = endoso_or_poliza.poliza_id
    else:
        endoso_or_poliza = Poliza.query.get(poliza_id)
        if not endoso_or_poliza:
            return jsonify({'error': True, 'msg': 'Póliza no encontrada'})

    # Validar estado de la póliza o endoso
    if endoso_or_poliza.recibos != "Generados":
        return jsonify({'error': True, 'msg': 'No se han generado recibos para esta póliza/endoso'})

    if endoso_or_poliza.status in ["Cancelada", "Finalizada"]:
        return jsonify({'error': True, 'msg': 'No se pueden eliminar recibos de una póliza/endoso cancelada o finalizada'})

    # Obtener los recibos asociados
    if endoso_id:
        receipts = Recibo.query.filter(
            Recibo.poliza_id == poliza_id,
            Recibo.endoso_id == endoso_id
        ).all()
    else:
        receipts = Recibo.query.filter(
            Recibo.poliza_id == poliza_id
        ).all()

    # Validar recibos
    for receipt in receipts:
        if not endoso_id and receipt.endoso_id is not None:
            return jsonify({'error': True, 'msg': 'No se pueden eliminar recibos de una póliza con endosos que tienen recibos'})

        if receipt.status in ["Liquidado", "Cancelado"]:
            return jsonify({'error': True, 'msg': 'No se pueden eliminar recibos que ya han sido liquidados o cancelados'})

    # Si todas las validaciones pasan, eliminar recibos
    try:
        for receipt in receipts:
            db.session.delete(receipt)

        endoso_or_poliza.recibos = "Por generar"
        db.session.commit()

        # Registrar la acción
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Eliminar recibos de {'endoso' if endoso_id else 'póliza'} {endoso_or_poliza.poliza} con prima total previa {endoso_or_poliza.prima_total}",
                                status="Aceptada",
                                table_name='Endoso' if endoso_id else 'Poliza',
                                row_id=endoso_or_poliza.id)
        db.session.add(request_entry)
        db.session.commit()

        log_entry = Log(request_id=request_entry.id,
                        column_name='recibos',
                        old_value="Generados",
                        new_value="Por generar")
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({'error': False, 'msg': 'Recibos eliminados con éxito'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': True, 'msg': f'Error al eliminar recibos: {str(e)}'})


@polizas_route.route('/create_endoso', methods=['POST'])
@login_required
def create_endoso():
    poliza_id = flask_request.form.get('poliza_id')
    tipo = flask_request.form.get('tipo')
    print(tipo)
    if tipo not in ("A", "B", "D"):
        return jsonify({"error": True, "msg": "No se encuentra el tipo de endoso"})
    poliza = Poliza.query.get(poliza_id)
    if not poliza:
        return jsonify({"error": True, "msg": "No se encuentra la póliza"})

    def check_new_form():
        argdict = {}

        ramo = flask_request.form.get('ramo')
        nuevo_ramo = flask_request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class(
            Agente, agente, nuevo_agente, "nombre")
        return argdict

    # fecha_captura
    column_name_mapping = {
        'cliente_id': 'selected-client-id',
        'fecha_inicio': 'VigenciaI',
        'fecha_termino': 'VigenciaF',
        'moneda': 'Moneda',
        'tipo_pago_id': 'Pago',
        'serie': 'serie',
        'notas': 'notas',
        'poliza_anterior': 'polizaAnterior',
        'renovacion': 'renovacion',
        'prima_neta': 'prima_neta',
        'prima_total': 'prima_total',
        'endoso': 'Poliza'
    }
    form_value_mapping = {
        'selected-client-id': flask_request.form.get('selected-client-id'),
        'VigenciaI': flask_request.form.get('VigenciaI'),
        'VigenciaF': flask_request.form.get('VigenciaF'),
        'Moneda': flask_request.form.get('Moneda'),
        'Pago': flask_request.form.get('Pago'),
        'serie': flask_request.form.get('serie'),
        'notas': flask_request.form.get('notas'),
        'polizaAnterior': flask_request.form.get('polizaAnterior'),
        'renovacion': flask_request.form.get('renovacion'),
        'prima_neta': flask_request.form.get('prima_neta'),
        'prima_total': flask_request.form.get('prima_total'),
        'Poliza': flask_request.form.get('Poliza')
    }
    arg_values = {col: form_value_mapping[map] for col, map in column_name_mapping.items(
    ) if form_value_mapping[map]}
    # print(form_value_mapping)
    # return arg_values

    arg_values.update(check_new_form())
    arg_values["fecha_captura"] = datetime.now().strftime('%Y-%m-%d')
    arg_values['poliza_id'] = poliza.id
    arg_values['tipo_endoso'] = tipo

    dict_to_keep = {
        "A": ['poliza', 'prima_neta', 'prima_total', 'derecho_poliza', 'iva', 'rec_pago', 'comision', 'recibos'],
        "B": ['poliza'],
        "D": ['poliza']
    }
    for key in dict_to_keep[tipo]:
        arg_values[key] = getattr(poliza, key)
    # poliza_data = {column.name:getattr(poliza, column.name) for column in Poliza.__table__.columns}
    # poliza_data.pop('rec_pago', None)
    # poliza_data.pop('comision', None)
    # poliza_data.pop('recibos', None)
    # poliza_data['poliza_id'] = poliza.id
    # poliza_data['tipo_endoso'] = tipo

    endoso = Endoso(**arg_values)
    # Save the new endoso to the database
    db.session.add(endoso)
    db.session.commit()

    request_entry = Request(usuario_id=current_user.id,
                            description=f"Crear endoso {endoso.tipo_endoso} para la póliza {endoso.poliza}",
                            status="Aceptada",
                            table_name='Endoso',
                            row_id=endoso.id)
    db.session.add(request_entry)
    db.session.commit()

    return jsonify({
        'error': False,
        'msg': 'Endoso creado exitosamente',
        'endoso_id': endoso.id
    })


@polizas_route.route('/get_endosos', methods=['POST'])
@login_required
def get_endosos():
    # Recibe
    poliza_id = flask_request.form.get('poliza_id')
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))

    # Query to fetch endosos data from the database
    endosos_query = db.session.query(Endoso,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo"),
                                     TipoPago.tipo_pago.label("tipo_pago")) \
        .select_from(Endoso) \
        .join(Cliente, Endoso.cliente_id == Cliente.id) \
        .join(Aseguradora, Endoso.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Endoso.ramo_id == Ramo.id)  \
        .join(Subramo, Endoso.subramo_id == Subramo.id)  \
        .join(TipoPago, Endoso.tipo_pago_id == TipoPago.id) \
        .filter(Endoso.poliza_id == poliza_id)

    # Get total count of records without filtering
    total_records = endosos_query.count()

    # Apply pagination
    endosos = endosos_query.offset(start).limit(length).all()

    data = []
    # Iterate through the query results
    for endoso, nombre, apellido, aseguradora, ramo, subramo, tipo_pago in endosos:
        # Extracting all columns from the Endoso object
        endoso_data = {}
        # Iterate through each column in the Endoso table
        for column in Endoso.__table__.columns:
            # Get the value of the column
            value = getattr(endoso, column.name)
            # Convert date to string if it's a date type
            if isinstance(value, date):
                value = value.strftime('%Y-%m-%d')
            # Convert Decimal to float if it's a Decimal type
            elif isinstance(value, Decimal):
                value = float(value)
            # Add column name and corresponding value to endoso_data dictionary
            endoso_data[column.name] = value

        # endoso_data = {column.name: getattr(endoso, column.name) for column in Endoso.__table__.columns}

        # Append additional information
        endoso_data.update({
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'ramo': f"{ramo}",
            'subramo': f"{subramo}",
            'tipoPago': f"{tipo_pago}",
        })

        # Append to data list
        data.append(endoso_data)

    # Prepare response
    response = {
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }
    return jsonify(response)


@polizas_route.route('/edit_endoso', methods=['POST'])
@login_required
def edit_endoso():
    """
    Edita un endoso existente basado en los valores proporcionados en el formulario.
    """
    # Obtener el ID del endoso a editar
    endoso_id = flask_request.form.get('endoso_id')
    if not endoso_id:
        return jsonify({'error': True, 'msg': 'No se proporcionó el ID del endoso'})

    # Buscar el endoso en la base de datos
    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'No se encontró el endoso'})

    # Definir mapeos para los campos del formulario a las columnas del Endoso
    column_name_mapping = {
        'cliente_id': 'selected-client-id',
        'fecha_inicio': 'VigenciaI',
        'fecha_termino': 'VigenciaF',
        'moneda': 'Moneda',
        'tipo_pago_id': 'Pago',
        'serie': 'serie',
        'notas': 'notas',
        'poliza_anterior': 'polizaAnterior',
        'renovacion': 'renovacion',
        'prima_neta': 'prima_neta',
        'prima_total': 'prima_total',
        'endoso': 'Poliza'
    }

    # Mapear valores del formulario a atributos del Endoso
    form_value_mapping = {
        'selected-client-id': flask_request.form.get('selected-client-id'),
        'VigenciaI': flask_request.form.get('VigenciaI'),
        'VigenciaF': flask_request.form.get('VigenciaF'),
        'Moneda': flask_request.form.get('Moneda'),
        'Pago': flask_request.form.get('Pago'),
        'serie': flask_request.form.get('serie'),
        'notas': flask_request.form.get('notas'),
        'polizaAnterior': flask_request.form.get('polizaAnterior'),
        'renovacion': flask_request.form.get('renovacion'),
        'prima_neta': flask_request.form.get('prima_neta'),
        'prima_total': flask_request.form.get('prima_total'),
        'Poliza': flask_request.form.get('Poliza')
    }

    # Actualizar atributos del Endoso
    for col, form_field in column_name_mapping.items():
        if form_value_mapping[form_field]:
            setattr(endoso, col, form_value_mapping[form_field])

    # Manejar entidades relacionadas (e.g., Ramo, Subramo, Aseguradora, etc.)
    def check_new_form():
        argdict = {}

        ramo = flask_request.form.get('ramo')
        nuevo_ramo = flask_request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class(
            Agente, agente, nuevo_agente, "nombre")

        return argdict

    # Actualizar entidades relacionadas
    related_entities = check_new_form()
    for key, value in related_entities.items():
        setattr(endoso, key, value)

    # Guardar cambios en la base de datos
    try:
        db.session.commit()
        # Registrar la acción de edición
        request_entry = Request(
            usuario_id=current_user.id,
            description=f"Editar endoso {endoso.endoso} para la póliza {endoso.poliza}",
            status="Aceptada",
            table_name='Endoso',
            row_id=endoso.id
        )
        db.session.add(request_entry)
        db.session.commit()

        return jsonify({'error': False, 'msg': 'Endoso actualizado exitosamente', 'endoso_id': endoso.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': True, 'msg': f'Error al actualizar el endoso: {str(e)}'})


@polizas_route.route('/process_receipt', methods=['POST'])
@login_required
def process_receipt():
    """
    Processes a receipt based on the action specified in the request form.
    The function handles three actions:
    - "Pagar": Marks the receipt as paid and logs the action.
    - "Cancelar Pago": Cancels the payment of the receipt and logs the action.
    - "Modificar Fecha de Pago": Modifies the payment date of the receipt and logs the action.
    Returns:
        JSON response indicating the success or failure of the action.
    Raises:
        ValueError: If the provided payment date is not valid or is in the future.
    Request Form Parameters:
        recibo_id (str): The ID of the receipt to be processed.
        accion (str): The action to be performed on the receipt.
        fecha_pago (str, optional): The new payment date for the receipt (required for "Modificar Fecha de Pago" action).
    JSON Response:
        error (bool): Indicates if there was an error.
        msg (str): A message describing the result of the action.
    """
    recibo_id = flask_request.form.get('recibo_id')
    accion = flask_request.form.get('accion')
    recibo = Recibo.query.get(recibo_id)
    poliza = Poliza.query.get(recibo.poliza_id)
    if not recibo:
        return jsonify({
            'error': True,
            'msg': 'Recibo no encontrado'
        })
    if accion not in ("Pagar", 'Cancelar Pago', 'Modificar Fecha de Pago'):
        return jsonify({
            'error': True,
            'msg': 'Acción no válida'
        })

    if accion == "Pagar":
        recibo.status = 'Liquidado'
        recibo.fecha_pago = datetime.now().strftime('%Y-%m-%d')

        request_entry = Request(usuario_id=current_user.id,
                                description=f"Pagar recibo {recibo.no_de_recibo} de la poliza {poliza.poliza}",
                                status="Aceptada",
                                table_name='Recibo',
                                row_id=recibo.id)
        db.session.add(request_entry)
        db.session.commit()

        return jsonify({
            'error': False,
            'msg': 'Recibo pagado exitosamente'
        })
    elif accion == 'Cancelar Pago':
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Cancelar pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza}",
                                table_name='Recibo',
                                row_id=recibo.id)
        db.session.add(request_entry)
        db.session.commit()
        log_entry_1 = Log(request_id=request_entry.id,
                          column_name='status',
                          old_value=recibo.status,
                          new_value='Pendiente')
        log_entry_2 = Log(request_id=request_entry.id,
                          column_name='fecha_pago',
                          old_value=recibo.fecha_pago,
                          new_value=None)

        db.session.add(log_entry_1)
        db.session.add(log_entry_2)
        recibo.status = 'Pendiente'
        recibo.fecha_pago = None
        db.session.commit()

        return jsonify({
            'error': False,
            'msg': 'Pago de recibo cancelado exitosamente, esta accion esta sujeta a revision'
        })
    elif accion == 'Modificar Fecha de Pago':
        nueva_fecha_pago = flask_request.form.get('fecha_pago')
        try:
            nueva_fecha_pago = datetime.strptime(nueva_fecha_pago, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                'error': True,
                'msg': 'Fecha de pago no válida'
            })

        hoy = datetime.now()
        delta = (hoy - nueva_fecha_pago).days

        if delta < 0:
            return jsonify({
                'error': True,
                'msg': 'La fecha de pago no puede ser en el futuro'
            })
        elif delta <= 5:
            recibo.fecha_pago = nueva_fecha_pago
            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Modificar fecha de pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza} a {nueva_fecha_pago.strftime('%Y-%m-%d')}",
                                    status="Aceptada",
                                    table_name='Recibo',
                                    row_id=recibo.id)
            db.session.add(request_entry)
            db.session.commit()
            return jsonify({
                'error': False,
                'msg': 'Fecha de pago modificada exitosamente'
            })
        else:
            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Modificar fecha de pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza} a {nueva_fecha_pago.strftime('%Y-%m-%d')}",
                                    table_name='Recibo',
                                    row_id=recibo.id)
            db.session.add(request_entry)
            db.session.commit()
            log_entry = Log(request_id=request_entry.id,
                            column_name='fecha_pago',
                            old_value=recibo.fecha_pago,
                            new_value=nueva_fecha_pago)

            db.session.add(log_entry)
            recibo.fecha_pago = nueva_fecha_pago
            db.session.commit()

            return jsonify({
                'error': False,
                'msg': 'Fecha de pago modificada exitosamente, esta accion esta sujeta a revision debido a registro tardio'
            })


# @main.route('/get_data_multiple', methods=['GET'])
@polizas_route.route('/get_form_data', methods=['GET'])
@login_required
def get_form_data():
    clases = {
        "Aseguradora": Aseguradora,
        "Agente": Agente,
        "Vendedor": Vendedor,
        "Ramo": Ramo,
        "Subramo": Subramo,
        "TipoPago": TipoPago
    }
    response = {}
    for key, tabla in clases.items():
        # Order by id in descending order
        query = tabla.query.order_by(tabla.id.desc())
        records = query.all()
        # Format data
        data = []
        for record in records:
            # Extracting all columns from the Poliza object
            record_data = {}
            # Iterate through each column in the Poliza table
            for column in tabla.__table__.columns:
                # Get the value of the column
                value = getattr(record, column.name)
                # Add column name and corresponding value to poliza_data dictionary
                record_data[column.name] = value
            # Append to data list
            data.append(record_data)
        # Prepare response
        response[key] = data

    return jsonify(response)


@polizas_route.route('/get_all_receipts', methods=['POST', 'GET'])
@login_required
def get_all_receipts():
    start = int(flask_request.form.get('start')
                ) if flask_request.form.get('start') else None
    length = int(flask_request.form.get('length')
                 ) if flask_request.form.get('length') else None

    aseguradora_id = flask_request.form.get('aseguradora_id')
    cliente_id = flask_request.form.get('cliente_id')
    grupo_id = flask_request.form.get('grupo_id')
    vendedor_id = flask_request.form.get('vendedor_id')
    agente_id = flask_request.form.get('agente_id')
    ramo_id = flask_request.form.get('ramo_id')

    status = flask_request.form.get('status')
    # ENUM('Liquidado', 'Pendiente', 'Vencido', 'Cancelado')
    if status and status not in ('Liquidado', 'Pendiente', 'Vencido', 'Cancelado'):
        return jsonify({'error': True, 'msg': 'Estado no válido, debe estar en [Liquidado, Pendiente, Vencido, Cancelado]'})

    # Get valid list of policies
    polizas = []
    if cliente_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.cliente_id == int(cliente_id)).all()
        polizas = [poliza.id for poliza in polizas_query]

    if grupo_id:
        clients_query = db.session.query(Cliente) \
            .filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.cliente_id.in_(clients)).all()
        polizas = [poliza.id for poliza in polizas_query]

    if aseguradora_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.aseguradora_id == int(aseguradora_id)).all()
        if polizas == []:
            polizas = [poliza.id for poliza in polizas_query]
        else:
            polizas = list(set(polizas).intersection(
                [poliza.id for poliza in polizas_query]))

    if vendedor_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.vendedor_id == int(vendedor_id)).all()
        if polizas == []:
            polizas = [poliza.id for poliza in polizas_query]
        else:
            polizas = list(set(polizas).intersection(
                [poliza.id for poliza in polizas_query]))

    if agente_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.agente_id == int(agente_id)).all()
        if polizas == []:
            polizas = [poliza.id for poliza in polizas_query]
        else:
            polizas = list(set(polizas).intersection(
                [poliza.id for poliza in polizas_query]))

    if ramo_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.ramo_id == int(ramo_id)).all()
        if polizas == []:
            polizas = [poliza.id for poliza in polizas_query]
        else:
            polizas = list(set(polizas).intersection(
                [poliza.id for poliza in polizas_query]))

    # Client and grupo can not be asked both
    if cliente_id and grupo_id:
        return jsonify({'error': True,
                        'msg': 'No se puede buscar por cliente y grupo al mismo tiempo'})

    # Query the database for upcoming receipts
    upcoming_receipts_query = db.session.query(Recibo,
                                               Poliza,
                                               Cliente.nombre.label(
                                                   "client_name"),
                                               Cliente.apellido.label(
                                                   "client_lastname"),
                                               Aseguradora.aseguradora.label(
                                                   "aseguradora"),
                                               Ramo.ramo.label("ramo"),
                                               Subramo.subramo.label(
                                                   "subramo"),
                                               TipoPago.tipo_pago.label(
                                                   "tipo_pago"),
                                               Agente.nombre.label("agente"),
                                               Vendedor.nombre.label("vendedor")) \
        .select_from(Recibo) \
        .join(Poliza, Recibo.poliza_id == Poliza.id) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Subramo, Poliza.subramo_id == Subramo.id) \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id)

    if aseguradora_id or cliente_id or grupo_id:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.poliza_id.in_(polizas))

    if flask_request.form.get('start_date') and flask_request.form.get('end_date'):
        start_date = datetime.strptime(
            flask_request.form.get('start_date'), '%Y-%m-%d')
        end_date = datetime.strptime(
            flask_request.form.get('end_date'), '%Y-%m-%d')
        upcoming_receipts_query = upcoming_receipts_query.filter(Recibo.fecha_inicio >= start_date,
                                                                 Recibo.fecha_inicio <= end_date)
    upcoming_receipts_query = upcoming_receipts_query.order_by(
        Recibo.fecha_inicio)

    if status:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.status == status)

    total_records = upcoming_receipts_query.count()

    if not length and not start:
        upcoming_receipts = upcoming_receipts_query.all()
    else:
        upcoming_receipts = upcoming_receipts_query.offset(
            start).limit(length).all()

    # Prepare the response data
    response = []
    for recibo, poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in upcoming_receipts:

        data = {
            'poliza_id': recibo.poliza_id,
            'poliza': poliza.poliza,
            'no_de_recibo': f"'{recibo.no_de_recibo}",  # Convert to string
            'cliente': f'{nombre} {apellido}',
            'notas': poliza.notas,
            'serie': poliza.serie,
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': recibo.fecha_inicio.strftime('%d/%m/%y'),
            'fecha_fin': recibo.fecha_vencimiento.strftime('%d/%m/%y'),
            'fecha_pago': recibo.fecha_pago.strftime('%d/%m/%y') if recibo.fecha_pago else '',
            'prima_neta': recibo.prima_neta,
            'prima_total': recibo.prima_total,
            'moneda': poliza.moneda,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior,
            'aseguradora': aseguradora,
            'status': recibo.status
        }

        response.append(data)

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })
