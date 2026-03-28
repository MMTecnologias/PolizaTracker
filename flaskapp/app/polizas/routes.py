import io
import pdfplumber
from pdfminer.high_level import extract_text as pdfminer_extract_text
import json
import re
import os
import uuid
import unicodedata
import requests
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response, send_from_directory, has_app_context
from flask import request as flask_request
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class, new_class_deferred
from sqlalchemy import join, or_, desc, func, select
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
    start_param = flask_request.form.get('start')
    length_param = flask_request.form.get('length')

    if not start_param or not length_param:
        return jsonify({'error': True, 'msg': 'Parámetros inválidos'})

    start = int(start_param)
    length = int(length_param)

    endoso_id = flask_request.form.get('endoso_id')
    if endoso_id:
        recibos_query = Recibo.query.filter_by(endoso_id=endoso_id)
        print(f"Endoso ID: {endoso_id}")
        endoso = Endoso.query.get(endoso_id)
        if not endoso:
            return jsonify({'error': True, 'msg': 'Endoso no encontrado'})
        poliza_id = endoso.poliza_id
        print(f"Poliza ID de endoso: {poliza_id}")
    else:
        recibos_query = Recibo.query.filter_by(
            poliza_id=poliza_id, endoso_id=None)

    if not poliza_id:
        return jsonify({'error': True, 'msg': 'Póliza no encontrada'})

    poliza = Poliza.query.get(int(poliza_id))
    if not poliza:
        return jsonify({'error': True, 'msg': 'Póliza no encontrada'})

    moneda = poliza.moneda
    # Get total count of records without filtering
    total_records = recibos_query.count()
    # Apply pagination
    recibos = recibos_query.offset(start).limit(length).all()

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
    search_normalized = search_query.strip().lower()
    clients_query = db.session.query(Cliente.id, Cliente.nombre, Cliente.apellido) \
        .filter(Cliente.status == 'Activo') \
        .filter(or_(
            func.lower(func.concat(Cliente.nombre, ' ', Cliente.apellido)).like(
                f'%{search_normalized}%')
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
    if poliza_id:
        polizas_query = polizas_query.filter(Poliza.id == int(poliza_id))
    elif search_value:
        print('entro en search value')
        search_normalized = ' '.join(search_value.strip().lower().split())
        polizas_query = polizas_query.filter(or_(
            func.lower(func.replace(Cliente.nombre, ' ', '')).like(
                f'%{search_normalized.replace(" ", "")}%'),
            func.lower(func.replace(Cliente.apellido, ' ', '')).like(
                f'%{search_normalized.replace(" ", "")}%'),
            func.lower(func.replace(Grupo.grupo, ' ', '')).like(
                f'%{search_normalized.replace(" ", "")}%'),
            func.lower(func.replace(func.concat(Cliente.nombre, ' ', Cliente.apellido), ' ', '')).like(
                f'%{search_normalized.replace(" ", "")}%'),
            func.lower(func.replace(Poliza.poliza, ' ', '')).like(
                f'{search_normalized.replace(" ", "")}%'),
        ))
    total_records = polizas_query.count()
    if order:
        polizas_query = polizas_query.order_by(desc(Poliza.fecha_inicio))
    else:
        polizas_query = polizas_query.order_by('poliza')

    if poliza_id:
        polizas = polizas_query.all()
    else:
        polizas = polizas_query.offset(start).limit(
            length).all() if length is not None else polizas_query.all()
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
        argdict["ramo_id"] = new_class_deferred(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class_deferred(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class_deferred(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class_deferred(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class_deferred(
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
        'conducta_pago': 'conducto_pago',
        'derecho_poliza': 'derecho_poliza',
        'iva': 'iva',
        'comision': 'comision',
        'recibos': 'recibos'
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
        'conducto_pago': flask_request.form.get('conducto_pago'),
        'derecho_poliza': flask_request.form.get('derecho_poliza'),
        'iva': flask_request.form.get('iva'),
        'comision': flask_request.form.get('comision'),
        'recibos': flask_request.form.get('recibos')
    }
    arg_values = {col: form_value_mapping[map] for col, map in column_name_mapping.items(
    ) if form_value_mapping[map]}

    # Validar que cliente_id no sea None o "None"
    cliente_id_val = arg_values.get('cliente_id')
    if not cliente_id_val or str(cliente_id_val).strip() in ('', 'None', 'none'):
        return jsonify({'error': True, 'msg': 'Debe seleccionar un cliente', 'title': 'Cliente requerido'})

    # Convertir cliente_id a entero
    try:
        arg_values['cliente_id'] = int(cliente_id_val)
    except (ValueError, TypeError):
        return jsonify({'error': True, 'msg': 'ID de cliente inválido', 'title': 'Cliente inválido'})

    # If cliente_id is "New", then it's a new client creation
    # if poliza_id == "New":
    arg_values.update(check_new_form())
    arg_values["fecha_captura"] = datetime.now().strftime('%Y-%m-%d')

    # Vincular PDF si fue subido
    pdf_path = flask_request.form.get('pdf_path')
    print(f"[CREATE] pdf_path recibido del form: '{pdf_path}'")
    if pdf_path:
        arg_values["pdf_path"] = pdf_path
        print(f"[CREATE] pdf_path asignado a arg_values: '{pdf_path}'")
    else:
        print(f"[CREATE] ADVERTENCIA: pdf_path está vacío o None, no se guardará en BD")

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

    # Asegurar valores por defecto para campos que pueden ser None
    if not arg_values.get('pdf_path'):
        arg_values['pdf_path'] = ''
    if not arg_values.get('derecho_poliza') or str(arg_values.get('derecho_poliza')).strip() in ('', 'None', 'none'):
        arg_values['derecho_poliza'] = 0
    if not arg_values.get('iva') or str(arg_values.get('iva')).strip() in ('', 'None', 'none'):
        arg_values['iva'] = 0
    if not arg_values.get('comision') or str(arg_values.get('comision')).strip() in ('', 'None', 'none'):
        arg_values['comision'] = 0
    # La póliza siempre se crea con recibos 'Por generar'; se actualizan en /save_receipts
    arg_values['recibos'] = 'Por generar'

    new_poliza = Poliza(**arg_values)
    print(
        f"[CREATE] Poliza a guardar - poliza: '{arg_values.get('poliza')}', pdf_path: '{arg_values.get('pdf_path', 'NO DEFINIDO')}', recibos: '{arg_values.get('recibos')}'")
    # Save the new client to the database
    db.session.add(new_poliza)
    db.session.commit()
    print(
        f"[CREATE] Poliza guardada en BD - ID: {new_poliza.id}, pdf_path en BD: '{new_poliza.pdf_path}', recibos: '{new_poliza.recibos}'")

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
        if form_value_mapping[form_field] and str(form_value_mapping[form_field]).strip() not in ('', 'None', 'none'):
            if col == 'cliente_id':
                try:
                    setattr(poliza, col, int(form_value_mapping[form_field]))
                except (ValueError, TypeError):
                    return jsonify({'error': True, 'msg': 'ID de cliente inválido', 'title': 'Cliente inválido'})
            else:
                setattr(poliza, col, form_value_mapping[form_field])

    # Handle related entities (e.g., Ramo, Subramo, Aseguradora, etc.)
    def check_new_form():
        argdict = {}

        ramo = flask_request.form.get('ramo')
        nuevo_ramo = flask_request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class_deferred(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class_deferred(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class_deferred(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class_deferred(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class_deferred(
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

    # Para endosos, usar las fechas del endoso guardado si existe
    endoso_id = flask_request.form.get('endoso_id')
    if endoso_id:
        endoso = Endoso.query.get(endoso_id)
        if endoso:
            fecha_inicio = endoso.fecha_inicio.strftime('%Y-%m-%d')
            fecha_termino = endoso.fecha_termino.strftime('%Y-%m-%d')
            print(
                f"DEBUG - Usando fechas del endoso: {fecha_inicio} a {fecha_termino}")

    # Calcular la duración de la póliza en años, considerando años bisiestos
    start_date = datetime.strptime(fecha_inicio, '%Y-%m-%d')
    end_date = datetime.strptime(fecha_termino, '%Y-%m-%d')

    # Calcular la duracion en meses usando relativedelta
    from dateutil.relativedelta import relativedelta
    delta = relativedelta(end_date, start_date)
    policy_duration_months = delta.years * 12 + delta.months

    # Debug: imprimir valores
    print(f"DEBUG - Fecha inicio: {start_date}, Fecha fin: {end_date}")
    print(
        f"DEBUG - Delta: {delta.years} años, {delta.months} meses, {delta.days} días")
    print(f"DEBUG - Duración en meses: {policy_duration_months}")

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
        print(f"DEBUG - Meses por pago (deltames): {deltames}")
        print(f"DEBUG - Pagos anuales: {tipo_pago.pagos_anuales}")
        if deltames > policy_duration_months:
            return jsonify({'error': True, 'msg': 'Este tipo de pago no es valido para la duracion de la poliza/endoso. Porfavor, intente con otro'})
        # Calcular número de pagos redondeando hacia arriba
        import math
        num_payments = math.ceil(policy_duration_months / deltames)
        print(f"DEBUG - Número de pagos calculado: {num_payments}")

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
    print(
        f"[CALCULAR_RECIBOS] totalPremium={prima_total}, netPremium={prima_neta}, iva={iva}, insurance={derecho_poliza}")
    print(f"[CALCULAR_RECIBOS] receipts={flask_request.form.get('receipts')}, commission={flask_request.form.get('commission')}, rec_pago={flask_request.form.get('rec_pago')}, selectPoliza={flask_request.form.get('selectPoliza')}")
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
    # Si start_date es string, convertir a datetime
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
    # Si es date, convertir a datetime
    elif isinstance(start_date, date) and not isinstance(start_date, datetime):
        start_date = datetime.combine(start_date, datetime.min.time())

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
    print(f"[SAVE_RECEIPTS] poliza_id='{poliza_id}', endoso_id='{endoso_id}'")
    print(f"[SAVE_RECEIPTS] poliza encontrada: {poliza is not None}")
    if poliza:
        print(
            f"[SAVE_RECEIPTS] poliza.recibos='{poliza.recibos}', poliza.poliza='{poliza.poliza}'")
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
        print(
            f"[SAVE_RECEIPTS] ERROR: Poliza con id='{poliza_id}' no encontrada en BD")
        return jsonify({'error': True, 'msg': 'Poliza no encontrada'})
    elif poliza.recibos == "Generados":
        print(
            f"[SAVE_RECEIPTS] ERROR: La poliza '{poliza.poliza}' ya tiene recibos generados")
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
        print(
            f"[SAVE_RECEIPTS] Recibos guardados exitosamente para poliza_id='{poliza_id}', total recibos={response['nopagos']}")
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
    if endoso_or_poliza.recibos != "Generados" and endoso_or_poliza.recibos != "Por generar":
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
        argdict["ramo_id"] = new_class_deferred(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class_deferred(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class_deferred(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class_deferred(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class_deferred(
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

    # Validar que cliente_id no sea None o "None"
    cliente_id_val = arg_values.get('cliente_id')
    if not cliente_id_val or str(cliente_id_val).strip() in ('', 'None', 'none'):
        # Usar el cliente de la póliza original si no se proporciona
        arg_values['cliente_id'] = poliza.cliente_id
    else:
        try:
            arg_values['cliente_id'] = int(cliente_id_val)
        except (ValueError, TypeError):
            arg_values['cliente_id'] = poliza.cliente_id

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
        argdict["ramo_id"] = new_class_deferred(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = flask_request.form.get('subramo')
        nuevo_subramo = flask_request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class_deferred(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = flask_request.form.get('aseguradora')
        nuevo_aseguradora = flask_request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class_deferred(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = flask_request.form.get('vendedor')
        nuevo_vendedor = flask_request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class_deferred(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = flask_request.form.get('agente')
        nuevo_agente = flask_request.form.get('nuevo_agente')
        argdict["agente_id"] = new_class_deferred(
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
    status = flask_request.form.get('status')
    grupo_id = flask_request.form.get('grupo_id')
    ramo_id = flask_request.form.get('ramo_id')
    agente_id = flask_request.form.get('agente_id')
    vendedor_id = flask_request.form.get('vendedor_id')

    # ENUM('Liquidado', 'Pendiente', 'Vencido', 'Cancelado')
    if status and status not in ('Liquidado', 'Pendiente', 'Vencido', 'Cancelado'):
        return jsonify({'error': True, 'msg': 'Estado no válido, debe estar en [Liquidado, Pendiente, Vencido, Cancelado]'})

    # Get valid list of policies using intersection logic
    polizas_sets = []

    if aseguradora_id:
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.aseguradora_id == int(aseguradora_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if grupo_id:
        clients_query = db.session.query(Cliente.id).filter(
            Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.cliente_id.in_(clients)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if ramo_id:
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.ramo_id == int(ramo_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if agente_id:
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.agente_id == int(agente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if vendedor_id:
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.vendedor_id == int(vendedor_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if cliente_id:
        polizas_query = db.session.query(Poliza.id).filter(
            Poliza.cliente_id == int(cliente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if polizas_sets:
        polizas = list(set.intersection(*polizas_sets))
    else:
        polizas = None  # No filters applied, get all policies

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

    if polizas is not None:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.poliza_id.in_(polizas))

    # Validate and apply date filters
    start_date_param = flask_request.form.get('start_date')
    end_date_param = flask_request.form.get('end_date')

    valid_start_date = None
    valid_end_date = None

    if start_date_param and len(start_date_param.strip()) >= 8:
        try:
            valid_start_date = datetime.strptime(start_date_param, '%Y-%m-%d')
        except ValueError:
            valid_start_date = None

    if end_date_param and len(end_date_param.strip()) >= 8:
        try:
            valid_end_date = datetime.strptime(end_date_param, '%Y-%m-%d')
        except ValueError:
            valid_end_date = None

    # Apply date filters only if valid dates are provided
    if valid_start_date and valid_end_date:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.fecha_inicio >= valid_start_date,
            Recibo.fecha_inicio <= valid_end_date
        )
    elif valid_start_date:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.fecha_inicio >= valid_start_date)
    elif valid_end_date:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.fecha_inicio <= valid_end_date)
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
            'vendedor': f'{vendedor}',
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


JSON_SCHEMA = {
    "descripcion": "string",
    "desde": "string",
    "numero_de_poliza": "string",
    "forma_de_pago": "string",
    "hasta": "string",
    "nombre_cliente": "string",
    "aseguradora": "string",
    "agente": "string",
    "ramo": "string",
    "subramo": "string",
    "prima_neta": "string",
    "prima_total": "string",
    "moneda": "string",
    "rfc": "string",
    "endoso": "string",
    "marca": "string",
    "modelo": "string",
    "motor": "string",
    "placas": "string",
    "numero_serie": "string",
    "derecho_poliza": "string",
    "gastos_expedicion": "string"
}

DEFAULT_POLICY_VENDEDOR = "GUILLERMO GARDUÑO"
DEFAULT_POLICY_AGENT = "GUILLERMO GARDUÑO GALI"
ALLOWED_POLICY_LOG_STAGES = {
    "pdf_extract",
    "pdf_extract_error",
    "pipeline_start",
    "pdf_text_summary",
    "ai_output_summary",
    "model_attempt_error",
    "reconciliation_error",
    "prima_total",
    "premium_validation",
    "pipeline_recovery",
    "pipeline_result",
    "pipeline_normalized",
}

LOCAL_POLICY_MODEL_CANDIDATES = [
    "qwen2.5:7b",
    "llama3.1:8b",
    "mistral:7b-instruct",
    "gemma2:9b"
]

CRITICAL_POLICY_FIELDS = (
    "numero_de_poliza",
    "nombre_cliente",
    "desde",
    "hasta",
    "prima_total"
)

POLICY_FEE_LABELS = [
    r'Derecho de p[oó]liza',
    r'Gastos de expedici[oó]n',
    r'Gastos por expedici[oó]n',
    r'Gasto de expedici[oó]n',
    r'Policy Fee',
]

POLICY_DEBUG_FIELDS = (
    "numero_de_poliza",
    "nombre_cliente",
    "rfc",
    "aseguradora",
    "agente",
    "ramo",
    "subramo",
    "desde",
    "hasta",
    "forma_de_pago",
    "prima_neta",
    "prima_total",
    "descripcion",
    "numero_serie",
    "placas",
)

POLICY_LOG_SUMMARY_FIELDS = (
    "numero_de_poliza",
    "nombre_cliente",
    "aseguradora",
    "agente",
    "desde",
    "hasta",
    "forma_de_pago",
    "prima_neta",
    "prima_total",
)


def log_policy_event(stage: str, message: str, **kwargs):
    """Log ligero con contexto uniforme para depurar la extracción de pólizas."""
    if stage not in ALLOWED_POLICY_LOG_STAGES:
        return

    extra = " ".join(
        f"{key}={json.dumps(value, ensure_ascii=False)}"
        for key, value in kwargs.items() if value is not None
    )
    log_message = f"[POLICY_AI][{stage}] {message}"
    if extra:
        log_message = f"{log_message} | {extra}"

    if has_app_context():
        current_app.logger.info(log_message)
    else:
        print(log_message)


def build_policy_debug_snapshot(data: dict, fields=POLICY_DEBUG_FIELDS) -> dict:
    data = data or {}
    snapshot = {}
    for field in fields:
        value = sanitize_text_value(data.get(field))
        if value:
            snapshot[field] = value
    return snapshot


# def extract_text_from_pdf(pdf_path: str) -> str:
#     text = ""
#     try:
#         with pdfplumber.open(pdf_path) as pdf:
#             if not pdf.pages:
#                 raise ValueError("El PDF no contiene páginas")

#             for page in pdf.pages:
#                 page_text = page.extract_text()
#                 if page_text:
#                     text += page_text + "\n"

#         if not text.strip():
#             raise ValueError("No se pudo extraer texto del PDF")

#         return text
#     except Exception as e:
#         print(f"Error al leer el PDF '{pdf_path}': {e}")
#         if 'No /Root object' in str(e):
#             raise Exception("El archivo PDF está corrupto o no es un PDF válido")
#         raise


def extract_text_from_pdf_content(file_content: bytes) -> str:
    try:
        # Validar que el archivo comience con el header de PDF
        if not file_content.startswith(b'%PDF'):
            raise ValueError("El archivo no es un PDF válido")

        text = ""
        page_summaries = []
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            if not pdf.pages:
                raise ValueError("El PDF no contiene páginas")

            # Primeras 8 páginas
            for page_index, page in enumerate(pdf.pages[:8], start=1):
                page_text = page.extract_text(x_tolerance=3, y_tolerance=3)
                page_text_len = len(page_text.strip()) if page_text else 0
                table_count = 0
                if page_text:
                    text += page_text + "\n"
                for table in page.extract_tables():
                    table_count += 1
                    for row in table:
                        row_text = " | ".join(
                            cell.strip() if cell else "" for cell in row)
                        if row_text.strip(" |"):
                            text += row_text + "\n"
                page_summaries.append({
                    "page": page_index,
                    "text_chars": page_text_len,
                    "tables": table_count
                })

        # Fallback con pdfminer para PDFs de texto plano (ej. AXXA)
        if not text.strip():
            log_policy_event(
                "pdf_extract", "pdfplumber no extrajo texto, usando fallback pdfminer")
            text = pdfminer_extract_text(
                io.BytesIO(file_content), maxpages=8) or ""

        log_policy_event(
            "pdf_extract",
            "extracción de texto completada",
            bytes=len(file_content),
            chars=len(text),
            pages=page_summaries,
            contains_policy=("PÓLIZA" in text.upper() or "POLIZA" in text.upper()),
            contains_cliente=("CONTRATANTE" in text.upper() or "CLIENTE" in text.upper()),
            contains_agent=("AGENTE" in text.upper()),
            contains_forma_pago=("FORMADE PAGO" in text.upper() or "FORMA DE PAGO" in text.upper() or "FORMADEPAGO" in text.upper() or "FRECUENCIA DE PAGO" in text.upper()),
            contains_vigencia=("VIGENCIA" in text.upper() or "FECHA DE INICIO DE VIGENCIA" in text.upper()),
            contains_prima=("PRIMA" in text.upper() or "IMPORTE A PAGAR" in text.upper() or "TOTAL DEL MOVIMIENTO" in text.upper())
        )

        if not text.strip():
            raise ValueError("No se pudo extraer texto del PDF")

        max_chars = 30000
        if len(text) > max_chars:
            log_policy_event(
                "pdf_extract",
                "texto del PDF truncado para procesamiento",
                original_chars=len(text),
                kept_chars=max_chars
            )
        return text[:max_chars] if len(text) > max_chars else text
    except Exception as e:
        error_msg = str(e)
        log_policy_event("pdf_extract_error",
                         "error al leer el PDF", error=error_msg)

        if 'No /Root object' in error_msg or 'PdfReadError' in error_msg:
            raise Exception("El archivo PDF está corrupto o no es válido")
        elif 'password' in error_msg.lower() or 'encrypted' in error_msg.lower():
            raise Exception("El PDF está protegido con contraseña")
        elif "no es un PDF válido" in error_msg:
            raise Exception(error_msg)
        raise


def clean_extracted_text(text: str) -> str:
    """Normaliza el texto del PDF conservando saltos de línea útiles para tablas."""
    if not text:
        return ""

    text = text.replace("\r", "\n").replace("\t", " ")
    text = re.sub(r'[ \xa0]+', ' ', text)
    text = re.sub(r' *\| *', ' | ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_json_object(text: str) -> dict:
    """Extrae el primer objeto JSON válido incluso si viene con fences o texto extra."""
    if not text:
        raise ValueError("Respuesta vacía del modelo")

    cleaned = text.strip()
    fence_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.S)
    if fence_match:
        cleaned = fence_match.group(1)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def sanitize_text_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return str(value)
    if not isinstance(value, str):
        value = str(value)
    value = re.sub(r'\s+', ' ', value).strip()
    return value or None


def sanitize_name_candidate(value: str) -> str:
    value = sanitize_text_value(value)
    if not value:
        return None

    value = re.sub(
        r'^(?:Datos del contratante|Datos del asegurado y/o propietario|Contratante|Asegurado)\s*[:|-]?\s*',
        '',
        value,
        flags=re.I
    )
    value = re.sub(
        r'^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\s*[-:]\s*',
        '',
        value,
        flags=re.I
    )

    for token in (
        r'\bDatos del contratante\b',
        r'\bDatos del asegurado y/o propietario\b',
        r'\bContratante\b',
        r'\bAsegurado\b',
        r'\bPropietario\b',
        r'\bDomicilio\b',
        r'\bCiudad\b',
        r'\bR\.?F\.?C\.?\b',
        r'\bC\.?P\.?\b',
        r'\bTel[eé]fono\b',
        r'\bP[oó]liza\b',
        r'\bSolicitud\b',
        r'\bFecha\b'
    ):
        value = re.split(token, value, maxsplit=1, flags=re.I)[0].strip(" :|-")

    suffix_match = re.search(r'\s+([A-Z0-9/-]{5,})$', value)
    if suffix_match:
        suffix = suffix_match.group(1)
        if re.search(r'[A-Z]', suffix) and re.search(r'\d', suffix):
            value = value[:suffix_match.start()].strip(" :|-")
    value = sanitize_text_value(value)
    if value and not re.search(r'[A-ZÁÉÍÓÚÑ]', value, re.I):
        return None
    return value


def normalize_rfc_value(value: str) -> str:
    value = sanitize_text_value(value)
    if not value:
        return None
    value = re.sub(r'[^A-Z0-9]', '', value.upper())
    return value or None


def normalize_person_name_tokens(value: str) -> list:
    value = sanitize_text_value(value)
    if not value:
        return []

    normalized = unicodedata.normalize('NFKD', value)
    normalized = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
    tokens = re.findall(r'[A-Za-z]+', normalized.lower())
    stopwords = {'de', 'del', 'la', 'las', 'los', 'y', 'mc'}
    return [token for token in tokens if token not in stopwords]


def normalize_ascii_upper(value: str) -> str:
    value = sanitize_text_value(value)
    if not value:
        return ""
    normalized = unicodedata.normalize('NFKD', value)
    normalized = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.upper()
    return re.sub(r'[^A-Z]', '', normalized)


SPANISH_MONTH_ALIASES = {
    "ENE": "01",
    "ENERO": "01",
    "FEB": "02",
    "FEBRERO": "02",
    "MAR": "03",
    "MARZO": "03",
    "ABR": "04",
    "ABRIL": "04",
    "MAY": "05",
    "MAYO": "05",
    "JUN": "06",
    "JUNIO": "06",
    "JUL": "07",
    "JULIO": "07",
    "AGO": "08",
    "AGOSTO": "08",
    "SEP": "09",
    "SEPT": "09",
    "SEPTIEMBRE": "09",
    "OCT": "10",
    "OCTUBRE": "10",
    "NOV": "11",
    "NOVIEMBRE": "11",
    "DIC": "12",
    "DICIEMBRE": "12",
}


def find_agent_match_by_tokens(nombre: str, agentes) -> int:
    query_tokens = normalize_person_name_tokens(nombre)
    if not query_tokens:
        return None

    best_agent_id = None
    best_score = 0.0

    for agente in agentes:
        record_tokens = normalize_person_name_tokens(agente.nombre)
        if not record_tokens:
            continue

        common_tokens = set(query_tokens) & set(record_tokens)
        common_count = len(common_tokens)
        if common_count == 0:
            continue

        subset_ratio = common_count / max(1, min(len(query_tokens), len(record_tokens)))
        coverage_ratio = common_count / max(len(query_tokens), len(record_tokens))
        score = (subset_ratio * 0.7) + (coverage_ratio * 0.3)

        if common_count >= 2 and score > best_score:
            best_score = score
            best_agent_id = agente.id

    if best_score >= 0.65:
        return best_agent_id
    return None


def split_name_and_policy_suffix(value: str):
    """Separa un posible número de póliza pegado al final del nombre."""
    value = sanitize_text_value(value)
    if not value:
        return None, None

    match = re.match(r'^(.*?)(?:\s+([A-Z0-9/-]{5,}))$', value)
    if not match:
        return value, None

    candidate = sanitize_text_value(match.group(2))
    if not candidate:
        return value, None

    has_letter = bool(re.search(r'[A-Z]', candidate))
    has_digit = bool(re.search(r'\d', candidate))
    if not (has_letter and has_digit):
        return value, None

    clean_name = sanitize_name_candidate(match.group(1))
    if not clean_name:
        return value, None

    return clean_name, candidate


def normalize_amount_value(value):
    value = sanitize_text_value(value)
    if not value:
        return None
    amount = re.sub(r'[^0-9.]', '', value)
    return amount or None


def to_float_amount(value):
    normalized = normalize_amount_value(value)
    if not normalized:
        return None
    try:
        return float(normalized)
    except (TypeError, ValueError):
        return None


def build_flexible_label_pattern(label: str) -> str:
    """Permite que el OCR una palabras como PRIMANETA o FECHADEEMISION."""
    label = label.strip()
    label = re.sub(r'\s+', r'\\s*', label)
    return label


def normalize_extracted_date(value: str) -> str:
    value = sanitize_text_value(value)
    if not value:
        return None

    value = value.upper()
    value = value.replace(".", "/").replace("-", "/")
    value = re.sub(r'\bA\s+LAS\s+\d{1,2}(?::\d{2})?\s*HRS?\.?\b', ' ', value)
    value = re.sub(r'\s+', ' ', value).strip()

    numeric_match = re.search(r'(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', value)
    if numeric_match:
        day, month, year = numeric_match.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    spaced_match = re.search(r'\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b', value)
    if spaced_match:
        day, month, year = spaced_match.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    month_keys = sorted(SPANISH_MONTH_ALIASES.keys(), key=len, reverse=True)
    month_pattern = "|".join(month_keys)
    month_match = re.search(
        rf'(\d{{1,2}})\s*/?\s*({month_pattern})\s*/?\s*(\d{{4}})',
        value,
        re.I
    )
    if month_match:
        day, month_token, year = month_match.groups()
        month = SPANISH_MONTH_ALIASES.get(month_token.upper())
        if month:
            return f"{int(day):02d}/{month}/{year}"

    month_de_match = re.search(
        rf'(\d{{1,2}})\s+DE\s+({month_pattern})\s+DE\s+(\d{{4}})',
        value,
        re.I
    )
    if month_de_match:
        day, month_token, year = month_de_match.groups()
        month = SPANISH_MONTH_ALIASES.get(month_token.upper())
        if month:
            return f"{int(day):02d}/{month}/{year}"

    return None


def extract_vigencia_values(text: str):
    month_keys = sorted(SPANISH_MONTH_ALIASES.keys(), key=len, reverse=True)
    month_pattern = "|".join(month_keys)
    date_pattern = rf'(?:\d{{1,2}}\s*[/-]\s*\d{{1,2}}\s*[/-]\s*\d{{4}}|\d{{1,2}}\s*[/-]?\s*(?:{month_pattern})\s*[/-]?\s*\d{{4}})'
    text_window = text[:6000]

    range_patterns = [
        rf'Vigencia\s*a\s*las\s*12(?::?00)?\s*hrs?\.?\s*del\s*[:|]?\s*({date_pattern})\s*(?:al|a)\s*[:|]?\s*({date_pattern})',
        rf'Vigencia\s*desde\s*las\s*12(?::?00)?\s*hrs?\.?\s*del\s*[:|]?\s*({date_pattern}).{{0,80}}?Vigencia\s*hasta\s*las\s*12(?::?00)?\s*hrs?\.?\s*del\s*[:|]?\s*({date_pattern})',
        rf'Vigencia\s*desde\s*las\s*12(?::?00)?\s*horas\s*de\s*[:|]?\s*({date_pattern}).{{0,120}}?hasta\s*las\s*12(?::?00)?\s*horas\s*de\s*[:|]?\s*({date_pattern})',
        rf'Vigencia\s*del\s*[:|]?\s*({date_pattern})\s*(?:al|a)\s*[:|]?\s*({date_pattern})',
        rf'vigencia\s*de\s*({date_pattern})\s*a\s*({date_pattern})',
        rf'Desde\s*[:|]?\s*({date_pattern}).{{0,80}}?Hasta\s*[:|]?\s*({date_pattern})',
        rf'mismo\s+que\s+tendr[áa]\s+vigencia\s+de\s*({date_pattern})\s*a\s*({date_pattern})',
    ]
    for pattern in range_patterns:
        match = re.search(pattern, text_window, re.I | re.S)
        if not match:
            continue
        desde = normalize_extracted_date(match.group(1))
        hasta = normalize_extracted_date(match.group(2))
        if desde or hasta:
            return desde, hasta

    table_match = re.search(
        r'Vigencia\s+de\s+la\s+P[oó]liza.{0,180}?Desde\s+Hasta.{0,120}?D[ií]a\s+Mes\s+A[nñ]o\s+D[ií]a\s+Mes\s+A[nñ]o\s+(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{4})',
        text_window,
        re.I | re.S
    )
    if table_match:
        desde = f"{int(table_match.group(1)):02d}/{int(table_match.group(2)):02d}/{table_match.group(3)}"
        hasta = f"{int(table_match.group(4)):02d}/{int(table_match.group(5)):02d}/{table_match.group(6)}"
        return desde, hasta

    compact_table_match = re.search(
        rf'Vigencia\s+de\s+la\s+P[oó]liza.{{0,220}}?Desde\s+Hasta.{{0,140}}?(\d{{1,2}}\s*[/-]?\s*(?:\d{{1,2}}|{month_pattern})\s*[/-]?\s*\d{{4}})\s+(\d{{1,2}}\s*[/-]?\s*(?:\d{{1,2}}|{month_pattern})\s*[/-]?\s*\d{{4}})',
        text_window,
        re.I | re.S
    )
    if compact_table_match:
        desde = normalize_extracted_date(compact_table_match.group(1))
        hasta = normalize_extracted_date(compact_table_match.group(2))
        if desde or hasta:
            return desde, hasta

    vigencia_windows = re.finditer(
        r'(?is)(Vigencia.{0,260}|vigencia.{0,260}|Desde.{0,180}Hasta.{0,180})',
        text_window
    )
    raw_date_pattern = rf'(\d{{1,2}}\s*[/-]?\s*(?:\d{{1,2}}|{month_pattern})\s*[/-]?\s*\d{{4}})'
    for match in vigencia_windows:
        window = match.group(0)
        dates = []
        for raw_value in re.findall(raw_date_pattern, window, re.I):
            normalized = normalize_extracted_date(raw_value)
            if normalized and normalized not in dates:
                dates.append(normalized)
        if len(dates) >= 2:
            return dates[0], dates[1]

    single_patterns = {
        "desde": [
            rf'Fecha\s*de\s*inicio\s*de\s*vigencia\s*[:|]?\s*({date_pattern})',
            rf'Vigencia\s*desde\s*las\s*12(?::?00)?\s*hrs?\.?\s*del\s*[:|]?\s*({date_pattern})',
            rf'Vigencia\s*desde\s*las\s*12(?::?00)?\s*horas\s*de\s*[:|]?\s*({date_pattern})',
            rf'Desde\s*las\s*12(?::?00)?\s*horas?\s*de\s*[:|]?\s*({date_pattern})',
            rf'Inicio\s*de\s*vigencia\s*[:|]?\s*({date_pattern})',
            rf'Vigencia\s*inicia\s*[:|]?\s*({date_pattern})',
        ],
        "hasta": [
            rf'Fecha\s*de\s*fin\s*de\s*vigencia\s*[:|]?\s*({date_pattern})',
            rf'Vigencia\s*hasta\s*las\s*12(?::?00)?\s*hrs?\.?\s*del\s*[:|]?\s*({date_pattern})',
            rf'Vencimiento\s*[:|]?\s*({date_pattern})',
            rf'Hasta\s*las\s*12(?::?00)?\s*horas?\s*de\s*[:|]?\s*({date_pattern})',
            rf'hasta\s*las\s*12(?::?00)?\s*horas?\s*de\s*[:|]?\s*({date_pattern})',
            rf'Fin\s*de\s*vigencia\s*[:|]?\s*({date_pattern})',
            rf'Vigencia\s*termina\s*[:|]?\s*({date_pattern})',
        ],
    }

    values = {"desde": None, "hasta": None}
    for field, patterns in single_patterns.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.I | re.S)
            if not match:
                continue
            values[field] = normalize_extracted_date(match.group(1))
            if values[field]:
                break

    return values["desde"], values["hasta"]


def extract_amount_near_label(text: str, labels) -> str:
    for label in labels:
        flexible_label = build_flexible_label_pattern(label)
        pattern = rf'{flexible_label}(?:\s*[:|]?\s*|\s*\n\s*){{0,2}}[^\n]{{0,120}}?((?:\d{{1,3}}(?:,\d{{3}})+|\d+)(?:\.\d{{2}})?)'
        match = re.search(pattern, text, re.I)
        if match:
            return normalize_amount_value(match.group(1))
    return None


def extract_money_amount_near_label(text: str, labels) -> str:
    money_pattern = r'((?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+\.\d{2}|\d{4,})(?:\.\d{2})?)'
    for label in labels:
        flexible_label = build_flexible_label_pattern(label)
        pattern = rf'{flexible_label}(?:\s*[:|]?\s*|\s*\n\s*){{0,2}}[^\n]{{0,140}}?{money_pattern}'
        match = re.search(pattern, text, re.I)
        if match:
            return normalize_amount_value(match.group(1))
    return None


def extract_structured_premium_values(text: str) -> dict:
    patterns = [
        r'Prima\s*neta\s*:?.{0,180}?Gastos\s*de\s*expedici[oó]n\s*:?.{0,120}?I\.?V\.?A\.?.{0,80}?Prima\s*total\s*:?\s*\n([^\n]+)',
        r'Prima\s*neta\s*:?.{0,180}?Prima\s*total\s*:?\s*\n([^\n]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I | re.S)
        if not match:
            continue

        row = sanitize_text_value(match.group(1))
        if not row:
            continue

        amounts = [
            normalize_amount_value(value)
            for value in re.findall(r'(?:\$\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)', row)
        ]
        amounts = [value for value in amounts if value is not None]

        if len(amounts) >= 6:
            return {
                "prima_neta": amounts[0],
                "recargo": amounts[1],
                "descuento": amounts[2],
                "derecho_poliza": amounts[3],
                "iva": amounts[4],
                "prima_total": amounts[5],
            }

        if len(amounts) >= 4:
            return {
                "prima_neta": amounts[0],
                "derecho_poliza": amounts[-3] if len(amounts) >= 5 else None,
                "iva": amounts[-2],
                "prima_total": amounts[-1],
            }

    return {}


def is_suspicious_premium_amount(amount_value: str, text: str) -> bool:
    amount = to_float_amount(amount_value)
    if amount is None:
        return False

    suma_asegurada = to_float_amount(
        extract_money_amount_near_label(text, [r'Suma asegurada'])
    )
    if suma_asegurada and abs(amount - suma_asegurada) / max(suma_asegurada, 1) < 0.01:
        return True

    if amount >= 10000000:
        return True

    return False


def sanitize_premium_fields(text: str, data: dict) -> dict:
    cleaned = dict(data or {})
    for field in ("prima_neta", "prima_total"):
        value = cleaned.get(field)
        if value and is_suspicious_premium_amount(value, text):
            log_policy_event(
                "premium_validation",
                "monto de prima descartado por sospechoso",
                field=field,
                value=value
            )
            cleaned[field] = None
    return cleaned


def extract_prima_neta_value(text: str, prima_total: str = None, derecho_poliza: str = None) -> str:
    structured_values = extract_structured_premium_values(text)
    structured_prima_neta = structured_values.get("prima_neta")
    if structured_prima_neta and not is_suspicious_premium_amount(structured_prima_neta, text):
        log_policy_event(
            "prima_total",
            "prima neta encontrada en fila estructurada de primas",
            prima_neta=structured_prima_neta
        )
        return structured_prima_neta

    direct_labels = [
        r'Prima neta',
        r'Prima del movimiento',
        r'Prima básica',
        r'Prima base',
        r'Prima'
    ]
    direct_value = extract_money_amount_near_label(text, direct_labels)
    if direct_value and not is_suspicious_premium_amount(direct_value, text):
        return direct_value

    prima_section_match = re.search(r'(?:Prima|Recibo|Importe a pagar)(.{0,2200})', text, re.I | re.S)
    prima_section = prima_section_match.group(0) if prima_section_match else text

    section_value = extract_money_amount_near_label(prima_section, direct_labels)
    if section_value and not is_suspicious_premium_amount(section_value, text):
        return section_value

    prima_total_val = to_float_amount(prima_total) or to_float_amount(
        extract_prima_total_value(prima_section)
    )
    derecho_val = to_float_amount(derecho_poliza) or to_float_amount(
        extract_money_amount_near_label(prima_section, POLICY_FEE_LABELS)
    ) or 0.0
    iva_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'I\.?V\.?A\.?', r'IVA'])
    ) or 0.0
    recargo_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Recargo por pago fraccionado', r'Recargo', r'Financiamiento'])
    ) or 0.0
    descuento_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Descuento familiar', r'Descuento', r'Bonificaci[oó]n'])
    ) or 0.0
    cesion_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Cesi[oó]n de comisi[oó]n', r'Cesi[oó]n'])
    ) or 0.0

    if prima_total_val is None:
        return None

    inferred_neta = prima_total_val - derecho_val - iva_val - recargo_val + descuento_val + cesion_val
    if inferred_neta <= 0:
        return None

    inferred_value = f"{inferred_neta:.2f}"
    if is_suspicious_premium_amount(inferred_value, text):
        return None

    log_policy_event(
        "prima_total",
        "prima neta inferida desde componentes",
        prima_total=prima_total_val,
        derecho_poliza=derecho_val,
        iva=iva_val,
        recargo=recargo_val,
        descuento=descuento_val,
        cesion=cesion_val,
        prima_neta=inferred_value
    )
    return inferred_value


def extract_prima_total_value(text: str, prima_neta: str = None, derecho_poliza: str = None) -> str:
    structured_values = extract_structured_premium_values(text)
    structured_prima_total = structured_values.get("prima_total")
    if structured_prima_total:
        log_policy_event(
            "prima_total",
            "prima total encontrada en fila estructurada de primas",
            prima_total=structured_prima_total
        )
        return structured_prima_total

    # Formato tabular Mapfre: encabezados en una línea, valores en la siguiente.
    # "Prima neta: ... Prima total:\n11,228.38 ... $ 13,430.93"
    # El valor de prima total es el ÚLTIMO número monetario de la fila de datos.
    tabular_match = re.search(
        r'Prima\s*neta\s*:.{0,200}?Prima\s*total\s*:\s*\n([^\n]+)',
        text, re.I
    )
    if tabular_match:
        row = tabular_match.group(1)
        money_pattern = r'(?:\$\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)'
        amounts = re.findall(money_pattern, row)
        if amounts:
            candidate = normalize_amount_value(amounts[-1])
            log_policy_event(
                "prima_total",
                "prima total encontrada en formato tabular (última columna)",
                prima_total=candidate
            )
            return candidate

    direct_labels = [
        r'Prima anual total',
        r'Prima total anual',
        r'Prima total',
        r'Total a pagar',
        r'Importe total',
        r'Prima al cobro',
        r'Prima del movimiento',
        r'Prima total del movimiento',
        r'Total del movimiento',
        r'Total del recibo',
        r'Importe a pagar'
    ]
    direct_value = extract_money_amount_near_label(text, direct_labels)
    if direct_value:
        log_policy_event(
            "prima_total",
            "prima total encontrada por etiqueta directa",
            prima_total=direct_value
        )
        return direct_value

    prima_section_match = re.search(r'(?:Prima|Recibo|Importe a pagar)(.{0,2200})', text, re.I | re.S)
    if prima_section_match:
        prima_section = prima_section_match.group(0)
        section_value = extract_money_amount_near_label(prima_section, direct_labels)
        if section_value:
            log_policy_event(
                "prima_total",
                "prima total encontrada dentro de la sección Prima",
                prima_total=section_value
            )
            return section_value
    else:
        prima_section = text

    prima_neta_val = to_float_amount(prima_neta) or to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Prima neta', r'Prima anual', r'Prima del movimiento'])
    )
    if prima_neta_val is not None and is_suspicious_premium_amount(f"{prima_neta_val:.2f}", text):
        log_policy_event(
            "prima_total",
            "inferencia omitida porque prima_neta parece suma asegurada",
            prima_neta=prima_neta_val
        )
        return None
    derecho_val = to_float_amount(derecho_poliza) or to_float_amount(
        extract_money_amount_near_label(prima_section, POLICY_FEE_LABELS)
    ) or 0.0
    iva_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'I\.?V\.?A\.?', r'IVA'])
    ) or 0.0
    recargo_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Recargo por pago fraccionado', r'Recargo', r'Financiamiento'])
    ) or 0.0
    descuento_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Descuento familiar', r'Descuento', r'Bonificaci[oó]n'])
    ) or 0.0
    cesion_val = to_float_amount(
        extract_money_amount_near_label(prima_section, [r'Cesi[oó]n de comisi[oó]n', r'Cesi[oó]n'])
    ) or 0.0

    if prima_neta_val is None:
        return None

    present_components = sum(
        1 for val in (derecho_val, iva_val, recargo_val, descuento_val, cesion_val) if val and val > 0
    )
    if present_components == 0:
        return None

    inferred_total = prima_neta_val + derecho_val + iva_val + recargo_val - descuento_val - cesion_val
    if inferred_total <= 0:
        return None

    inferred_value = f"{inferred_total:.2f}"
    log_policy_event(
        "prima_total",
        "prima total inferida desde componentes",
        prima_neta=prima_neta_val,
        derecho_poliza=derecho_val,
        iva=iva_val,
        recargo=recargo_val,
        descuento=descuento_val,
        cesion=cesion_val,
        prima_total=inferred_value
    )
    return inferred_value


def extract_policy_number_value(text: str) -> str:
    def normalize_policy_candidate(candidate: str) -> str:
        candidate = sanitize_text_value(candidate)
        if not candidate:
            return None
        candidate = re.sub(r'\s+', ' ', candidate).strip(" :|-")
        compact_policy_match = re.fullmatch(r'([A-Z]\d)\s*(\d{6,10})', candidate or '')
        if compact_policy_match:
            return f"{compact_policy_match.group(1)} {compact_policy_match.group(2)}"
        spaced_alnum_match = re.fullmatch(r'([A-Z]{1,5})\s*(\d{5,}[A-Z0-9/-]*)', candidate or '')
        if spaced_alnum_match:
            return f"{spaced_alnum_match.group(1)}{spaced_alnum_match.group(2)}"
        return candidate

    def is_valid_policy_candidate(candidate: str) -> bool:
        candidate = normalize_policy_candidate(candidate)
        if not candidate:
            return False

        compact = re.sub(r'[^A-Z0-9]', '', candidate.upper())
        if len(compact) < 6:
            return False
        if not re.search(r'\d', compact):
            return False
        if compact in {"MNACIONAL", "NACIONAL"}:
            return False
        if re.fullmatch(r'[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}', compact):
            return False
        if re.fullmatch(r'\d{8}', compact) or re.fullmatch(r'\d{10}', compact):
            return False
        return True

    candidate_pattern = r'([A-Z]{1,5}\s*\d{4,}[A-Z0-9/-]*|[A-Z0-9/-]{6,})'

    patterns = [
        r'(?is)P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza\s*\n\s*[^\n]*?\b(\d{8,12})\b',
        r'(?is)P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza.{0,120}?\n\s*[^\n]*?\b(\d{8,12})\b',
        r'(?is)P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?is)P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza\s*\n+\s*([A-Z0-9/-]{5,})\b',
        # Número de póliza explícito (excluye "Ant." para no capturar la póliza anterior)
        r'(?im)^\s*P[oó]liza(?!\s*Ant)(?:\s*/\s*Endoso)?\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?is)(?:^|\n)\s*P[oó]liza(?:\s*/\s*Endoso)?\s*\n+\s*([A-Z0-9/-]{5,})\b',
        r'(?im)^\s*P[oó]liza(?:\s*/\s*Endoso)?\s*\|\s*([A-Z0-9/-]{5,})\b',
        r'(?im)\bNo\.?\s*de\s*P[oó]liza\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?im)\bP[oó]liza\s+No\.?\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?im)\bN[uú]mero\s+de\s+P[oó]liza\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?im)\bNo\.?\s+P[oó]liza\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        r'(?im)\bP[oó]liza\s+y/o\s+Certificado\s*[:|]?\s*([A-Z0-9/-]{5,})\b',
        # Formato AXA: "Póliza:" pegado o con espacio, alfanumérico con letras (ej: YBJ000840000)
        r'(?im)\bP[oó]liza\s*:\s*([A-Z]{2,5}\d{6,}[A-Z0-9/-]*)\b',
        r'(?im)\bliza\s*:\s*([A-Z]\d\s*\d{6,10})\b',
        r'(?im)\bP[oó]liza\s*:\s*([A-Z]\d\s*\d{6,10})\b',
        r'(?im)\bP[oó]liza\s*:\s*([A-Z]{1,5}\d{5,}[A-Z0-9/-]*)\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            candidate = normalize_policy_candidate(match.group(1))
            if candidate and (
                is_valid_policy_candidate(candidate) or
                re.fullmatch(r'\d{8,12}', candidate or '')
            ):
                return candidate

    label_windows = re.finditer(
        r'(?is)(?:P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza|P[oó]liza(?:\s*/\s*Endoso)?|No\.?\s*de\s*P[oó]liza|N[uú]mero\s+de\s+P[oó]liza|P[oó]liza\s+y/o\s+Certificado).{0,140}',
        text
    )
    for match in label_windows:
        window = sanitize_text_value(match.group(0))
        if not window or re.search(r'\bAnt\.?\b', window, re.I):
            continue
        candidates = re.findall(candidate_pattern, window, re.I)
        for candidate in candidates:
            normalized_candidate = normalize_policy_candidate(candidate)
            # Evitar capturar números de agente/moneda dentro del mismo bloque.
            if re.search(r'\bAgente\b', window, re.I) and re.fullmatch(r'\d{5,7}', normalized_candidate or ''):
                continue
            if is_valid_policy_candidate(normalized_candidate):
                return normalized_candidate

    generic_policy_lines = re.finditer(
        r'(?im)^.*(?:P[oó]liza|Poliza|Datos de la P[oó]liza).*$',
        text
    )
    for match in generic_policy_lines:
        line = sanitize_text_value(match.group(0))
        if not line:
            continue
        # Ignorar líneas que hacen referencia a la póliza anterior
        if re.search(r'\bAnt\.?\b', line, re.I):
            continue
        alnum_match = re.search(candidate_pattern, line, re.I)
        if alnum_match:
            candidate = normalize_policy_candidate(alnum_match.group(1))
            if re.search(r'\bAgente\b', line, re.I) and re.fullmatch(r'\d{5,7}', candidate or ''):
                continue
            if is_valid_policy_candidate(candidate):
                return candidate

    structured_blocks = re.finditer(
        r'(?is)(P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza|No\.?\s*de\s*P[oó]liza|N[uú]mero\s+de\s+P[oó]liza|P[oó]liza\s+y/o\s+Certificado)(.{0,220})',
        text
    )
    for match in structured_blocks:
        window = sanitize_text_value(match.group(2))
        if not window:
            continue
        candidates = re.findall(candidate_pattern, window, re.I)
        for candidate in candidates:
            normalized_candidate = normalize_policy_candidate(candidate)
            if re.fullmatch(r'\d{4,7}', normalized_candidate or ''):
                continue
            if is_valid_policy_candidate(normalized_candidate) or re.fullmatch(r'\d{8,12}', normalized_candidate or ''):
                return normalized_candidate

    policy_table_match = re.search(
        r'P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza\s*\n([^\n]+)',
        text,
        re.I
    )
    if policy_table_match:
        row = sanitize_text_value(policy_table_match.group(1))
        if row:
            numeric_candidates = re.findall(r'\b(\d{8,12})\b', row)
            if numeric_candidates:
                return numeric_candidates[-1]

    return None


def extract_customer_name_value(text: str) -> str:
    multiline_patterns = [
        r'(?is)Datos del contratante\s*:\s*(?:[A-Z0-9]{10,13}\s*[-:]\s*)?([^\n]+(?:\n[^\n]+){0,2})',
        r'(?is)Datos del contratante.*?Contratante\s*:\s*([^\n]+(?:\n[^\n]+){0,2})',
        r'(?is)Datos del contratante.*?Nombre\s*[:|]?\s*([^\n]+(?:\n[^\n]+){0,2})',
        r'(?is)Datos del asegurado y/o propietario.*?Asegurado\s*:\s*([^\n]+(?:\n[^\n]+){0,2})',
        r'(?is)\bAsegurado\s*:\s*(?:\d{6,}\s+)?([^\n]+(?:\n[^\n]+){0,1})',
        r'(?is)\bPropietario/?\s*:\s*([^\n]+(?:\n[^\n]+){0,1})',
        r'(?is)Raz[oó]n social\s*[:|]?\s*([^\n]+(?:\n[^\n]+){0,1})',
        r'(?is)\bContratante\s*:\s*([^\n]+(?:\n[^\n]+){0,2})',
        r'(?is)\bAsegurado\s*:\s*([^\n]+(?:\n[^\n]+){0,2})',
    ]
    stop_pattern = re.compile(
        r'\b(?:R\.?F\.?C\.?|C\.?P\.?|Domicilio|Ciudad|Fecha|Moneda|Forma de pago|Paquete|Clave interna del agente|Inciso|Endoso|Tipo de endoso|Vigencia|Sucursal|Tel[eé]fono|No\.?\s*de\s*cliente|Propietario)\b',
        re.I
    )

    for pattern in multiline_patterns:
        match = re.search(pattern, text)
        if not match:
            continue

        block = match.group(1) or ""
        candidate_lines = [sanitize_text_value(line) for line in block.splitlines()]
        collected = []
        for line in candidate_lines:
            if not line:
                continue
            if stop_pattern.search(line):
                break
            collected.append(line)

        candidate = sanitize_name_candidate(" ".join(collected))
        if candidate:
            return candidate

    return None


def extract_policy_number_from_filename(filename: str) -> str:
    filename = sanitize_text_value(filename)
    if not filename:
        return None

    filename = re.sub(r'\.pdf$', '', filename, flags=re.I)
    match = re.search(r'\b([A-Z]{1,5}\d?)\s*[-_ ]?\s*(\d{5,10}[A-Z0-9/-]*)\b', filename, re.I)
    if match:
        prefix = match.group(1).upper()
        suffix = match.group(2).upper()
        if prefix[-1].isdigit():
            return f"{prefix} {suffix}"
        return f"{prefix}{suffix}"
    return None


def extract_agent_name_value(text: str) -> str:
    clave_interna_match = re.search(
        r'Clave\s+interna\s+del\s+agente\s*[:|]?\s*([A-Z0-9-]{4,20})',
        text,
        re.I
    )
    if clave_interna_match:
        return sanitize_text_value(clave_interna_match.group(1))

    table_agent_match = re.search(
        r'Forma\s+de\s+Pago\s+Agente\s+Moneda\s*\n\s*[A-ZÁÉÍÓÚÑ/.-]+\s+(\d{4,8})\s+M\.?N',
        text,
        re.I
    )
    if table_agent_match:
        return sanitize_text_value(table_agent_match.group(1))

    patterns = [
        r'(?im)^\s*Nombre\s+del\s+agente\s*[:|]\s*([^\n]+)$',
        r'(?im)^\s*Agente\s*[:|]\s*(?:\d{4,}\s+)?([^\n]+)$',
        r'(?im)^\s*AGENTE\s*[:|]\s*(?:\d{4,}\s+)?([^\n]+)$',
        r'(?is)(?:^|\n)\s*Agente\s*[:|]\s*\n+\s*(?:\d{4,}\s+)?([^\n]+?)(?:\n|$)',
        r'(?im)^\s*Agente\s*\|\s*(?:\d{4,}\s*\|\s*)?([^\n]+)$',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            value = match.group(1)
            value = re.split(r'CLAVE\s+DE\s+AGENTE', value, maxsplit=1, flags=re.I)[0]
            value = re.split(
                r'\b(?:Prima\s*Neta|PrimaNeta|Prima\s*Total|PrimaTotal|Tasa\s*de\s*Financiamiento|Financiamiento|Contrato|Orden\s*de\s*Trabajo|Gastos?\s*(?:por|de)\s*Expedici[oó]n|I\.?V\.?A\.?)\b',
                value,
                maxsplit=1,
                flags=re.I
            )[0]
            value = re.split(
                r'\b(?:No\.?\s*de\s*cliente|Datos\s*adicionales|Moneda|Forma\s*de\s*pago|Vigencia|P[oó]liza|Endoso)\b',
                value,
                maxsplit=1,
                flags=re.I
            )[0]
            value = re.split(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', value, maxsplit=1, flags=re.I)[0]
            value = re.split(r'\b(?:CEL|TEL[EÉ]FONO|TEL)\b', value, maxsplit=1, flags=re.I)[0]
            value = re.split(r'\b\d{7,}\b', value, maxsplit=1, flags=re.I)[0]
            value = re.sub(r'^\d{4,}\s+', '', value).strip()
            value = re.sub(r'\bOT\s*[:|-]?\s*\d+\b.*$', '', value, flags=re.I).strip()
            if re.search(r'\b(?:AVENIDA|COLONIA|ALCALD[IÍ]A|INSURGENTES|CIUDAD DE M[EÉ]XICO|C\.?P\.?|CARACTER[ÍI]STICAS\s+DEL\s+RIESGO)\b', value, re.I):
                continue
            cleaned = sanitize_name_candidate(value)
            if cleaned:
                return cleaned
    return None


def normalize_forma_pago_value(value: str) -> str:
    value = sanitize_text_value(value)
    if not value:
        return None

    normalized = normalize_ascii_upper(value)
    alias_map = {
        "CONTADO": "Contado",
        "UNICO": "Contado",
        "PAGOUNICO": "Contado",
        "ANUAL": "Anual",
        "MULTIANUAL": "Multianual",
        "SEMESTRAL": "Semestral",
        "TRIMESTRAL": "Trimestral",
        "MENSUAL": "Mensual",
        "QUINCENAL": "Quincenal",
        "FRACCIONADO": "Fraccionado",
    }

    for token, resolved in alias_map.items():
        if token in normalized:
            return resolved

    if "MASTERCARD" in normalized or "VISA" in normalized or "AMEX" in normalized:
        if "MENSUAL" in normalized:
            return "Mensual"
        if "TRIMESTRAL" in normalized:
            return "Trimestral"
        if "SEMESTRAL" in normalized:
            return "Semestral"
        if "ANUAL" in normalized:
            return "Anual"

    receipt_fraction_match = re.search(r'(\d{1,2})\s*/\s*(\d{1,2})', normalized)
    if receipt_fraction_match:
        total_payments = int(receipt_fraction_match.group(2))
        payment_map = {
            1: "Contado",
            2: "Semestral",
            4: "Trimestral",
            12: "Mensual",
        }
        if total_payments in payment_map:
            return payment_map[total_payments]

    return None


def extract_forma_pago_value(text: str) -> str:
    common_values = [
        r'ANUAL',
        r'MULTIANUAL',
        r'SEMESTRAL',
        r'TRIMESTRAL',
        r'MENSUAL',
        r'QUINCENAL',
        r'CONTADO',
        r'FRACCIONADO'
    ]

    explicit_value = extract_value_after_label(
        text,
        [
            r'Forma de pago',
            r'Frecuencia de pago',
            r'Periodicidad de pago',
            r'Periodicidad',
            r'Plan de pago',
            r'Conducto de cobro'
        ],
        stop_tokens=[r'\bPrima\b', r'\bRecibo\b', r'\bVigencia\b']
    )
    if explicit_value:
        normalized = normalize_forma_pago_value(explicit_value)
        if normalized:
            return normalized

    label_candidates = [
        r'Forma de pago',
        r'Frecuencia de pago',
        r'Periodicidad de pago',
        r'Periodicidad',
        r'Plan de pago',
        r'Conducto de cobro'
    ]
    stop_line_pattern = re.compile(
        r'^(?:Datos\s*adicionales|Coberturas|Contratante|Cliente|Vigencia|Prima|P[oó]liza|No\.?\s*de\s*cliente)\b',
        re.I
    )
    ignored_line_pattern = re.compile(
        r'^(?:Servicio|Tipo|Normal)\s*[:|-]',
        re.I
    )

    for label in label_candidates:
        flexible_label = build_flexible_label_pattern(label)
        pattern = rf'(?is){flexible_label}\s*[:|]?\s*(?:\n\s*)?((?:[^\n]*\n){{0,3}}[^\n]{{0,160}})'
        match = re.search(pattern, text, re.I)
        if not match:
            continue

        block = match.group(1) or ""
        block = re.sub(r'[ \t]+', ' ', block)
        candidate_lines = [sanitize_text_value(line) for line in block.splitlines()]
        for line in candidate_lines:
            if not line:
                continue
            if stop_line_pattern.search(line):
                break
            if ignored_line_pattern.search(line):
                continue
            for value in common_values:
                if re.search(rf'\b{value}\b', line, re.I):
                    return normalize_forma_pago_value(value)
            normalized_line = normalize_forma_pago_value(line)
            if normalized_line and normalized_line != line:
                return normalized_line

    for value in common_values:
        label_pattern = r'(?:Forma\s*de\s*pago|Frecuencia\s*de\s*pago|Periodicidad(?:\s*de\s*pago)?|Plan\s*de\s*pago|Conducto\s*de\s*cobro)'
        pattern = rf'(?is){label_pattern}.{{0,120}}?\b({value})\b'
        match = re.search(pattern, text, re.I)
        if match:
            return normalize_forma_pago_value(match.group(1))

    for value in common_values:
        pattern = rf'(?is)\b(?:Recibo|Pago|Fraccionado|Periodicidad).{{0,40}}?\b({value})\b'
        match = re.search(pattern, text, re.I)
        if match:
            return normalize_forma_pago_value(match.group(1))

    keyword_aliases = {
        r'\bPAGO ANUAL\b': 'Anual',
        r'\bRECIBO ANUAL\b': 'Anual',
        r'\bPAGO MENSUAL\b': 'Mensual',
        r'\bRECIBO MENSUAL\b': 'Mensual',
        r'\bPAGO TRIMESTRAL\b': 'Trimestral',
        r'\bRECIBO TRIMESTRAL\b': 'Trimestral',
        r'\bPAGO SEMESTRAL\b': 'Semestral',
        r'\bRECIBO SEMESTRAL\b': 'Semestral',
        r'\bCONTADO\b': 'Contado',
        r'\bPAGO FRACCIONADO\b': 'Fraccionado',
        r'\bPRIMA FRACCIONADA\b': 'Fraccionado',
        r'\bMENSUAL\s*-\s*(?:MASTERCARD|VISA|AMEX|TARJETA)\b': 'Mensual',
        r'\bTRIMESTRAL\s*-\s*(?:MASTERCARD|VISA|AMEX|TARJETA)\b': 'Trimestral',
        r'\bSEMESTRAL\s*-\s*(?:MASTERCARD|VISA|AMEX|TARJETA)\b': 'Semestral',
        r'\bANUAL\s*-\s*(?:MASTERCARD|VISA|AMEX|TARJETA)\b': 'Anual',
    }
    for pattern, normalized in keyword_aliases.items():
        if re.search(pattern, text, re.I):
            return normalized

    receipt_fraction_match = re.search(
        r'(?is)\b(?:recibo|pagos?|fracci(?:ó|o)?n|periodicidad)\b.{0,80}?(\d{1,2})\s*/\s*(\d{1,2})',
        text,
        re.I
    )
    if receipt_fraction_match:
        total_payments = int(receipt_fraction_match.group(2))
        payment_map = {
            1: "Contado",
            2: "Semestral",
            4: "Trimestral",
            12: "Mensual",
        }
        if total_payments in payment_map:
            return payment_map[total_payments]

    return None


def extract_diagnostic_snippet(text: str, patterns, radius: int = 180) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.I | re.M)
        if match:
            start = max(0, match.start() - radius)
            end = min(len(text), match.end() + radius)
            return text[start:end].strip()
    return None


def extract_value_after_label(text: str, labels, stop_tokens=None) -> str:
    stop_tokens = stop_tokens or []
    for label in labels:
        flexible_label = build_flexible_label_pattern(label)
        pattern = rf'{flexible_label}\s*[:|]?\s*([^\n]+)'
        match = re.search(pattern, text, re.I)
        if not match:
            continue
        value = match.group(1).strip(" :|-")
        for token in stop_tokens:
            value = re.split(token, value, maxsplit=1, flags=re.I)[0].strip()
        value = re.sub(r'\s{2,}', ' ', value).strip(" :|-")
        if value:
            return value
    return None


def clean_vehicle_attribute_value(value: str, field: str = None) -> str:
    value = sanitize_text_value(value)
    if not value:
        return None

    value = re.split(
        r'\b(?:Agente|Cliente|Contratante|Coberturas|Prima|Vigencia|Forma\s*de\s*pago|Datos\s*adicionales|No\.?\s*de\s*cliente|Servicio)\b',
        value,
        maxsplit=1,
        flags=re.I
    )[0].strip(" :|-")
    value = re.sub(r'\s{2,}', ' ', value).strip()

    suspicious_tokens = {
        "AGENTE",
        "CLIENTE",
        "CONTRATANTE",
        "COBERTURAS",
        "PRIMA",
        "VIGENCIA",
        "FORMADEPAGO",
        "DATOSADICIONALES",
        "SERVICIO",
        "PARTICULAR",
        "MASTERCARD",
        "VISA",
        "AMEX",
    }
    compact_value = normalize_ascii_upper(value)
    if any(token in compact_value for token in suspicious_tokens):
        return None

    token_count = len(value.split())
    if field in {"marca", "modelo"} and (len(value) > 40 or token_count > 5):
        return None
    if field == "placas" and (len(value) > 15 or token_count > 3):
        return None
    if field in {"motor", "numero_serie"} and len(value) > 30:
        return None

    return value or None


def extract_vehicle_value(text: str, labels) -> str:
    stop_tokens = [
        r'\bMarca\b',
        r'\bModelo\b',
        r'\bMotor\b',
        r'\bNo\.?\s*de\s*motor\b',
        r'\bN[uú]mero\s*de\s*motor\b',
        r'\bPlacas\b',
        r'\bSerie\b',
        r'\bVIN\b',
        r'\bNo\.?\s*de\s*serie\b',
        r'\bN[uú]mero\s*de\s*serie\b',
        r'\bColor\b',
        r'\bUso\b',
        r'\bServicio\b',
        r'\bVigencia\b',
        r'\bPrima\b',
    ]
    value = extract_value_after_label(text, labels, stop_tokens=stop_tokens)
    primary_label = labels[0] if labels else ""
    field_map = {
        r'\bMarca\b': 'marca',
        r'\bModelo\b': 'modelo',
        r'\bMotor\b': 'motor',
        r'No\.?\s*de\s*motor': 'motor',
        r'N[uú]mero\s*de\s*motor': 'motor',
        r'\bPlacas\b': 'placas',
        r'No\.?\s*de\s*placas': 'placas',
        r'VIN': 'numero_serie',
        r'No\.?\s*de\s*serie': 'numero_serie',
        r'N[uú]mero\s*de\s*serie': 'numero_serie',
        r'\bSerie\b': 'numero_serie',
    }
    return clean_vehicle_attribute_value(value, field_map.get(primary_label))


def score_policy_ramo_candidates(text: str) -> dict:
    header_text = text[:8000]
    body_text = text

    # Priorizamos el contexto principal del documento y evitamos falsos positivos
    # por coberturas aisladas como "Gastos Medicos Ocupantes" en autos.
    ramo_patterns = {
        "Automóvil": {
            "header": [
                (r'\bAUTOM[ÓO]VIL\b', 6),
                (r'\bAUTOS?\b', 4),
                (r'P[ÓO]LIZA\s+DE\s+AUTO', 6),
                (r'COBERTURAS\s*AMPARADAS', 4),
                (r'DA[ÑN]OS\s*MATERIALES', 6),
                (r'ROBO\s+TOTAL', 6),
                (r'RESPONSABILIDAD\s+CIVIL', 5),
                (r'DEFENSA\s+LEGAL', 4),
                (r'CONDUCTORES', 4),
                (r'N[OÚU]\.?\s*DE\s*SERIE', 4),
                (r'\bVIN\b', 4),
                (r'\bMARCA\b', 3),
                (r'\bMODELO\b', 3),
                (r'GASTOS\s*M[EÉ]DICOS\s+OCUPANTES', 6),
            ],
            "body": [
                (r'COBERTURAS\s*AMPARADAS', 2),
                (r'DA[ÑN]OS\s*MATERIALES', 3),
                (r'ROBO\s+TOTAL', 3),
                (r'RESPONSABILIDAD\s+CIVIL', 2),
                (r'DEFENSA\s+LEGAL', 2),
                (r'CONDUCTORES', 2),
                (r'GASTOS\s*M[EÉ]DICOS\s+OCUPANTES', 4),
            ],
        },
        "Gastos Médicos": {
            "header": [
                (r'GASTOS\s*M[EÉ]DICOS\s+MAYORES', 7),
                (r'CAR[ÁA]TULA\s+DE\s+P[ÓO]LIZA', 5),
                (r'ASEGURADO\s+TITULAR', 5),
                (r'TABULADOR\s+M[ÉE]DICO', 5),
                (r'GAMA\s+HOSPITALARIA', 5),
                (r'RED\s+HOSPITALARIA', 4),
                (r'TIPO\s+DE\s+PLAN', 4),
                (r'COASEGURO', 3),
                (r'DEDUCIBLE', 3),
            ],
            "body": [
                (r'GASTOS\s*M[EÉ]DICOS\s+MAYORES', 4),
                (r'ASEGURADO\s+TITULAR', 3),
                (r'TABULADOR\s+M[ÉE]DICO', 3),
                (r'GAMA\s+HOSPITALARIA', 3),
                (r'RED\s+HOSPITALARIA', 2),
                (r'TIPO\s+DE\s+PLAN', 2),
                (r'COASEGURO', 1),
                (r'DEDUCIBLE', 1),
            ],
        },
        "Transporte de carga": {
            "header": [
                (r'TRANSPORTE\s+DE\s+CARGA', 8),
                (r'SEGURO\s+TRANSPORTE\s+DE\s+CARGA', 8),
                (r'P[ÓO]LIZA\s+DE\s+SEGURO\s+TRANSPORTE', 7),
                (r'PAQUETE\s*:\s*INTEGRAL\s+TERRESTRE', 7),
                (r'TIPO\s+DE\s+MERCANC[ÍI]A', 6),
                (r'CARACTER[ÍI]STICAS\s+DEL\s+RIESGO', 6),
                (r'MEDIO\s+DE\s+TRANSPORTE', 6),
                (r'VALOR\s+TOTAL\s+DEL\s+EMBARQUE', 6),
                (r'MANIOBRAS\s+DE\s+CARGA\s+Y\s+DESCARGA', 5),
            ],
            "body": [
                (r'TRANSPORTE\s+DE\s+CARGA', 4),
                (r'TIPO\s+DE\s+MERCANC[ÍI]A', 3),
                (r'CARACTER[ÍI]STICAS\s+DEL\s+RIESGO', 3),
                (r'MEDIO\s+DE\s+TRANSPORTE', 3),
                (r'VALOR\s+TOTAL\s+DEL\s+EMBARQUE', 3),
                (r'MANIOBRAS\s+DE\s+CARGA\s+Y\s+DESCARGA', 2),
            ],
        },
        "Casa Habitación": {
            "header": [
                (r'CASA\s*HABITACI[ÓO]N', 8),
                (r'SEGURO\s+DE\s+HOGAR', 8),
                (r'P[ÓO]LIZA\s+DE\s+HOGAR', 7),
                (r'\bHOGAR\b', 6),
                (r'CONTENIDOS\s+DEL\s+HOGAR', 6),
                (r'INMUEBLE', 5),
                (r'INCENDIO\s+Y\s+RAYO', 5),
                (r'ROBO\s+CON\s+VIOLENCIA', 4),
                (r'RESPONSABILIDAD\s+CIVIL\s+FAMILIAR', 4),
            ],
            "body": [
                (r'CASA\s*HABITACI[ÓO]N', 4),
                (r'\bHOGAR\b', 3),
                (r'CONTENIDOS\s+DEL\s+HOGAR', 3),
                (r'INMUEBLE', 2),
                (r'INCENDIO\s+Y\s+RAYO', 2),
                (r'ROBO\s+CON\s+VIOLENCIA', 2),
            ],
        },
    }

    scores = {}
    for ramo, pattern_groups in ramo_patterns.items():
        score = 0
        for pattern, weight in pattern_groups.get("header", []):
            if re.search(pattern, header_text, re.I):
                score += weight
        for pattern, weight in pattern_groups.get("body", []):
            if re.search(pattern, body_text, re.I):
                score += weight
        scores[ramo] = score

    return scores


def detect_policy_ramo(text: str) -> str:
    explicit_ramo = extract_value_after_label(
        text,
        [r'\bRamo\b', r'Tipo de seguro', r'Producto'],
        stop_tokens=[r'\bSubramo\b', r'\bPlan\b']
    )
    if explicit_ramo:
        normalized_explicit = normalize_ascii_upper(explicit_ramo)
        if "AUTOMOVIL" in normalized_explicit or normalized_explicit == "AUTO":
            return "Automóvil"
        if "GASTOSMEDICOS" in normalized_explicit:
            return "Gastos Médicos"
        if "TRANSPORTE" in normalized_explicit and "CARGA" in normalized_explicit:
            return "Transporte de carga"
        if "CASAHABITACION" in normalized_explicit or "HOGAR" in normalized_explicit:
            return "Casa Habitación"

    scores = score_policy_ramo_candidates(text)
    best_ramo = max(scores, key=scores.get)
    best_score = scores.get(best_ramo, 0)
    second_score = max([score for ramo, score in scores.items() if ramo != best_ramo] or [0])

    if best_score >= 6 and best_score >= (second_score + 3):
        return best_ramo
    return None


def build_field_snippets(text: str) -> dict:
    field_patterns = {
        "numero_de_poliza": [r'P[oó]liza\s*No\.?\s*/\s*A[nñ]o\s*P[oó]liza', r'No\.?\s*de\s*P[oó]liza', r'N[uú]mero\s+de\s+P[oó]liza', r'P[oó]liza\s+y/o\s+Certificado', r'P[oó]liza', r'Solicitud'],
        "nombre_cliente": [r'Datos del contratante', r'Asegurado Titular', r'Nombre'],
        "rfc": [r'R\.?F\.?C\.?'],
        "agente": [r'^\s*Agente\s*[:|]', r'^\s*AGENTE\s*[:|]', r'^\s*Agente\s*\|'],
        "desde": [r'Fecha de inicio de vigencia', r'Vigencia\s*a\s*las\s*12', r'Vigencia\s*desde', r'Vigencia\s*del'],
        "hasta": [r'Fecha de fin de vigencia', r'Vigencia\s*hasta', r'\bal:\s*\d{1,2}[/-]'],
        "forma_de_pago": [
            r'Frecuencia\s*de\s*pago',
            r'Forma\s*de\s*pago',
            r'Periodicidad',
            r'Conducto\s*de\s*cobro',
            r'Tipo\s*de\s*pago',
            r'Mensual\s*-\s*(?:MasterCard|Visa)',
            r'Pago\s+(?:anual|mensual|trimestral|semestral)'
        ],
        "subramo": [r'Tipo de plan', r'Gastos M[ée]dicos Mayores'],
        "marca": [r'\bMarca\b'],
        "modelo": [r'\bModelo\b'],
        "motor": [r'\bMotor\b', r'No\.?\s*de\s*motor'],
        "placas": [r'\bPlacas\b'],
        "numero_serie": [r'VIN', r'No\.?\s*de\s*serie', r'N[uú]mero\s*de\s*serie', r'\bSerie\b'],
        "prima_neta": [r'Prima Neta', r'Prima anual', r'Prima del movimiento'],
        "prima_total": [r'Prima anual total', r'Prima Total', r'Prima del movimiento', r'Total del movimiento', r'Importe a pagar'],
        "derecho_poliza": POLICY_FEE_LABELS,
    }
    snippets = {}
    for field, patterns in field_patterns.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.I | re.M)
            if match:
                start = max(0, match.start() - 80)
                end = min(len(text), match.end() + 220)
                snippets[field] = text[start:end].strip()
                break
    return snippets


def build_rule_based_hints(text: str) -> dict:
    """Extrae campos de alta confianza sin depender del modelo."""
    hints = {key: None for key in JSON_SCHEMA.keys()}

    insurer_map = {
        "AXA": "AXA",
        "GNP": "GNP",
        "QUALITAS": "Quálitas",
        "QUÁLITAS": "Quálitas",
        "MAPFRE": "Mapfre",
        "HDI": "HDI",
        "METLIFE": "MetLife",
        "CHUBB": "Chubb"
    }
    upper_text = text.upper()
    for token, insurer in insurer_map.items():
        if token in upper_text:
            hints["aseguradora"] = insurer
            break

    hints["numero_de_poliza"] = extract_policy_number_value(text)
    hints["forma_de_pago"] = extract_forma_pago_value(text)
    hints["descripcion"] = extract_value_after_label(
        text, [r'Tipo de plan'], stop_tokens=[r'\bSolicitud\b']
    )
    hints["subramo"] = hints["descripcion"]
    hints["ramo"] = detect_policy_ramo(text)

    ramo_match = re.search(
        r'(Gastos M[ée]dicos(?: Mayores)?(?: Individual / Familiar)?)', text, re.I)
    if ramo_match and not hints["ramo"]:
        ramo = sanitize_text_value(ramo_match.group(1))
        hints["ramo"] = "Gastos Médicos"
        if not hints["subramo"]:
            hints["subramo"] = ramo

    if hints["ramo"] == "Automóvil" and not hints["subramo"]:
        header = text[:3000].upper()
        if re.search(r'\bFLOT(?:ILLA|A)\b', header):
            hints["subramo"] = "FLOTILLA"
        else:
            hints["subramo"] = "AUTO/IND"
    elif hints["ramo"] == "Transporte de carga" and not hints["subramo"]:
        transport_header = text[:4000].upper()
        if re.search(r'INTEGRAL\s+TERRESTRE|MEDIO\s+DE\s+TRANSPORTE\s*:\s*TERRESTRE', transport_header):
            hints["subramo"] = "Transporte terrestre de carga"
        elif re.search(r'MAR[IÍ]TIMO', transport_header):
            hints["subramo"] = "Transporte marítimo de carga"
        elif re.search(r'A[ÉE]REO', transport_header):
            hints["subramo"] = "Transporte aéreo de carga"

    hints["desde"], hints["hasta"] = extract_vigencia_values(text)

    hints["rfc"] = normalize_rfc_value(extract_value_after_label(
        text, [r'R\.?F\.?C\.?'], stop_tokens=[r'Tel[eé]fono']
    ))
    hints["nombre_cliente"] = extract_customer_name_value(text)

    contratante_match = re.search(
        r'Datos del contratante.*?Nombre\s*[:|]?\s*([^\n]+)', text, re.I | re.S)
    if contratante_match and not hints["nombre_cliente"]:
        nombre_cliente, policy_from_name = split_name_and_policy_suffix(
            contratante_match.group(1))
        hints["nombre_cliente"] = nombre_cliente
        if not hints["numero_de_poliza"] and policy_from_name:
            hints["numero_de_poliza"] = policy_from_name
            log_policy_event(
                "rule_hints",
                "número de póliza inferido desde el nombre del cliente",
                nombre_cliente=nombre_cliente,
                numero_de_poliza=policy_from_name
            )
    else:
        titular_match = re.search(
            r'Datos del Asegurado Titular.*?Nombre\s*[:|]?\s*([^\n]+)', text, re.I | re.S)
        if titular_match and not hints["nombre_cliente"]:
            nombre_cliente, policy_from_name = split_name_and_policy_suffix(
                titular_match.group(1))
            hints["nombre_cliente"] = nombre_cliente
            if not hints["numero_de_poliza"] and policy_from_name:
                hints["numero_de_poliza"] = policy_from_name
                log_policy_event(
                    "rule_hints",
                    "número de póliza inferido desde el nombre del titular",
                    nombre_cliente=nombre_cliente,
                    numero_de_poliza=policy_from_name
                )

    hints["agente"] = extract_agent_name_value(text)

    if hints.get("ramo") == "Automóvil":
        hints["marca"] = extract_vehicle_value(text, [r'\bMarca\b'])
        hints["modelo"] = extract_vehicle_value(text, [r'\bModelo\b'])
        hints["motor"] = extract_vehicle_value(
            text, [r'\bMotor\b', r'No\.?\s*de\s*motor', r'N[uú]mero\s*de\s*motor']
        )
        hints["placas"] = extract_vehicle_value(text, [r'\bPlacas\b', r'No\.?\s*de\s*placas'])
        hints["numero_serie"] = extract_vehicle_value(
            text, [r'VIN', r'No\.?\s*de\s*serie', r'N[uú]mero\s*de\s*serie', r'\bSerie\b']
        )

    if ' M.N.' in text or ' PESOS ' in f' {upper_text} ':
        hints["moneda"] = "MXN"

    structured_premium_values = extract_structured_premium_values(text)
    hints["derecho_poliza"] = structured_premium_values.get("derecho_poliza") or extract_money_amount_near_label(
        text, POLICY_FEE_LABELS
    )
    hints["prima_neta"] = extract_prima_neta_value(
        text,
        prima_total=hints.get("prima_total"),
        derecho_poliza=hints["derecho_poliza"]
    )
    hints["prima_total"] = extract_prima_total_value(
        text,
        prima_neta=hints["prima_neta"],
        derecho_poliza=hints["derecho_poliza"]
    )
    hints["gastos_expedicion"] = hints["derecho_poliza"]
    hints = sanitize_premium_fields(text, hints)

    normalized_hints = {key: sanitize_text_value(
        value) for key, value in hints.items()}
    return normalized_hints


def get_available_ollama_models(ollama_url: str) -> list:
    try:
        response = requests.get(ollama_url.replace(
            '/generate', '/tags'))
        response.raise_for_status()
        data = response.json()
        models = [model.get("name") for model in data.get(
            "models", []) if model.get("name")]
        log_policy_event(
            "ollama_models", "modelos detectados en Ollama", models=models)
        return models
    except Exception as exc:
        log_policy_event(
            "ollama_models", "no se pudieron listar modelos instalados", error=str(exc))
        return []


def choose_local_policy_models(available_models: list) -> list:
    preferred = os.getenv("OLLAMA_POLICY_MODELS")
    if preferred:
        candidates = [model.strip()
                      for model in preferred.split(',') if model.strip()]
    else:
        candidates = list(LOCAL_POLICY_MODEL_CANDIDATES)

    if available_models:
        selected = [model for model in candidates if model in available_models]
        if not selected and available_models:
            selected = available_models[:2]
    else:
        selected = candidates[:2]

    chosen = selected[:2] if selected else ["llama3.1:8b"]
    log_policy_event(
        "ollama_models",
        "candidatos elegidos para extracción",
        available=available_models,
        chosen=chosen
    )
    return chosen


def build_policy_extraction_prompt(text_content: str, hints: dict, snippets: dict) -> str:
    hints_json = json.dumps(
        {k: v for k, v in hints.items() if v}, ensure_ascii=False, indent=2)
    snippets_json = json.dumps(snippets, ensure_ascii=False, indent=2)
    prompt_text = text_content[:18000]
    return f"""Analiza el siguiente texto de una póliza de seguro mexicana y extrae los datos.

TEXTO NORMALIZADO DEL PDF:
{prompt_text}

PISTAS DETERMINÍSTICAS EXTRAÍDAS POR REGLAS:
{hints_json}

FRAGMENTOS MÁS RELEVANTES POR CAMPO:
{snippets_json}

Usa SOLO la información del texto anterior. Las pistas sirven para resolver tablas y columnas, pero no inventes datos. Responde ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown. Todos los valores deben ser strings o null.

Prioridades:
- Cuando haya una tabla de primas, usa la etiqueta exacta de cada importe. No confundas "Prima Neta" con "Prima anual total".
- Si aparece "Solicitud", no la uses como número de póliza.
- Si aparece "Tipo de plan", normalmente corresponde a la descripción comercial o subramo.
- Para "nombre_cliente", prioriza "Datos del contratante"; si no existe, usa el "Asegurado Titular".
- Para "forma_de_pago", prioriza "Frecuencia de pago" o "Forma de pago".
- Para "ramo", usa el tipo principal de póliza, no una cobertura aislada. Si aparece "Gastos Médicos Ocupantes" junto con "Daños Materiales", "Robo Total" o "Responsabilidad Civil", el ramo es "Automóvil".

Devuelve este JSON:
{{
  "numero_de_poliza": null,
  "nombre_cliente": null,
  "rfc": null,
  "aseguradora": null,
  "agente": null,
  "ramo": null,
  "subramo": null,
  "desde": null,
  "hasta": null,
  "forma_de_pago": null,
  "prima_neta": null,
  "prima_total": null,
  "moneda": null,
  "endoso": null,
  "marca": null,
  "modelo": null,
  "motor": null,
  "placas": null,
  "numero_serie": null,
  "derecho_poliza": null,
  "gastos_expedicion": null,
  "descripcion": null
}}"""


def build_policy_reconciliation_prompt(text_content: str, hints: dict, model_output: dict) -> str:
    prompt_text = text_content[:10000]
    return f"""Corrige y valida la extracción de una póliza mexicana. Responde SOLO con JSON válido.

TEXTO NORMALIZADO:
{prompt_text}

PISTAS DE ALTA CONFIANZA:
{json.dumps({k: v for k, v in hints.items() if v}, ensure_ascii=False, indent=2)}

EXTRACCIÓN PREVIA:
{json.dumps(model_output, ensure_ascii=False, indent=2)}

Reglas:
- Conserva los campos correctos de la extracción previa.
- Si una pista de alta confianza contradice un campo ambiguo, corrígelo.
- No inventes valores.
- Todos los valores deben ser strings o null.
- "prima_total" debe corresponder al total anual o total a pagar, no a deducible, suma asegurada, IVA ni recargo.
- "derecho_poliza" debe ser el cargo de derecho o expedición, no otro importe.
- "ramo" debe corresponder al producto principal de la póliza, no a una cobertura secundaria.
"""


def query_ollama_json(model: str, prompt: str) -> dict:
    ollama_url = "http://localhost:11434/api/generate"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "model": model,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "temperature": 0,
        "seed": 42,
        "num_predict": 1200
    }
    log_policy_event(
        "ollama_request",
        "enviando prompt a Ollama",
        model=model,
        prompt_chars=len(prompt)
    )
    response = requests.post(ollama_url, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    if "response" not in data:
        raise ValueError("Respuesta inesperada de Ollama")
    parsed = extract_json_object(data["response"])
    parsed = flatten_ollama_response(parsed)
    return parsed


def count_populated_fields(data: dict, fields) -> int:
    return sum(1 for field in fields if sanitize_text_value(data.get(field)))


def merge_extraction_results(rule_hints: dict, model_result: dict) -> dict:
    merged = {}
    model_result = model_result or {}
    rule_hints = rule_hints or {}
    merge_sources = {}

    trusted_rule_fields = {
        "numero_de_poliza",
        "nombre_cliente",
        "rfc",
        "aseguradora",
        "agente",
        "ramo",
        "desde",
        "hasta",
        "forma_de_pago",
        "prima_neta",
        "prima_total",
        "moneda",
        "derecho_poliza",
        "gastos_expedicion",
        "descripcion"
    }

    for key in JSON_SCHEMA.keys():
        model_value = sanitize_text_value(model_result.get(key))
        rule_value = sanitize_text_value(rule_hints.get(key))

        if key == "forma_de_pago":
            model_value = normalize_forma_pago_value(model_value)
            rule_value = normalize_forma_pago_value(rule_value)

        merged[key] = model_value

        if key in ("prima_neta", "prima_total", "derecho_poliza", "gastos_expedicion"):
            model_value = normalize_amount_value(model_value)
            rule_value = normalize_amount_value(rule_value)
            merged[key] = rule_value or model_value
        elif key in trusted_rule_fields:
            merged[key] = rule_value or model_value
        else:
            merged[key] = model_value or rule_value

        if sanitize_text_value(merged.get(key)):
            if sanitize_text_value(rule_value) and sanitize_text_value(merged.get(key)) == sanitize_text_value(rule_value):
                merge_sources[key] = "rules"
            elif sanitize_text_value(model_value) and sanitize_text_value(merged.get(key)) == sanitize_text_value(model_value):
                merge_sources[key] = "model"
            else:
                merge_sources[key] = "derived"

    return merged


def find_existing_cliente(nombre_completo: str, rfc: str = None):
    """Busca un cliente existente. Retorna el ID o None."""
    if not nombre_completo or not nombre_completo.strip():
        return None

    normalized_rfc = normalize_rfc_value(rfc)
    if normalized_rfc:
        cliente = Cliente.query.filter_by(rfc=normalized_rfc).first()
        if cliente:
            log_policy_event(
                "entity_lookup",
                "cliente encontrado por RFC",
                cliente_id=cliente.id,
                nombre=f"{cliente.nombre} {cliente.apellido}".strip()
            )
            return cliente.id

    clientes = Cliente.query.all()

    class _ClienteProxy:
        def __init__(self, c):
            self.id = c.id
            self.nombre = f"{c.nombre} {c.apellido}".strip()
    proxies = [_ClienteProxy(c) for c in clientes]
    cliente_id = find_best_match(nombre_completo, proxies)
    if not cliente_id:
        cliente_id = find_agent_match_by_tokens(nombre_completo, proxies)
    if cliente_id:
        log_policy_event(
            "entity_lookup",
            "cliente encontrado por nombre",
            cliente_id=cliente_id,
            nombre=nombre_completo
        )
        return cliente_id

    log_policy_event(
        "entity_lookup",
        "cliente no encontrado",
        nombre=nombre_completo,
        rfc=rfc
    )
    return None


def find_existing_aseguradora(nombre: str):
    """Busca una aseguradora existente. Retorna el ID o None."""
    if not nombre or not nombre.strip():
        return None

    aseguradoras = Aseguradora.query.all()
    aseguradora_id = find_best_match(nombre, aseguradoras)
    log_policy_event(
        "entity_lookup",
        "resultado búsqueda aseguradora",
        nombre=nombre,
        aseguradora_id=aseguradora_id
    )
    return aseguradora_id


def find_existing_agente(nombre: str):
    """Busca un agente existente. Retorna el ID o None."""
    if not nombre or not nombre.strip():
        return None

    agentes = Agente.query.all()
    agente_id = find_best_match(nombre, agentes)
    if not agente_id:
        agente_id = find_agent_match_by_tokens(nombre, agentes)
    log_policy_event(
        "entity_lookup",
        "resultado búsqueda agente",
        nombre=nombre,
        agente_id=agente_id
    )
    return agente_id


def find_existing_vendedor(nombre: str):
    """Busca un vendedor existente. Retorna el ID o None."""
    if not nombre or not nombre.strip():
        return None

    vendedores = Vendedor.query.all()
    vendedor_id = find_best_match(nombre, vendedores)
    log_policy_event(
        "entity_lookup",
        "resultado búsqueda vendedor",
        nombre=nombre,
        vendedor_id=vendedor_id
    )
    return vendedor_id


def find_existing_ramo(nombre: str):
    """Busca un ramo existente. Retorna el ID o None."""
    if not nombre or not nombre.strip():
        return None

    ramos = Ramo.query.all()
    ramo_id = find_best_match(nombre, ramos, attr_name='ramo')
    log_policy_event(
        "entity_lookup",
        "resultado búsqueda ramo",
        nombre=nombre,
        ramo_id=ramo_id
    )
    return ramo_id


def find_existing_subramo(nombre: str):
    """Busca un subramo existente. Retorna el ID o None."""
    if not nombre or not nombre.strip():
        return None

    subramos = Subramo.query.all()
    subramo_id = find_best_match(nombre, subramos, attr_name='subramo')

    normalized_name = normalize_ascii_upper(nombre)
    fallback_aliases = []
    if normalized_name in {"AUTOIND", "AUTOINDIVIDUAL", "AUTOFAMILIAR"}:
        fallback_aliases = ["AUTO IND", "AUTO/IND", "FAMILIAR"]
    elif normalized_name == "TRANSPORTEDECARGA":
        fallback_aliases = ["Transporte terrestre de carga"]

    if subramo_id is None:
        for alias in fallback_aliases:
            subramo_id = find_best_match(alias, subramos, attr_name='subramo')
            if subramo_id is not None:
                break

    log_policy_event(
        "entity_lookup",
        "resultado búsqueda subramo",
        nombre=nombre,
        subramo_id=subramo_id
    )
    return subramo_id


def find_existing_tipo_pago(nombre: str):
    """Busca una forma de pago existente. Retorna el ID o None."""
    normalized_name = normalize_forma_pago_value(nombre)
    if not normalized_name:
        return None

    tipo_pagos = TipoPago.query.all()
    tipo_pago_id = find_best_match(
        normalized_name, tipo_pagos, attr_name='tipo_pago')

    if tipo_pago_id is None and normalized_name == "Anual":
        tipo_pago_id = find_best_match(
            "Multianual", tipo_pagos, attr_name='tipo_pago')

    log_policy_event(
        "forma_pago_resolution",
        "resultado búsqueda tipo de pago",
        forma_pago_extraida=nombre,
        forma_pago_normalizada=normalized_name,
        tipo_pago_id=tipo_pago_id
    )
    return tipo_pago_id


def find_best_match(extracted_name: str, db_records, threshold=85, attr_name=None):
    """
    Busca el mejor match: exacto → contains → fuzzy.
    Retorna el ID del registro o None si no hay match suficientemente bueno.
    """
    if not extracted_name or not db_records:
        return None

    from difflib import SequenceMatcher

    extracted_clean = extracted_name.lower().strip()
    best_match = None
    best_ratio = 0

    for record in db_records:
        record_name = getattr(record, attr_name, None) if attr_name else (
            getattr(record, 'nombre', None) or getattr(
                record, 'aseguradora', None)
        )
        if not record_name:
            continue

        record_clean = record_name.lower().strip()

        if extracted_clean == record_clean:
            return record.id

        if extracted_clean in record_clean or record_clean in extracted_clean:
            ratio = 95
        else:
            ratio = SequenceMatcher(
                None, extracted_clean, record_clean).ratio() * 100

        if ratio > best_ratio and ratio >= threshold:
            best_ratio = ratio
            best_match = record.id

    return best_match


def flatten_ollama_response(raw: dict) -> dict:
    """
    Normaliza cualquier estructura que devuelva Ollama a un dict plano con las claves esperadas.
    Estrategia: primero sube raíces únicas, luego aplana sub-objetos conocidos,
    luego mapea alias de claves comunes.
    """
    # 1. Si hay una sola llave raíz con un dict adentro, subir un nivel
    while len(raw) == 1:
        val = next(iter(raw.values()))
        if isinstance(val, dict):
            raw = val
        else:
            break

    flat = dict(raw)

    # 2. Rescatar fechas de sub-objetos antes del aplanado genérico
    # Caso: {"desde": {"fecha": "24/03/2026", ...}, "hasta": {"fecha": "24/03/2027", ...}}
    for date_key in ("desde", "hasta"):
        val = flat.get(date_key)
        if isinstance(val, dict):
            flat[date_key] = val.get("fecha") or val.get(
                "date") or val.get("value") or None

    # 4. Aplanar sub-objetos: buscar dicts anidados y extraer sus valores al nivel raíz
    for key, val in list(flat.items()):
        if isinstance(val, dict):
            for subkey, subval in val.items():
                flat.setdefault(subkey, subval)
            flat.pop(key)
        elif isinstance(val, list) and val and isinstance(val[0], dict):
            # Tomar el primer elemento de listas de objetos
            for subkey, subval in val[0].items():
                flat.setdefault(subkey, subval)
            flat.pop(key)

    # 5. Tabla de alias: clave_alternativa -> clave_esperada
    ALIASES = {
        "identificador": "numero_de_poliza",
        "numero_poliza": "numero_de_poliza",
        "poliza": "numero_de_poliza",
        "no_poliza": "numero_de_poliza",
        "policy": "numero_de_poliza",
        "contratante": "nombre_cliente",
        "asegurado": "nombre_cliente",
        "titular": "nombre_cliente",
        "cliente": "nombre_cliente",
        "fecha_inicio_vigencia": "desde",
        "fecha_inicio": "desde",
        "vigencia_desde": "desde",
        "vigencia_de": "desde",
        "inicio_vigencia": "desde",
        "fecha_fin_vigencia": "hasta",
        "fecha_fin": "hasta",
        "vigencia_hasta": "hasta",
        "vigencia_a": "hasta",
        "fin_vigencia": "hasta",
        "frecuencia_pago": "forma_de_pago",
        "frecuencia_de_pago": "forma_de_pago",
        "plan_pago": "forma_de_pago",
        "tipo_de_plan": "subramo",
        "plan": "subramo",
        "cobertura": "subramo",
        "tipo_seguro": "ramo",
        "producto": "ramo",
        "num_serie": "numero_serie",
        "vin": "numero_serie",
        "no_serie": "numero_serie",
        "serie": "numero_serie",
        "placa": "placas",
        "placas": "placas",
        "motor": "motor",
        "prima": "prima_neta",
        "neta": "prima_neta",
        "prima_anual": "prima_neta",
        "importe": "prima_neta",
        "total": "prima_total",
        "importe_total": "prima_total",
        "prima_anual_total": "prima_total",
        "r_f_c": "rfc",
        "derecho": "derecho_poliza",
        "gastos_expedicion": "derecho_poliza",
    }

    for alias, target in ALIASES.items():
        if alias in flat and target not in flat:
            flat[target] = flat.pop(alias)
        elif alias in flat:
            flat.pop(alias)

    if flat.get("rfc"):
        flat["rfc"] = normalize_rfc_value(flat.get("rfc"))

    # 4. Normalizar fechas a DD/MM/YYYY
    DATE_FIELDS = ("desde", "hasta")
    for field in DATE_FIELDS:
        val = flat.get(field)
        if not val:
            continue
        val = sanitize_text_value(val)
        # ISO format: 2026-03-24 o 2026-03-24T00:00:00Z
        iso_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', str(val))
        if iso_match:
            flat[field] = f"{iso_match.group(3)}/{iso_match.group(2)}/{iso_match.group(1)}"
            continue

        normalized_date = normalize_extracted_date(val)
        if normalized_date:
            flat[field] = normalized_date

    # 5. Limpiar montos: quitar símbolos de moneda y comas
    AMOUNT_FIELDS = ("prima_neta", "prima_total",
                     "derecho_poliza", "gastos_expedicion")
    for field in AMOUNT_FIELDS:
        val = flat.get(field)
        if val and isinstance(val, str):
            flat[field] = re.sub(r'[^\d.]', '', val) or None

    return flat


def call_ollama_model(text_content: str, schema: dict) -> dict:
    ollama_url = "http://localhost:11434/api/generate"
    cleaned_text = clean_extracted_text(text_content)
    extraction_id = uuid.uuid4().hex[:8]
    log_policy_event(
        "pipeline_start",
        "iniciando extracción híbrida",
        extraction_id=extraction_id,
        raw_chars=len(text_content or ""),
        cleaned_chars=len(cleaned_text)
    )
    rule_hints = build_rule_based_hints(cleaned_text)
    field_snippets = build_field_snippets(cleaned_text)
    extraction_prompt = build_policy_extraction_prompt(
        cleaned_text, rule_hints, field_snippets)
    model_candidates = choose_local_policy_models(
        get_available_ollama_models(ollama_url))

    pdf_text_snippets = {
        "numero_de_poliza": field_snippets.get("numero_de_poliza") or extract_diagnostic_snippet(
            cleaned_text,
            [r'P[oó]liza', r'No\.?\s*de\s*P[oó]liza', r'N[uú]mero\s+de\s+P[oó]liza', r'P[oó]liza\s+y/o\s+Certificado']
        ),
        "nombre_cliente": field_snippets.get("nombre_cliente") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Datos\s+del\s+contratante', r'Asegurado\s+Titular', r'Contratante', r'Nombre']
        ),
        "agente": field_snippets.get("agente"),
        "desde": field_snippets.get("desde") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Fecha\s*de\s*inicio\s*de\s*vigencia', r'Vigencia\s*a\s*las\s*12', r'Vigencia\s*desde', r'Vigencia\s*del']
        ),
        "hasta": field_snippets.get("hasta") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Fecha\s*de\s*fin\s*de\s*vigencia', r'Vigencia\s*hasta', r'\bal:\s*\d{1,2}[/-]']
        ),
        "forma_de_pago": field_snippets.get("forma_de_pago") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Forma\s*de\s*pago', r'Formadepago', r'Frecuencia\s*de\s*pago', r'Periodicidad', r'Mensual', r'Trimestral', r'Semestral', r'Contado', r'MasterCard', r'Visa']
        ),
        "prima_neta": field_snippets.get("prima_neta") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Prima Neta', r'PRIMANETA', r'Prima anual', r'Prima del movimiento', r'Prima', r'Importe']
        ),
        "prima_total": field_snippets.get("prima_total") or extract_diagnostic_snippet(
            cleaned_text,
            [r'Prima total', r'PRIMATOTAL', r'Prima anual total', r'Total del movimiento', r'Importe a pagar', r'Prima', r'Importe']
        ),
    }
    log_policy_event(
        "pdf_text_summary",
        "resumen del texto extraído por Python",
        extraction_id=extraction_id,
        candidate_models=model_candidates,
        extracted_fields=build_policy_debug_snapshot(rule_hints, fields=POLICY_LOG_SUMMARY_FIELDS),
        extracted_snippets={key: value for key, value in pdf_text_snippets.items() if value}
    )

    last_error = None
    extracted_json = {}
    try:
        for model in model_candidates:
            try:
                log_policy_event(
                    "model_attempt",
                    "probando modelo de extracción",
                    extraction_id=extraction_id,
                    model=model
                )
                extracted_json = query_ollama_json(
                    model, extraction_prompt)
                log_policy_event(
                    "ai_output_summary",
                    "resumen de lo que devolvió la IA local",
                    extraction_id=extraction_id,
                    model=model,
                    response_fields=build_policy_debug_snapshot(extracted_json, fields=POLICY_LOG_SUMMARY_FIELDS),
                    response_chars=len(json.dumps(extracted_json, ensure_ascii=False))
                )
                critical_found = count_populated_fields(
                    extracted_json, CRITICAL_POLICY_FIELDS)
                if critical_found >= 4:
                    break
            except json.JSONDecodeError as exc:
                last_error = ValueError(
                    f"Respuesta JSON inválida del modelo {model}: {exc}")
                log_policy_event(
                    "model_attempt_error",
                    "respuesta JSON inválida",
                    extraction_id=extraction_id,
                    model=model,
                    error=str(last_error)
                )
            except ValueError as exc:
                last_error = exc
                log_policy_event(
                    "model_attempt_error",
                    "respuesta no utilizable",
                    extraction_id=extraction_id,
                    model=model,
                    error=str(exc)
                )
            except requests.exceptions.RequestException as exc:
                last_error = exc
                log_policy_event(
                    "model_attempt_error",
                    "error de red o de Ollama",
                    extraction_id=extraction_id,
                    model=model,
                    error=str(exc)
                )

        if not extracted_json and last_error:
            raise last_error

        merged_json = merge_extraction_results(rule_hints, extracted_json)
        merged_json = sanitize_premium_fields(cleaned_text, merged_json)

        if count_populated_fields(merged_json, CRITICAL_POLICY_FIELDS) < 4:
            reconciliation_model = model_candidates[-1]
            reconciliation_prompt = build_policy_reconciliation_prompt(
                cleaned_text, rule_hints, merged_json)
            try:
                log_policy_event(
                    "reconciliation",
                    "iniciando reconciliación",
                    extraction_id=extraction_id,
                    model=reconciliation_model,
                    critical_before=count_populated_fields(
                        merged_json, CRITICAL_POLICY_FIELDS)
                )
                reconciled_json = query_ollama_json(
                    reconciliation_model, reconciliation_prompt)
                merged_json = merge_extraction_results(
                    rule_hints, reconciled_json)
                merged_json = sanitize_premium_fields(cleaned_text, merged_json)
            except Exception as exc:
                log_policy_event(
                    "reconciliation_error",
                    "reconciliación omitida por error",
                    extraction_id=extraction_id,
                    model=reconciliation_model,
                    error=str(exc)
                )

        if not sanitize_text_value(merged_json.get("prima_total")):
            merged_json["prima_total"] = extract_prima_total_value(
                cleaned_text,
                prima_neta=merged_json.get("prima_neta"),
                derecho_poliza=merged_json.get("derecho_poliza") or merged_json.get("gastos_expedicion")
            )
            if merged_json.get("prima_total"):
                log_policy_event(
                    "pipeline_recovery",
                    "prima total recuperada después del merge",
                    extraction_id=extraction_id,
                    prima_total=merged_json.get("prima_total")
                )

        log_policy_event(
            "pipeline_result",
            "resultado final para campos objetivo",
            extraction_id=extraction_id,
            numero_de_poliza=merged_json.get("numero_de_poliza"),
            agente=merged_json.get("agente"),
            desde=merged_json.get("desde"),
            hasta=merged_json.get("hasta"),
            forma_de_pago=merged_json.get("forma_de_pago"),
            prima_neta=merged_json.get("prima_neta"),
            prima_total=merged_json.get("prima_total"),
            missing_target_fields=[
                field for field in ("numero_de_poliza", "agente", "desde", "hasta", "forma_de_pago", "prima_neta", "prima_total")
                if not sanitize_text_value(merged_json.get(field))
            ]
        )

        # Buscar catálogos existentes sin crear registros nuevos
        aseguradora_id = find_existing_aseguradora(
            merged_json.get("aseguradora"))
        agente_extraido = merged_json.get("agente")
        agente_id = find_existing_agente(agente_extraido)
        if agente_id is None:
            agente_extraido = DEFAULT_POLICY_AGENT
            agente_id = find_existing_agente(agente_extraido)
        agente_record = Agente.query.get(agente_id) if agente_id else None
        forma_pago_normalizada = normalize_forma_pago_value(
            merged_json.get("forma_de_pago"))
        tipo_pago_id = find_existing_tipo_pago(forma_pago_normalizada)
        vendedor_id = find_existing_vendedor(DEFAULT_POLICY_VENDEDOR)
        ramo_id = find_existing_ramo(merged_json.get("ramo"))
        ramo_normalized = sanitize_text_value(merged_json.get("ramo"))
        subramo_nombre = sanitize_text_value(merged_json.get("subramo"))
        subramo_id = find_existing_subramo(subramo_nombre)
        ramo_compact = normalize_ascii_upper(ramo_normalized)
        subramo_compact = normalize_ascii_upper(subramo_nombre)

        generic_subramo = (
            not subramo_nombre or
            subramo_compact in {"GASTOSMEDICOS", "GASTOSMEDICOSMAYORES", "GASTOSMEDICOSINDIVIDUALFAMILIAR", "AUTOMOVIL", "AUTO"} or
            (ramo_compact and subramo_compact == ramo_compact) or
            subramo_id is None
        )

        if generic_subramo and ramo_compact == "GASTOSMEDICOS":
            subramo_nombre = "IND/FAM"
            subramo_id = find_existing_subramo(subramo_nombre)
        elif generic_subramo and ramo_compact in {"AUTOMOVIL", "AUTO"}:
            subramo_nombre = "AUTO/IND"
            subramo_id = find_existing_subramo(subramo_nombre)
        elif generic_subramo and ramo_compact == "TRANSPORTEDECARGA":
            subramo_nombre = "Transporte terrestre de carga"
            subramo_id = find_existing_subramo(subramo_nombre)
        elif generic_subramo and ramo_compact in {"CASAHABITACION", "HOGAR"}:
            subramo_nombre = "PARTICULAR"
            subramo_id = find_existing_subramo(subramo_nombre)

        log_policy_event(
            "subramo_resolution",
            "resolución de subramo para formulario",
            extraction_id=extraction_id,
            ramo=ramo_normalized,
            subramo_original=merged_json.get("subramo"),
            subramo_final=subramo_nombre,
            subramo_id=subramo_id,
            generic_subramo=generic_subramo
        )

        # Reaplicar heurística por si el modelo devolvió la póliza pegada al cliente
        nombre_cliente_extraido = merged_json.get(
            "nombre_cliente") or merged_json.get("cliente")
        nombre_cliente_extraido, policy_from_name = split_name_and_policy_suffix(
            nombre_cliente_extraido)
        nombre_cliente_extraido = sanitize_name_candidate(
            nombre_cliente_extraido) or sanitize_text_value(nombre_cliente_extraido)
        if policy_from_name and not sanitize_text_value(merged_json.get("numero_de_poliza")):
            merged_json["numero_de_poliza"] = policy_from_name
            log_policy_event(
                "pipeline_normalization",
                "número de póliza recuperado desde el nombre del cliente",
                extraction_id=extraction_id,
                nombre_cliente=nombre_cliente_extraido,
                numero_de_poliza=policy_from_name
            )

        # Buscar cliente existente; si no hay match, dejarlo en blanco
        rfc_cliente = merged_json.get("rfc")
        cliente_id = find_existing_cliente(
            nombre_cliente_extraido, rfc_cliente)
        cliente_record = Cliente.query.get(cliente_id) if cliente_id else None
        nombre_cliente = (
            f"{cliente_record.nombre} {cliente_record.apellido}".strip()
            if cliente_record else ""
        )
        agente_nombre = agente_record.nombre if agente_record else ""

        log_policy_event(
            "entity_resolution",
            "resolución final de entidades sin persistencia",
            extraction_id=extraction_id,
            cliente_extraido=nombre_cliente_extraido,
            cliente_id=cliente_id,
            agente_extraido=agente_extraido,
            agente_id=agente_id
        )

        vehicle_notes = []
        descripcion_value = sanitize_text_value(merged_json.get("descripcion"))
        marca_value = clean_vehicle_attribute_value(merged_json.get("marca"), "marca")
        modelo_value = clean_vehicle_attribute_value(merged_json.get("modelo"), "modelo")
        motor_value = clean_vehicle_attribute_value(merged_json.get("motor"), "motor")
        placas_value = clean_vehicle_attribute_value(merged_json.get("placas"), "placas")
        serie_value = clean_vehicle_attribute_value(
            merged_json.get("numero_serie") or merged_json.get("num_serie") or merged_json.get("vin"),
            "numero_serie"
        )

        if ramo_normalized == "Automóvil":
            def append_vehicle_note(note_value: str):
                note_value = sanitize_text_value(note_value)
                if not note_value:
                    return
                note_compact = normalize_ascii_upper(note_value)
                existing_notes = " ".join(vehicle_notes)
                existing_compact = normalize_ascii_upper(existing_notes)
                if note_compact and note_compact not in existing_compact:
                    vehicle_notes.append(note_value)

            append_vehicle_note(descripcion_value)
            append_vehicle_note(marca_value)
            append_vehicle_note(modelo_value)
            append_vehicle_note(f"Motor: {motor_value}" if motor_value else None)
            append_vehicle_note(f"Placas: {placas_value}" if placas_value else None)
            append_vehicle_note(f"Serie: {serie_value}" if serie_value else None)

        normalized_serie = serie_value if ramo_normalized == "Automóvil" else ""

        normalized = {
            "numero_de_poliza": merged_json.get("numero_de_poliza") or merged_json.get("numero_poliza") or merged_json.get("poliza"),
            "nombre_cliente": nombre_cliente,
            "cliente_id": cliente_id,
            "aseguradora": merged_json.get("aseguradora"),
            "aseguradora_id": aseguradora_id,
            "agente": agente_nombre,
            "agente_id": agente_id,
            "vendedor": DEFAULT_POLICY_VENDEDOR,
            "vendedor_id": vendedor_id,
            "ramo": ramo_normalized,
            "ramo_id": ramo_id,
            "subramo": subramo_nombre,
            "subramo_id": subramo_id,
            "prima_neta": normalize_amount_value(merged_json.get("prima_neta")),
            "prima_total": normalize_amount_value(merged_json.get("prima_total")),
            "moneda": merged_json.get("moneda"),
            "desde": merged_json.get("desde") or merged_json.get("fecha_inicio"),
            "hasta": merged_json.get("hasta") or merged_json.get("fecha_fin"),
            "forma_de_pago": forma_pago_normalizada,
            "tipo_pago_id": tipo_pago_id,
            "descripcion": descripcion_value,
            "endoso": merged_json.get("endoso"),
            "rfc": rfc_cliente,
            "serie": normalized_serie,
            "observaciones": " | ".join(vehicle_notes).strip(),
            "derecho_poliza": normalize_amount_value(
                merged_json.get("derecho_poliza") or merged_json.get(
                    "gastos_expedicion")
            ) or "0"
        }
        log_policy_event(
            "pipeline_normalized",
            "datos normalizados para el frontend",
            extraction_id=extraction_id,
            numero_de_poliza=normalized.get("numero_de_poliza"),
            cliente=normalized.get("nombre_cliente"),
            prima_total=normalized.get("prima_total"),
            derecho_poliza=normalized.get("derecho_poliza"),
            missing_output=[key for key in ("numero_de_poliza", "nombre_cliente", "desde",
                                            "hasta", "prima_total") if not sanitize_text_value(normalized.get(key))]
        )
        log_policy_event(
            "field_snapshot",
            "snapshot final enviado al frontend",
            source="frontend",
            extraction_id=extraction_id,
            fields=build_policy_debug_snapshot({
                **merged_json,
                "numero_de_poliza": normalized.get("numero_de_poliza"),
                "nombre_cliente": normalized.get("nombre_cliente"),
                "ramo": normalized.get("ramo"),
                "subramo": normalized.get("subramo"),
                "forma_de_pago": normalized.get("forma_de_pago"),
                "prima_neta": normalized.get("prima_neta"),
                "prima_total": normalized.get("prima_total"),
                "numero_serie": normalized.get("serie"),
            })
        )
        return normalized
    except requests.exceptions.Timeout:
        log_policy_event(
            "pipeline_error",
            "timeout llamando a Ollama",
            extraction_id=extraction_id
        )
        raise Exception(
            "Ollama tardó demasiado. Intenta con un PDF más pequeño o verifica que Ollama esté funcionando correctamente")
    except requests.exceptions.ConnectionError:
        log_policy_event(
            "pipeline_error",
            "no se pudo conectar a Ollama",
            extraction_id=extraction_id
        )
        raise ConnectionError(
            "Ollama no está disponible en http://localhost:11434")
    except requests.exceptions.RequestException as e:
        log_policy_event(
            "pipeline_error",
            "error general de request hacia Ollama",
            extraction_id=extraction_id,
            error=str(e)
        )
        raise Exception(f"Error en Ollama: {e}")


def normalize_filename(filename: str, poliza_num: str = None) -> str:
    """
    Normaliza el nombre del archivo para evitar problemas de caracteres especiales
    y conflictos de nombres duplicados.
    """
    base_name = secure_filename(filename)
    base_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '', base_name)
    base_name = base_name.replace(' ', '_')
    base_name = base_name.lower()

    if poliza_num:
        safe_poliza = re.sub(r'[^a-zA-Z0-9_\-]', '', str(poliza_num))
        name_without_ext = base_name.rsplit(
            '.', 1)[0] if '.' in base_name else base_name
        ext = base_name.rsplit('.', 1)[1] if '.' in base_name else 'pdf'
        base_name = f"{name_without_ext}_{safe_poliza}"

    unique_id = uuid.uuid4().hex[:8]
    name_without_ext = base_name.rsplit(
        '.', 1)[0] if '.' in base_name else base_name
    ext = base_name.rsplit('.', 1)[1] if '.' in base_name else 'pdf'

    return f"{name_without_ext}_{unique_id}.{ext}"


def save_pdf_content(file_content: bytes, filename: str, poliza_num: str = None) -> str:
    """
    Guarda el contenido del PDF.
    Si PDF_UPLOAD_FOLDER está definido en config, usa esa ruta absoluta.
    De lo contrario usa static/polizas_pdf dentro de la app.
    Retorna la ruta que se guardará en BD.
    """
    custom_folder = current_app.config.get('PDF_UPLOAD_FOLDER')

    if custom_folder:
        upload_folder = custom_folder
    else:
        upload_folder = os.path.join(
            current_app.root_path, 'static', 'polizas_pdf')

    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    normalized_filename = normalize_filename(filename, poliza_num)
    file_path = os.path.join(upload_folder, normalized_filename)

    with open(file_path, 'wb') as f:
        f.write(file_content)

    # Si es ruta personalizada, guardar la ruta absoluta completa en BD
    if custom_folder:
        return file_path
    return f"polizas_pdf/{normalized_filename}"


@polizas_route.route('/upload_pdf', methods=['POST'])
@login_required
def upload_pdf():
    if 'pdf_file' not in flask_request.files:
        return jsonify({'error': True, 'msg': 'No se proporcionó archivo PDF'})

    file = flask_request.files['pdf_file']
    if not file.filename or file.filename == '':
        return jsonify({'error': True, 'msg': 'No se seleccionó archivo'})

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': True, 'msg': 'El archivo debe ser PDF'})

    # Leer el contenido del archivo UNA SOLA VEZ
    file_content = file.read()

    # Validar tamaño del archivo
    file_size = len(file_content)
    upload_trace_id = uuid.uuid4().hex[:8]
    log_policy_event(
        "upload_pdf",
        "inicio de procesamiento de PDF",
        trace_id=upload_trace_id,
        filename=file.filename,
        size_bytes=file_size
    )

    if file_size > 10 * 1024 * 1024:  # 10MB
        return jsonify({'error': True, 'msg': 'El archivo es demasiado grande. Máximo 10MB.'})

    if file_size == 0:
        return jsonify({'error': True, 'msg': 'El archivo está vacío.'})

    poliza_id = flask_request.form.get('poliza_id')
    poliza_num = None

    if poliza_id and poliza_id != "New":
        try:
            poliza_id = int(poliza_id)
            poliza = Poliza.query.get(poliza_id)
            if poliza:
                poliza_num = poliza.poliza
        except (ValueError, TypeError):
            pass

    try:
        # Extraer texto primero (valida el PDF)
        text = extract_text_from_pdf_content(file_content)
        log_policy_event(
            "upload_pdf",
            "texto extraído del PDF",
            trace_id=upload_trace_id,
            extracted_chars=len(text),
            preview=text[:300]
        )

        # Si la extracción fue exitosa, guardar el archivo
        pdf_path = save_pdf_content(file_content, file.filename, poliza_num)
        log_policy_event(
            "upload_pdf",
            "pdf guardado temporalmente",
            trace_id=upload_trace_id,
            pdf_path=pdf_path
        )

        # Procesar con Ollama
        extracted_data = call_ollama_model(text, JSON_SCHEMA)

        filename_policy = extract_policy_number_from_filename(file.filename)
        extracted_policy = sanitize_text_value(extracted_data.get("numero_de_poliza"))
        extracted_policy_compact = re.sub(r'[^A-Z0-9]', '', (extracted_policy or '').upper())
        filename_policy_compact = re.sub(r'[^A-Z0-9]', '', (filename_policy or '').upper())
        suspicious_internal_policy = bool(
            extracted_policy and len(extracted_policy_compact) >= 15 and filename_policy_compact
        )
        if filename_policy and (
            not extracted_policy or
            suspicious_internal_policy
        ):
            extracted_data["numero_de_poliza"] = filename_policy
            log_policy_event(
                "pipeline_normalization",
                "número de póliza ajustado desde el nombre del archivo",
                trace_id=upload_trace_id,
                filename=file.filename,
                numero_original=extracted_policy,
                numero_ajustado=filename_policy
            )

        log_policy_event(
            "upload_pdf",
            "extracción completada",
            trace_id=upload_trace_id,
            numero_de_poliza=extracted_data.get("numero_de_poliza"),
            cliente=extracted_data.get("nombre_cliente"),
            prima_total=extracted_data.get("prima_total")
        )

        if poliza_id and poliza_id != "New":
            poliza = Poliza.query.get(poliza_id)
            if poliza:
                old_pdf_path = poliza.pdf_path
                if old_pdf_path:
                    old_full_path = os.path.join(
                        current_app.root_path, 'static', old_pdf_path
                    )
                    if os.path.exists(old_full_path):
                        try:
                            os.remove(old_full_path)
                        except Exception as e:
                            print(f"Error al eliminar PDF anterior: {e}")

                poliza.pdf_path = pdf_path
                db.session.commit()
                log_policy_event(
                    "upload_pdf",
                    "pdf asociado a póliza existente",
                    trace_id=upload_trace_id,
                    poliza_id=poliza_id,
                    pdf_path=pdf_path
                )
            else:
                log_policy_event(
                    "upload_pdf_warning",
                    "poliza_id no encontrada al intentar asociar PDF",
                    trace_id=upload_trace_id,
                    poliza_id=poliza_id,
                    pdf_path=pdf_path
                )
        else:
            log_policy_event(
                "upload_pdf",
                "pdf temporal listo para enviarse a create",
                trace_id=upload_trace_id,
                poliza_id=poliza_id,
                pdf_path=pdf_path
            )

        return jsonify({'error': False, 'data': extracted_data, 'pdf_path': pdf_path})
    except Exception as e:
        log_policy_event(
            "upload_pdf_error",
            "error procesando PDF",
            trace_id=upload_trace_id,
            error=str(e)
        )
        error_msg = str(e)

        # Si hay error, eliminar el PDF guardado
        if 'pdf_path' in locals():
            try:
                full_path = os.path.join(
                    current_app.root_path, 'static', pdf_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
                    log_policy_event(
                        "upload_pdf_cleanup",
                        "pdf eliminado por error",
                        trace_id=upload_trace_id,
                        pdf_path=pdf_path
                    )
            except Exception as del_err:
                log_policy_event(
                    "upload_pdf_cleanup_error",
                    "error al eliminar PDF tras fallo",
                    trace_id=upload_trace_id,
                    pdf_path=pdf_path,
                    error=str(del_err)
                )

        if 'corrupto' in error_msg or 'no es válido' in error_msg:
            return jsonify({'error': True, 'msg': error_msg})
        elif 'contraseña' in error_msg or 'password' in error_msg.lower():
            return jsonify({'error': True, 'msg': 'El PDF está protegido con contraseña. Use un PDF sin protección.'})
        elif 'No /Root object' in error_msg:
            return jsonify({'error': True, 'msg': 'El archivo PDF está corrupto o no es válido. Intente con otro archivo.'})
        elif 'Ollama' in error_msg:
            return jsonify({'error': True, 'msg': error_msg})
        else:
            return jsonify({'error': True, 'msg': f'Error al procesar PDF: {error_msg}'})


@polizas_route.route('/delete_temp_pdf', methods=['POST'])
@login_required
def delete_temp_pdf():
    """Elimina un PDF temporal si la póliza no se guardó"""
    pdf_path = flask_request.json.get('pdf_path')

    if not pdf_path:
        return jsonify({'error': True, 'msg': 'No se proporcionó ruta del PDF'})

    try:
        full_path = os.path.join(current_app.root_path, 'static', pdf_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"PDF temporal eliminado: {pdf_path}")
            return jsonify({'error': False, 'msg': 'PDF eliminado'})
        else:
            return jsonify({'error': False, 'msg': 'PDF no encontrado'})
    except Exception as e:
        print(f"Error al eliminar PDF: {e}")
        return jsonify({'error': True, 'msg': f'Error al eliminar PDF: {str(e)}'})


@polizas_route.route('/download_pdf/<int:poliza_id>', methods=['GET'])
@login_required
def download_pdf(poliza_id):
    poliza = Poliza.query.get(poliza_id)
    if not poliza:
        return jsonify({'error': True, 'msg': 'Póliza no encontrada'})

    if not poliza.pdf_path:
        return jsonify({'error': True, 'msg': 'No hay PDF asociado a esta póliza'})

    # Soporta tanto ruta absoluta (PDF_UPLOAD_FOLDER) como relativa (static/polizas_pdf)
    if os.path.isabs(poliza.pdf_path):
        pdf_full_path = poliza.pdf_path
        directory = os.path.dirname(pdf_full_path)
        filename = os.path.basename(pdf_full_path)
    else:
        pdf_full_path = os.path.join(
            current_app.root_path, 'static', poliza.pdf_path)
        directory = os.path.join(current_app.root_path, 'static')
        filename = poliza.pdf_path

    if not os.path.exists(pdf_full_path):
        return jsonify({'error': True, 'msg': 'El archivo PDF no existe'})

    return send_from_directory(
        directory,
        filename,
        as_attachment=True,
        download_name=f"poliza_{poliza.poliza}.pdf"
    )
