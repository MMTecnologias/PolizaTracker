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
from . import endosos_route
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased


@endosos_route.route('/get_receipts', methods=['POST'])
@login_required
def get_receipts():
    # Recibe
    poliza_id = flask_request.form.get('poliza_id')
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))

    endoso_id = flask_request.form.get('endoso_id')
    if endoso_id:
        recibos_query = Recibo.query.filter_by(endoso_id=endoso_id)
        poliza_id = Recibo.query.get(endoso_id).poliza_id
    else:
        # Error
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se envió el ID del endoso.'})

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
            'moneda': moneda
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


@endosos_route.route('/get', methods=['POST'])
@login_required
def get():
    # Estos datos los recibe desde la función en JS
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))
    search_value = flask_request.form.get('searchValue')
    order = bool(flask_request.form.get('order'))
    endoso_id = flask_request.form.get('endoso_id')

    endosos_query = db.session.query(Endoso,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo"),
                                     TipoPago.tipo_pago.label("tipo_pago"),
                                     Agente.nombre.label("agente"),
                                     Vendedor.nombre.label("vendedor")) \
        .select_from(Endoso) \
        .join(Cliente, Endoso.cliente_id == Cliente.id) \
        .join(Aseguradora, Endoso.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Endoso.ramo_id == Ramo.id)  \
        .join(Subramo, Endoso.subramo_id == Subramo.id)  \
        .join(TipoPago, Endoso.tipo_pago_id == TipoPago.id) \
        .join(Agente, Endoso.agente_id == Agente.id) \
        .join(Vendedor, Endoso.vendedor_id == Vendedor.id)

    if order:
        endosos_query = endosos_query.order_by(desc(Endoso.fecha_inicio))
    else:
        endosos_query = endosos_query.order_by('endoso')
        # endosos_query = endosos_query.order_by(desc(Endoso.id))

    if endoso_id:
        endosos_query = endosos_query.filter(Endoso.id == int(endoso_id))

    # Implement search functionality
    if search_value:
        endosos_query = endosos_query.filter(or_(
            Cliente.nombre.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%'),
            Endoso.endoso.ilike(f'%{search_value}%'),
            func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(
                f'%{search_value}%'),
            # Add more fields for searching as needed
        ))

    # Get total count of records without filtering
    total_records = endosos_query.count()

    # Apply pagination
    if not length and not start:
        endosos = endosos_query.all()
    else:
        endosos = endosos_query.offset(start).limit(length).all()

    data = []
    # Iterate through the query results
    for endoso, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in endosos:
        # Extracting all columns from the Poliza object
        poliza_data = {}
        # Iterate through each column in the Poliza table
        for column in Endoso.__table__.columns:
            # Get the value of the column
            value = getattr(endoso, column.name)
            # Convert date to string if it's a date type
            if isinstance(value, date):
                value = value.strftime('%Y-%m-%d')
            # Convert Decimal to float if it's a Decimal type
            elif isinstance(value, Decimal):
                value = float(value)
            # Add column name and corresponding value to poliza_data dictionary
            poliza_data[column.name] = value

        # poliza_data = {column.name: getattr(poliza, column.name) for column in Poliza.__table__.columns}

        # Append additional information
        poliza_data.update({
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'vigencia': f"{endoso.fecha_inicio.strftime('%Y-%m-%d')} to {endoso.fecha_termino.strftime('%Y-%m-%d')}",
            'ramo': f"{ramo}",
            'subramo': f"{subramo}",
            'tipoPago': f"{tipo_pago}",
            'agente': f"{agente}",
            'vendedor': f"{vendedor}",
            'fecha_termino': endoso.fecha_termino.strftime('%Y-%m-%d')
        })

        # Append to data list
        data.append(poliza_data)

    # Póliza Cliente	Sub Ramo	Fecha Inicio	Fecha Fin	Prima Neta	Prima Total	Aseguradora	Forma de Pago
    # Prepare response
    response = {
        # 'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'data': data  # Data to display
    }
    return jsonify(response)


@endosos_route.route('/delete', methods=['POST'])
@login_required
def delete():
    endoso_id = int(flask_request.form.get('endoso_id'))
    razon = flask_request.form.get('razon')
    endoso = Endoso.query.get(endoso_id)
    if endoso:
        # Update the endoso's status to "Eliminado"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Cancelar endoso {endoso.endoso}",
                                table_name='Endoso',
                                row_id=endoso.id,
                                notas=razon)
        db.session.add(request_entry)
        db.session.commit()
        log_entry = Log(request_id=request_entry.id,
                        column_name='status',
                        old_value=endoso.status,
                        new_value='Cancelada')

        db.session.add(log_entry)
        endoso.status = "Cancelada"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Endoso cancelado', 'msg': 'El endoso ha sido cancelado con éxito, esta acción está sujeta a revisión y puede ser revertida por el administrador.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el endoso.'})


@endosos_route.route('/process_receipt', methods=['POST'])
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
