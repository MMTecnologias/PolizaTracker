# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import clientes_route
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased


@clientes_route.route('/get', methods=['POST'])
@login_required
def get():

    # Estos datos los recibe desde la función en JS
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('searchValue')
    order = bool(request.form.get('order'))
    cliente_id = request.form.get('cliente_id')

    # Query to fetch clientes data from the database
    clients_query = db.session.query(Cliente, Grupo.grupo.label(
        'grupo_name')).join(Grupo).filter(Cliente.status == 'Activo')

    # Implement search functionality
    if order:
        clients_query = clients_query.order_by('nombre')
    else:
        clients_query = clients_query.order_by(desc(Cliente.id))

    if search_value:
        clients_query = clients_query.filter(or_(
            Cliente.nombre.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%'),
            Cliente.correo.ilike(f'%{search_value}%'),
            func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(
                f'%{search_value}%'),
        ))

    if cliente_id:
        clients_query = clients_query.filter(Cliente.id == int(cliente_id))

    # Get total count of records without filtering
    total_records = clients_query.count()

    # Apply pagination
    if not length and not start:
        clients = clients_query.all()
    else:
        # Apply pagination
        clients = clients_query.offset(start).limit(length).all()

    # Format data as required by DataTables
    data = []
    for client, grupo_name in clients:
        data.append({
            'id': client.id,
            'nombre': client.nombre,
            'grupo_id': client.grupo_id,
            'grupo': grupo_name,
            'rfc': client.rfc,
            # 'tel_oficina': client.tel_oficina,
            'tel_movil': client.tel_movil,
            # 'tel_casa': client.tel_casa,
            'correo': client.correo,
            'direccion': client.direccion,
            # Format date as string
            'fecha_nacimiento': '' if not client.fecha_nacimiento else client.fecha_nacimiento.strftime('%Y-%m-%d'),
            'sexo': client.sexo,
            'ocupacion': client.ocupacion,
            'actividad': client.actividad,
            'apellido': client.apellido,
            'fullname': f"{client.nombre} {client.apellido}",
            'cuenta': client.info_pago

        })

    # Prepare response
    response = {
        # 'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }

    return jsonify(response)

# modify log


def get_form_value(key, default=None):
    value = request.form.get(key, default)
    return default if value == '' else value


@clientes_route.route('/create', methods=['POST'])
@login_required
def create():
    # if not check_access("Clientes"):
    cliente_id = get_form_value('cliente_id')
    rfc = get_form_value('rfc')
    add_group_opt = False
    new_group_id = 0
    new_group_name = ""

    # If cliente_id is "New", then it's a new client creation
    if cliente_id == "New":
        rfc = get_form_value('rfc')
        # Check if a client with the given RFC already exists
        existing_client = Cliente.query.filter_by(rfc=rfc).first()
        if existing_client:
            return jsonify({'error': True, 'msg': "Ya existe un cliente con ese RFC, intente de nuevo"})
        else:
            grupo_id = get_form_value('grupo')
            if grupo_id == "New":
                # Handle creating a new group here
                nuevo_grupo = get_form_value('nuevo_grupo')
                grupo_existente = Grupo.query.filter_by(
                    grupo=nuevo_grupo).first()
                if grupo_existente:
                    grupo_id = grupo_existente.id
                else:
                    nuevo_grupo = Grupo(grupo=nuevo_grupo)
                    db.session.add(nuevo_grupo)
                    db.session.commit()
                    grupo_id = nuevo_grupo.id
                    add_group_opt = True
                    new_group_id = grupo_id
                    new_group_name = nuevo_grupo.grupo
            # Create a new client
            new_client = Cliente(
                nombre=get_form_value('nombre'),
                apellido=get_form_value('apellido') if get_form_value(
                    'sexo') != "Empresa" else "// "+get_form_value('apellido'),
                grupo_id=grupo_id,
                rfc=rfc,
                # tel_oficina=get_form_value('telefono_oficina'),
                tel_movil=get_form_value('telefono_movil'),
                # tel_casa=get_form_value('telefono_casa'),
                correo=get_form_value('correo'),
                direccion=get_form_value('direccion_fiscal'),
                fecha_nacimiento=get_form_value('fecha_nacimiento'),
                sexo=get_form_value('sexo'),
                ocupacion=get_form_value('ocupacion'),
                actividad=get_form_value('giro_actividad'),
                info_pago=get_form_value('cuenta'),
                notas=get_form_value('notas'),
                cvv=get_form_value('cvv'),
                fecha_vencimiento=get_form_value('fecha_vencimiento')
            )
            # Save the new client to the database
            db.session.add(new_client)
            db.session.commit()

            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Crear Cliente {new_client.nombre} {new_client.apellido}",
                                    status="Aceptada",
                                    table_name='Cliente',
                                    row_id=new_client.id)
            db.session.add(request_entry)
            db.session.commit()

            return jsonify({
                'error': False,
                'redirect': url_for('main.cliente'),
                'msg': '',
                'title': 'Cliente registrado exitosamente',
                'add_group_opt': add_group_opt,
                'new_group_id': new_group_id,
                'new_group_name': new_group_name
            })
    else:
        # If cliente_id is not "New", then it's an existing client editing
        cliente_id = int(cliente_id)
        # Get the existing client and update its data
        existing_client = Cliente.query.get(cliente_id)
        if existing_client:
            grupo_id = get_form_value('grupo')
            if grupo_id == "New":
                # Handle creating a new group here
                nuevo_grupo = get_form_value('nuevo_grupo')
                grupo_existente = Grupo.query.filter_by(
                    grupo=nuevo_grupo).first()
                if grupo_existente:
                    grupo_id = grupo_existente.id
                else:
                    nuevo_grupo = Grupo(grupo=nuevo_grupo)
                    db.session.add(nuevo_grupo)
                    db.session.commit()
                    grupo_id = nuevo_grupo.id
                    add_group_opt = True
                    new_group_id = grupo_id
                    new_group_name = nuevo_grupo.grupo

            old_dict = {column.name: getattr(
                existing_client, column.name) for column in Cliente.__table__.columns}

            existing_client.nombre = get_form_value('nombre')
            existing_client.apellido = get_form_value('apellido') if get_form_value(
                'sexo') != "Empresa" else "// " + get_form_value('apellido')
            existing_client.grupo_id = grupo_id
            # existing_client.tel_oficina = get_form_value('telefono_oficina')
            existing_client.tel_movil = get_form_value('telefono_movil')
            # existing_client.tel_casa = get_form_value('telefono_casa')
            existing_client.correo = get_form_value('correo')
            existing_client.direccion = get_form_value('direccion_fiscal')
            existing_client.fecha_nacimiento = get_form_value(
                'fecha_nacimiento')
            existing_client.sexo = get_form_value('sexo')
            existing_client.ocupacion = get_form_value('ocupacion')
            existing_client.actividad = get_form_value('giro_actividad')
            existing_client.info_pago = get_form_value('cuenta')
            existing_client.notas = get_form_value(
                'notas')  # Add the 'notas' field

            # cvv=get_form_value('cvv'),
            #    fecha_vencimiento=get_form_value('fecha_vencimiento')

            existing_client.cvv = get_form_value('cvv')
            existing_client.fecha_vencimiento = get_form_value(
                'fecha_vencimiento')

            # Save the changes to the database
            db.session.commit()

            new_dict = {column.name: getattr(
                existing_client, column.name) for column in Cliente.__table__.columns}

            # aqui log
            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Editar Cliente {existing_client.nombre} {existing_client.apellido}",
                                    status="Aceptada",
                                    table_name='Cliente',
                                    row_id=existing_client.id)
            db.session.add(request_entry)
            db.session.commit()

            for col, value in new_dict.items():
                if value != old_dict[col]:
                    log_entry = Log(request_id=request_entry.id,
                                    column_name=col,
                                    old_value=old_dict[col],
                                    new_value=value)
                    db.session.add(log_entry)
            db.session.commit()

            return jsonify({
                'error': False,
                'redirect': url_for('main.cliente'),
                'msg': '',
                'title': 'Cambios realizados exitosamente',
                'add_group_opt': add_group_opt,
                'new_group_id': new_group_id,
                'new_group_name': new_group_name
            })
        else:
            # Handle the case where the client does not exist
            return jsonify({'error': True, 'msg': 'Cliente no encontrado'})


@clientes_route.route('/delete', methods=['POST'])
@login_required
def delete():
    client_id = int(request.form.get('client_id'))

    client = Cliente.query.get(client_id)
    if client:
        # Update the user's status to "Eliminado"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Eliminar cliente {client.nombre} {client.apellido}",
                                table_name='Cliente',
                                row_id=client.id)
        db.session.add(request_entry)
        db.session.commit()
        log_entry = Log(request_id=request_entry.id,
                        column_name='status',
                        old_value=client.status,
                        new_value='Eliminado')

        db.session.add(log_entry)
        client.status = "Eliminado"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Cliente eliminado', 'msg': 'El cliente ha sido eliminado con éxito, esta accion esta sujeta a revision y puede ser revertida por el administrador.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el cliente.'})


@clientes_route.route('/poliza', methods=['POST'])
@login_required
def poliza():
    # Get parameters from DataTables AJAX request
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    cliente_id = request.form.get('search_value')

    polizas_query = db.session.query(Poliza,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo")) \
        .select_from(Poliza) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)  \
        .join(Ramo, Poliza.ramo_id == Ramo.id)  \
        .join(Subramo, Poliza.subramo_id == Subramo.id)

    # Implement search functionality
    if cliente_id:
        polizas_query = polizas_query.filter(Poliza.cliente_id == cliente_id)

    polizas = polizas_query.offset(start).limit(length).all()
    total_records = polizas_query.count()

    # Format data as required by DataTables
    data = []
    for poliza, nombre, apellido, aseguradora, ramo, subramo in polizas:
        data.append({
            'poliza': poliza.serie,
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'vigencia': f"{poliza.fecha_inicio.strftime('%Y-%m-%d')} to {poliza.fecha_termino.strftime('%Y-%m-%d')}",
            'id': poliza.id,
            'ramo': ramo,
            'subramo': subramo,
            'primaNeta': float(poliza.prima_neta),
            'primaTotal': float(poliza.prima_total),
            'fechaFin': poliza.fecha_termino.strftime('%Y-%m-%d'),
            'status': poliza.status
            #            <td>${poliza.poliza}</td>
            #            <td>${poliza.ramo}</td>
            #            <td>${poliza.subramo}</td>
            #            <td>${poliza.primaNeta}</td>
            #            <td>${poliza.primaTotal}</td>
            #            <td>${poliza.fechaFin}</td>
            # Add more fields as needed
            # Ramo, Subramo, Prima Neta, Prima Total, Vigencia, Estatus
        })
     # Prepare response
    response = {
        # 'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'data': data  # Data to display
    }

    return jsonify(response)
