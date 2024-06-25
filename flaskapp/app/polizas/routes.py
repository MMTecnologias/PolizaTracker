# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import polizas_route
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased

@polizas_route.route('/get_receipts', methods=['POST'])
@login_required
def get_receipts():
    # Recibe
    poliza_id = request.form.get('poliza_id')
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))

    # Query to fetch polizas data from the database
    recibos_query = Recibo.query.filter_by(poliza_id=poliza_id)
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
            'fecha_recibo':recibo.fecha_inicio.strftime('%Y-%m-%d'),
            "vencimiento" : recibo.fecha_vencimiento.strftime('%Y-%m-%d') ,
            "prima_neta" : float(recibo.prima_neta) ,
            "prima_total" : float(recibo.prima_total) ,
            "comision" : float(recibo.comision) ,
            "pagado" : True if recibo.status=='Liquidado' else False,
            "fecha_pago" : "" if recibo.fecha_pago is None else  recibo.fecha_pago.strftime('%Y-%m-%d'),
            "comprobante" : "" if recibo.comprobante is None else  recibo.comprobante ,
            "cancelado" : True if poliza.status=='Cancelada' else False,
            'id': recibo.id
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
    search_query = request.form.get('query')
    clients_query = db.session.query(Cliente.id, Cliente.nombre, Cliente.apellido) \
        .filter(Cliente.status == 'Activo') \
        .filter(or_(
            func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(
                f'%{search_query}%')
        )) \
        .order_by(desc(Cliente.id)) \
        .limit(20)

    # Fetch client options
    options = [{'id': client.id, 'name': f"{client.nombre} {client.apellido}"} for client in clients_query]

    return jsonify({'options': options})

@polizas_route.route('/get', methods=['POST'])
@login_required
def get():
    # Estos datos los recibe desde la función en JS
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('searchValue')
    order = bool(request.form.get('order'))
    poliza_id = request.form.get('poliza_id')

    polizas_query = db.session.query(Poliza,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo"),
                                     TipoPago.tipo_pago.label("tipo_pago")) \
        .select_from(Poliza) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id)  \
        .join(Subramo, Poliza.subramo_id == Subramo.id)  \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id)

    if order:
        polizas_query = polizas_query.order_by('poliza')
    else:
        polizas_query = polizas_query.order_by(desc(Poliza.id))

    if poliza_id:
        polizas_query = polizas_query.filter(Poliza.id == int(poliza_id))

    # Implement search functionality
    if search_value:
        polizas_query = polizas_query.filter(or_(
            Poliza.poliza.ilike(f'%{search_value}%'),
            Poliza.serie.ilike(f'%{search_value}%')
            # Add more fields for searching as needed
        ))

     # Get total count of records without filtering
    total_records = polizas_query.count()

    # Apply pagination
    if not length and not start:
        polizas = polizas_query.all()
    else:
        polizas = polizas_query.offset(start).limit(length).all()

    data = []
    # Iterate through the query results
    for poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago in polizas:
        # Extracting all columns from the Poliza object
        poliza_data = {}
        # Iterate through each column in the Poliza table
        for column in Poliza.__table__.columns:
            # Get the value of the column
            value = getattr(poliza, column.name)
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
            'vigencia': f"{poliza.fecha_inicio.strftime('%Y-%m-%d')} to {poliza.fecha_termino.strftime('%Y-%m-%d')}",
            'ramo': f"{ramo}",
            'subramo': f"{subramo}",
            'tipoPago': f"{tipo_pago}",
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

@polizas_route.route('/create', methods=['POST'])
@login_required
def create():
    # if not check_access("Clientes"):
    #    return redirect(url_for('main.index'))
    poliza_id = request.form.get('poliza_id')

    def check_new_form():
        argdict = {}

        ramo = request.form.get('ramo')
        nuevo_ramo = request.form.get('nuevo_ramo')
        argdict["ramo_id"] = new_class(Ramo, ramo, nuevo_ramo, "ramo")

        subramo = request.form.get('subramo')
        nuevo_subramo = request.form.get('nuevo_subramo')
        argdict["subramo_id"] = new_class(
            Subramo, subramo, nuevo_subramo, "subramo")

        aseguradora = request.form.get('aseguradora')
        nuevo_aseguradora = request.form.get('nuevo_aseguradora')
        argdict["aseguradora_id"] = new_class(
            Aseguradora, aseguradora, nuevo_aseguradora, "aseguradora")

        vendedor = request.form.get('vendedor')
        nuevo_vendedor = request.form.get('nuevo_vendedor')
        argdict["vendedor_id"] = new_class(
            Vendedor, vendedor, nuevo_vendedor, "nombre")

        agente = request.form.get('agente')
        nuevo_agente = request.form.get('nuevo_agente')
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
        'poliza': 'Poliza'
    }
    form_value_mapping = {
        'selected-client-id': request.form.get('selected-client-id'),
        'VigenciaI': request.form.get('VigenciaI'),
        'VigenciaF': request.form.get('VigenciaF'),
        'Moneda': request.form.get('Moneda'),
        'Pago': request.form.get('Pago'),
        'serie': request.form.get('serie'),
        'notas': request.form.get('notas'),
        'polizaAnterior': request.form.get('polizaAnterior'),
        'renovacion': request.form.get('renovacion'),
        'prima_neta': request.form.get('prima_neta'),
        'prima_total': request.form.get('prima_total'),
        'Poliza': request.form.get('Poliza')
    }
    arg_values = {col: form_value_mapping[map] for col, map in column_name_mapping.items(
    ) if form_value_mapping[map]}
    # print(form_value_mapping)
    # return arg_values

    # If cliente_id is "New", then it's a new client creation
    if poliza_id == "New":
        arg_values.update(check_new_form())
        arg_values["fecha_captura"] = datetime.now().strftime('%Y-%m-%d')
        # Create a new client
        new_poliza = Poliza(**arg_values)
        # Save the new client to the database
        db.session.add(new_poliza)
        db.session.commit()

        request_entry = Request(usuario_id=current_user.id,
                                description=f"Crear poliza {
                                    new_poliza.poliza}",
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
            'title':'Poliza registrada exitosamente',
            'poliza_id':new_poliza.id
        })
    else:
        return jsonify({
            'error': False,
            'redirect': url_for('main.polizas'),
            'msg': 'Solo se puede editar poliza en endosos',
            'title': 'Sin cambios'
        })

@polizas_route.route('/delete', methods=['POST'])
@login_required
def delete():
    poliza_id = int(request.form.get('poliza_id'))

    poliza = Poliza.query.get(poliza_id)
    if poliza:
        # Update the poliza's status to "Eliminado"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Candelar póliza {poliza.poliza}",
                                table_name='Poliza',
                                row_id=poliza.id)
        db.session.add(request_entry)
        db.session.commit()
        log_entry = Log(request_id=request_entry.id,
                        column_name='status',
                        old_value=poliza.status,
                        new_value='Cancelada')

        db.session.add(log_entry)
        poliza.status = "Cancelada"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Póliza eliminada', 'msg': 'La póliza ha sido eliminada con éxito, esta acción está sujeta a revisión y puede ser revertida por el administrador.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró la póliza.'})



"""Recibos aun sin uso"""
# Ruta para obtener los valores de la póliza
@polizas_route.route('/get_policy_values/<int:policy_id>', methods=['GET'])
@login_required
def get_policy_values(policy_id):
    # Buscar la póliza en la base de datos por su ID
    poliza = Poliza.query.get(policy_id)

    if not poliza:
        return jsonify({'error': True, 'msg': 'Poliza no encontrada'})

    # Calcular la duración de la póliza en años, considerando años bisiestos
    start_date = poliza.fecha_inicio
    end_date = poliza.fecha_termino
    # Duración en años, considerando años bisiestos y redondeado a entero
    policy_duration = int(round((end_date - start_date).days / 365.2425))

    # Obtener el tipo de pago de la póliza
    tipo_pago = TipoPago.query.get(poliza.tipo_pago_id)

    # Obtener el número de pagos según el tipo de pago
    if tipo_pago.contado == "Si":
        num_payments = 1
    else:
        # De lo contrario, el número de pagos es igual a los pagos mensuales
        num_payments = tipo_pago.pagos_anuales*policy_duration

    # Devolver los valores como un objeto JSON
    return jsonify({
        'netPremium': float(poliza.prima_neta),
        'totalPremium': float(poliza.prima_total),
        'numReceipts': int(num_payments),
        'policyDuration': int(policy_duration),  # Convertir a entero
    })

def calcular_recibos():
    # Retrieve data from the form
    prima_total = float(request.form.get('totalPremium'))
    prima_neta = float(request.form.get('netPremium'))
    iva = float(request.form.get('iva'))
    derecho_poliza = float(request.form.get('insurance'))*(1+iva / 100)
    iva = prima_neta * iva / 100
    commission = float(request.form.get('commission'))
    commission = prima_total * commission/100
    # Assuming this is the number of payments
    nopagos = int(request.form.get('receipts'))
    print(derecho_poliza)
    recargo_por_pago = prima_total - derecho_poliza - prima_neta - iva
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
    total_premium = (prima_neta + iva + recargo_por_pago) / nopagos
    net_premium = prima_neta / nopagos
    commission_pp = commission / nopagos

    response['firstpay']['netPremium'] = net_premium
    response['firstpay']['totalPremium'] = total_premium + derecho_poliza
    response['firstpay']['comision'] = commission_pp

    # If there are subsequent payments, calculate their values as well
    if nopagos > 1:
        response['subspay']['netPremium'] = net_premium
        response['subspay']['totalPremium'] = total_premium
        response['subspay']['comision'] = commission_pp

    response['derecho_poliza'] = derecho_poliza
    response['iva'] = iva/prima_neta
    response['rec_pago'] = recargo_por_pago/prima_neta
    response['comision'] = commission/prima_total
    response['poliza_id'] = request.form.get('selectPoliza')
    response['nopagos'] = nopagos
    # print(response)
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
    if not poliza:
        return jsonify({'error': True, 'msg': 'Poliza no encontrada'})
    if poliza.recibos == "Generados":
        return jsonify({'error': True, 'msg': 'Esta poliza ya tiene recibos generados'})
    try:
        # Ejecuta el bucle para crear registros
        start_date = poliza.fecha_inicio
        end_date = poliza.fecha_termino
        tipo_pago = TipoPago.query.get(poliza.tipo_pago_id)

        if tipo_pago.contado == "Si":
            print("done")
            nuevo_recibo = Recibo(fecha_inicio=start_date,
                                  fecha_vencimiento=end_date,
                                  poliza_id=poliza_id,
                                  prima_neta=response['firstpay']['netPremium'],
                                  prima_total=response['firstpay']['totalPremium'],
                                  comision=response['firstpay']['comision']
                                  )
            db.session.add(nuevo_recibo)
        else:
            num_months = int(12/tipo_pago.pagos_anuales)
            fecha_inicio = start_date
            fecha_vencimiento = add_months(fecha_inicio, num_months)
            nopagos = response['nopagos']
            nuevo_recibo = Recibo(fecha_inicio=fecha_inicio,
                                  fecha_vencimiento=fecha_vencimiento,
                                  poliza_id=poliza_id,
                                  prima_neta=response['firstpay']['netPremium'],
                                  prima_total=response['firstpay']['totalPremium'],
                                  comision=response['firstpay']['comision'],
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
                                      prima_neta=response['subspay']['netPremium'],
                                      prima_total=response['subspay']['totalPremium'],
                                      comision=response['subspay']['comision'],
                                      no_de_recibo=str(
                                          nopay)+" / "+str(nopagos)
                                      )
                db.session.add(nuevo_recibo)

        poliza.derecho_poliza = response['derecho_poliza']
        poliza.iva = response['iva']
        poliza.rec_pago = response['rec_pago']
        poliza.comision = response['comision']
        poliza.recibos = "Generados"
        # Realiza el commit después de completar las inserciones
        db.session.commit()

        return jsonify({'error': False, 'msg': 'Recibos generados con exito'})
    except:
        # Si ocurre algún error, realiza un rollback
        db.session.rollback()
        return jsonify({'error': True, 'msg': 'Error en la creación de recibos'})
