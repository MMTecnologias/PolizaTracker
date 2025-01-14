# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import vencimientos_route
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased
from io import BytesIO
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors, styles
from reportlab.lib.styles import getSampleStyleSheet


def update_poliza_status(no_months):
    # Get the current date
    current_date = date.today()

    # Get all polizas with status "Vigente" or "Por Vencer"
    polizas = Poliza.query.filter(
        Poliza.status.in_(["Vigente", "Por Vencer"])).all()

    # Iterate through each poliza
    for poliza in polizas:
        # Check if the fecha_termino is before the current date
        if poliza.fecha_termino < current_date:
            poliza.status = "Finalizada"
        else:
            # Calculate the number of months until the finalization date
            num_months = (poliza.fecha_termino.year - current_date.year) * \
                12 + (poliza.fecha_termino.month - current_date.month)

            # Check if the number of months is less than or equal to no_months
            if num_months <= no_months:
                poliza.status = "Por Vencer"

    # Commit the changes to the database
    db.session.commit()


@vencimientos_route.route('/get', methods=['POST'])
@login_required
def get():
    # Estos datos los recibe desde la función en JS
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('searchValue')
    order = bool(request.form.get('order'))
    poliza_id = request.form.get('poliza_id')

    aseguradora_id = request.form.get('aseguradora_id')
    cliente_id = request.form.get('cliente_id')
    grupo_id = request.form.get('grupo_id')

    # Client and grupo can not be asked both
    if cliente_id and grupo_id:
        return jsonify({'error': True,
                        'msg': 'No se puede buscar por cliente y grupo al mismo tiempo'})

    polizas_query = db.session.query(Poliza,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo"),
                                     TipoPago.tipo_pago.label("tipo_pago"),
                                     Agente.nombre.label("agente"),
                                     Vendedor.nombre.label("vendedor")) \
        .select_from(Poliza) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id)  \
        .join(Subramo, Poliza.subramo_id == Subramo.id)  \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
        .filter(Poliza.status.in_([ "Por Vencer","Vigente"]),
                Poliza.Poliza_renovada.in_(["No"]))

    if order:
        polizas_query = polizas_query.order_by(Poliza.fecha_termino)
    else:
        polizas_query = polizas_query.order_by(desc(Poliza.fecha_termino))

    if poliza_id:
        polizas_query = polizas_query.filter(Poliza.id == int(poliza_id))

    if aseguradora_id:
        polizas_query = polizas_query.filter(
            Poliza.aseguradora_id == int(aseguradora_id))

    if cliente_id:
        polizas_query = polizas_query.filter(
            Poliza.cliente_id == int(cliente_id))

    if grupo_id:
        clients_query = db.session.query(Cliente) \
            .filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = polizas_query.filter(Poliza.cliente_id.in_(clients))

    # Implement search functionality
    if search_value:
        polizas_query = polizas_query.filter(or_(
            #Poliza.poliza.ilike(f'%{search_value}%'),
            Cliente.nombre.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%'),
            #Search in poliza sarting with search_value
            Poliza.poliza.ilike(f'{search_value}%'),
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
    for poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in polizas:
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

        # Append additional information
        poliza_data.update({
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'vigencia': f"{poliza.fecha_inicio.strftime('%Y-%m-%d')} to {poliza.fecha_termino.strftime('%Y-%m-%d')}",
            'ramo': f"{ramo}",
            'subramo': f"{subramo}",
            'tipoPago': f"{tipo_pago}",
            'agente': f"{agente}",
            'vendedor': f"{vendedor}"
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
    # print(data)
    return jsonify(response)


"""
# Base Code for Export
def export_clients():
    headers = []
    query=
    def generate():
        f = StringIO()
        f.seek(0)
        f.write(u'\uFEFF')
        writer = csv.writer(f)
        writer.writerow(tuple(headers))
        # Write rows
        for data in query:
            row = []
            writer.writerow(tuple(row))
            yield f.getvalue()
            f.seek(0)
            f.truncate(0)

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition", "attachment", filename='.csv')
    return response

 """


@vencimientos_route.route('/get_upcoming_receipts', methods=['POST', 'GET'])
@login_required
def get_upcoming_receipts():
    days_tolerance = 30

    start = int(request.form.get('start')
                ) if request.form.get('start') else None
    length = int(request.form.get('length')
                 ) if request.form.get('length') else None

    aseguradora_id = request.form.get('aseguradora_id')
    cliente_id = request.form.get('cliente_id')
    grupo_id = request.form.get('grupo_id')
    #agente
    agente_id = request.form.get('agente_id')
    #vendeor
    vendedor_id = request.form.get('vendedor_id')
    #ramo
    ramo_id = request.form.get('ramo_id')

    print(aseguradora_id, cliente_id, grupo_id)

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
    
    if agente_id:
        polizas_query = db.session.query(Poliza) \
            .filter(Poliza.agente_id == int(agente_id)).all()
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

    # Retrieve the start and end dates for the report
    filtered_selected = True
    if not request.form.get('start_date') and not request.form.get('end_date'):
        filtered_selected = False
    start_date = datetime.now() if not request.form.get(
        'start_date') else datetime.strptime(request.form.get('start_date'), '%Y-%m-%d')
    end_date = start_date + timedelta(days=days_tolerance//2) if not request.form.get(
        'end_date') else datetime.strptime(request.form.get('end_date'), '%Y-%m-%d')
    
    # Calculate the payment due date range
    payment_due_start = start_date - timedelta(days=days_tolerance)
    payment_due_end = end_date - timedelta(days=days_tolerance//2)
    
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

    if not filtered_selected and not polizas:

        # Apply the filters
        upcoming_receipts_query = upcoming_receipts_query.filter(Recibo.fecha_inicio <= payment_due_end,
                                                                Recibo.status == "Pendiente") \
                                                                    .add_columns(
                                                                        (Recibo.fecha_inicio >= payment_due_start).label('is_upcoming')) \
                                                                    .order_by(desc('is_upcoming'), Recibo.fecha_inicio) 
                                                                    

        #upcoming_receipts_query = upcoming_receipts_query.filter(Recibo.fecha_inicio <= payment_due_end,
        #                                                         Recibo.status == "Pendiente") \
        #    .order_by(Recibo.fecha_inicio)
    else:
        upcoming_receipts_query = upcoming_receipts_query.filter(Recibo.fecha_inicio >= payment_due_start,
                                                                 Recibo.fecha_inicio <= payment_due_end,
                                                                 Recibo.status == "Pendiente") \
                                                                 .add_columns(
                                                                        (Recibo.fecha_inicio >= payment_due_start).label('is_upcoming')) \
            .order_by(Recibo.fecha_inicio)

    if aseguradora_id or cliente_id or grupo_id:
        upcoming_receipts_query = upcoming_receipts_query.filter(
            Recibo.poliza_id.in_(polizas))

    total_records = upcoming_receipts_query.count()

    if not length and not start:
        upcoming_receipts = upcoming_receipts_query.all()
    else:
        upcoming_receipts = upcoming_receipts_query.offset(
            start).limit(length).all()

    # Prepare the response data
    response = []
    for recibo, poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor,is_upcoming in upcoming_receipts:

        data = {
            'poliza_id': recibo.poliza_id,
            'poliza': poliza.poliza,
            'no_de_recibo': f"'{recibo.no_de_recibo}",  # Convert to string
            'cliente': f'{nombre} {apellido}',
            'notas': poliza.notas,
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': recibo.fecha_inicio.strftime('%d/%m/%y'),
            'fecha_fin': recibo.fecha_vencimiento.strftime('%d/%m/%y'),
            'prima_neta': recibo.prima_neta,
            'prima_total': recibo.prima_total,
            'moneda': poliza.moneda,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior,
            'aseguradora': aseguradora
        }

        response.append(data)

    headers = ['poliza', 'no_de_recibo', 'cliente', 'notas', 'ramo', 'subramo', 'aseguradora', 'fecha_inicio',
               'fecha_fin', 'prima_neta', 'prima_total', 'moneda', 'forma_pago', 'agente', 'endoso', 'poliza_anterior']
    real_headers = ['poliza', 'Recibo', 'Nombre del cliente  ', 'Notas            ', 'Ramo', 'Subramo', 'Aseguradora',
                    'Inicio', 'Final', 'Prima Neta', 'Prima Total', 'Moneda', 'Forma de pago', 'Agente', 'Endoso', 'Anterior']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'upcoming_receipts.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['cliente', 'notas']
        if filtered_selected:
            title_str = "Recibos por vencer en %s - %s" % (
                payment_due_start.strftime('%d/%m/%y'), payment_due_end.strftime('%d/%m/%y'))
        else:
            today = datetime.now().strftime('%d/%m/%y')
            title_str = "Recibos próximos por vencer, al %s" % today
        return export_to_pdf(headers, response, 'upcoming_receipts.pdf', real_headers, to_multiline, title_str)

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })


@vencimientos_route.route('/get_upcoming_policies', methods=['POST', 'GET'])
@login_required
def get_upcoming_policies():
    days_tolerance = 30

    start = int(request.form.get('start')
                ) if request.form.get('start') else None
    length = int(request.form.get('length')
                 ) if request.form.get('length') else None

    aseguradora_id = request.form.get('aseguradora_id')
    cliente_id = request.form.get('cliente_id')
    grupo_id = request.form.get('grupo_id')
    #vendedor
    vendedor_id = request.form.get('vendedor_id')
    #agente
    agente_id = request.form.get('agente_id')
    #ramo
    ramo_id = request.form.get('ramo_id')

    # Client and grupo can not be asked both
    if cliente_id and grupo_id:
        return jsonify({'error': True,
                        'msg': 'No se puede buscar por cliente y grupo al mismo tiempo'})

    # Retrieve the start and end dates for the report

    filtered_selected = True
    if not request.form.get('start_date') and not request.form.get('end_date'):
        filtered_selected = False
    start_date = datetime.now() if not request.form.get(
        'start_date') else datetime.strptime(request.form.get('start_date'), '%Y-%m-%d')
    end_date = start_date  if not request.form.get(
        'end_date') else datetime.strptime(request.form.get('end_date'), '%Y-%m-%d')

    # Calculate the policy due date range
    policy_due_start = start_date
    policy_due_end = end_date + timedelta(days=days_tolerance)

    # Query the database for upcoming policies
    upcoming_policies_query = db.session.query(Poliza,
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
        .select_from(Poliza) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Subramo, Poliza.subramo_id == Subramo.id) \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) #\
        #.filter(Poliza.fecha_termino >= policy_due_start,
        #        Poliza.fecha_termino <= policy_due_end,
        #        Poliza.status.in_(["Vigente", "Por Vencer", "Finalizada"]),
        #        Poliza.Poliza_renovada.in_(["No"])) \
        #.order_by(Poliza.fecha_termino)

    upcoming_endosos_query = db.session.query(Endoso,
                                              Cliente.nombre.label(
                                                  "client_name"),
                                              Cliente.apellido.label(
                                                  "client_lastname"),
                                              Aseguradora.aseguradora.label(
                                                  "aseguradora"),
                                              Ramo.ramo.label("ramo"),
                                              Subramo.subramo.label("subramo"),
                                              TipoPago.tipo_pago.label(
                                                  "tipo_pago"),
                                              Agente.nombre.label("agente"),
                                              Vendedor.nombre.label("vendedor")) \
        .select_from(Endoso) \
        .join(Cliente, Endoso.cliente_id == Cliente.id) \
        .join(Aseguradora, Endoso.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Endoso.ramo_id == Ramo.id) \
        .join(Subramo, Endoso.subramo_id == Subramo.id) \
        .join(TipoPago, Endoso.tipo_pago_id == TipoPago.id) \
        .join(Agente, Endoso.agente_id == Agente.id) \
        .join(Vendedor, Endoso.vendedor_id == Vendedor.id) \
        .filter(Endoso.fecha_termino >= policy_due_start,
                Endoso.fecha_termino <= policy_due_end,
                Endoso.status.in_(["Vigente", "Por Vencer"])) \
        .order_by(Endoso.fecha_termino)
        
        
    if not filtered_selected and not aseguradora_id and not cliente_id and not grupo_id:
        print("No filters", policy_due_start, policy_due_end)
        upcoming_policies_query = upcoming_policies_query \
            .filter(Poliza.fecha_termino <= policy_due_end,
                    Poliza.status.in_(["Vigente", "Por Vencer", "Finalizada"]),
                    Poliza.Poliza_renovada.in_(["No"])) \
            .add_columns(
                (Poliza.fecha_termino >= policy_due_start).label('is_upcoming')) \
            .order_by(desc('is_upcoming'), Poliza.fecha_termino)
    else:
        upcoming_policies_query = upcoming_policies_query \
            .filter(Poliza.fecha_termino >= policy_due_start,
                    Poliza.fecha_termino <= policy_due_end,
                    Poliza.status.in_(["Vigente", "Por Vencer", "Finalizada"]),
                    Poliza.Poliza_renovada.in_(["No"])) \
             .add_columns(
                (Poliza.fecha_termino >= policy_due_start).label('is_upcoming')) \
            .order_by(Poliza.fecha_termino)

        
        #\
        #.filter(Poliza.fecha_termino >= policy_due_start,
        #        Poliza.fecha_termino <= policy_due_end,
        #        Poliza.status.in_(["Vigente", "Por Vencer", "Finalizada"]),
        #        Poliza.Poliza_renovada.in_(["No"])) \
        #.order_by(Poliza.fecha_termino)
    


    if aseguradora_id:
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.aseguradora_id == int(aseguradora_id))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.aseguradora_id == int(aseguradora_id))

    if cliente_id:
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.cliente_id == int(cliente_id))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.cliente_id == int(cliente_id))

    if grupo_id:
        clients_query = db.session.query(Cliente) \
            .filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.cliente_id.in_(clients))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.cliente_id.in_(clients))
    
    if agente_id:
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.agente_id == int(agente_id))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.agente_id == int(agente_id))
    
    if vendedor_id:
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.vendedor_id == int(vendedor_id))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.vendedor_id == int(vendedor_id))
    
    if ramo_id:
        upcoming_policies_query = upcoming_policies_query.filter(
            Poliza.ramo_id == int(ramo_id))
        upcoming_endosos_query = upcoming_endosos_query.filter(
            Endoso.ramo_id == int(ramo_id))

    total_records = upcoming_policies_query.count()
    total_records += upcoming_endosos_query.count()

    if not length and not start:
        upcoming_policies = upcoming_policies_query.all()
        upcoming_endosos = upcoming_endosos_query.all()
    else:
        upcoming_endosos = upcoming_endosos_query.offset(
            start).limit(length).all()
        upcoming_policies = upcoming_policies_query.offset(
            start).limit(length).all()

    # Prepare the response data
    response = []
    for poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor,is_upcoming in upcoming_policies:

        data = {
            'Poliza o Endoso': 'Poliza',
            'poliza_id': poliza.id,
            'poliza': poliza.poliza,
            'cliente': f'{nombre} {apellido}',
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': poliza.fecha_inicio.strftime('%d/%m/%y'),
            'fecha_fin': poliza.fecha_termino.strftime('%d/%m/%y'),
            'prima_neta': poliza.prima_neta,
            'prima_total': poliza.prima_total,
            'moneda': poliza.moneda,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'vendedor': f'{vendedor}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior
        }

        response.append(data)

    for poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in upcoming_endosos:

        data = {
            'Poliza o Endoso': 'Endoso',
            'poliza_id': poliza.id,
            'poliza': poliza.poliza,
            'cliente': f'{nombre} {apellido}',
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': poliza.fecha_inicio.strftime('%d/%m/%y'),
            'fecha_fin': poliza.fecha_termino.strftime('%d/%m/%y'),
            'prima_neta': poliza.prima_neta,
            'prima_total': poliza.prima_total,
            'moneda': poliza.moneda,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'vendedor': f'{vendedor}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior
        }

        response.append(data)

    # 'Poliza o Endoso': 'Endoso'
    # Export to CSV
    headers = ['Poliza o Endoso', 'poliza_id', 'poliza', 'cliente', 'ramo', 'subramo', 'fecha_inicio',
               'fecha_fin', 'prima_neta', 'prima_total', 'moneda', 'forma_pago', 'agente', 'vendedor', 'endoso', 'poliza_anterior']
    real_headers = ['Tipo', 'id', 'poliza', 'Nombre del cliente  ', 'Ramo', 'Subramo', 'Inicio',
                    'Final', 'Prima Neta', 'Prima Total', 'Moneda', 'Forma de pago', 'Agente', 'Vendedor', 'Endoso', 'Anterior']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'upcoming_policies.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['cliente']
        if filtered_selected:
            title_str = "Pólizas y Endosos por vencer en (%s - %s)" % (
                policy_due_start.strftime('%d/%m/%y'), policy_due_end.strftime('%d/%m/%y'))
        else:
            today = datetime.now().strftime('%d/%m/%y')
            title_str = "Pólizas y Endosos por vencer, al %s" % today
        return export_to_pdf(headers, response, 'upcoming_policies.pdf', real_headers, to_multiline, title_str)

    print(response)
    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })


def export_to_csv(headers, jsondic, filename, real_headers=None):
    if real_headers is None:
        real_headers = headers

    def generate():
        f = StringIO()
        writer = csv.writer(f)

        # Escribir los encabezados solo una vez
        writer.writerow(real_headers)

        for data in jsondic:
            row = [data[header] for header in headers]
            writer.writerow(row)

        f.seek(0)
        yield f.read()
        f.close()

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response


def export_to_pdf(headers, jsondic, filename, real_headers=None, to_multiline=None, title_str="Title"):
    title_str = str(title_str)
    if real_headers is None:
        real_headers = headers
    if to_multiline is None:
        to_multiline = []
    # Create a buffer to hold the PDF data
    buffer = BytesIO()
    # Set up the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=landscape(
        letter), leftMargin=4, rightMargin=4, topMargin=4, bottomMargin=4, title=title_str)

    # Create the table data
    style = getSampleStyleSheet()['Normal']
    style.fontName = 'Helvetica'
    style.fontSize = 8
    style.textColor = colors.black
    style.wordWrap = True
    style.alignment = 0
    style.valign = 1
    style.bottomPadding = 6

    print(real_headers)
    print(jsondic)
    data = [real_headers] + [
        [Paragraph(
            '' if not data[header] else data[header], style) if header in to_multiline else data[header] for header in headers]
        for data in jsondic
    ]
    print("Porcessed")
    print(data)
    # Create the table and set its style
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.gray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('WORDWRAP', (0, 1), (-1, -1), True),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    # Build the PDF document
    elements = []

    # Create a style for the title
    title_style = getSampleStyleSheet()['Title']
    title_style.fontName = 'Helvetica'
    title_style.fontSize = 14
    title_style.leading = 20
    title_style.alignment = 1  # Center alignment

    # Create the title paragraph
    p = Paragraph(title_str, title_style)
    elements.append(p)

    elements.append(table)
    doc.build(elements)

    # Reset the buffer position
    buffer.seek(0)

    # Return the PDF data as a response
    response = Response(buffer, mimetype='application/pdf')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response


def print_to_pdf(headers, jsondic, filename, real_headers=None, to_multiline=None):
    response = export_to_pdf(headers, jsondic, filename,
                             real_headers, to_multiline)
    # Open the print interface in the browser
    response.headers.set("Content-Disposition", "inline")
    return response


def export_tocsv2(headers, jsondic, filename):
    def generate():
        f = StringIO()
        f.seek(0)
        f.write(u'\uFEFF')
        writer = csv.writer(f)
        writer.writerow(tuple(headers))
        # Write rows
        print(jsondic)
        for data in jsondic:
            row = [data[header] for header in headers]
            writer.writerow(tuple(row))
            yield f.getvalue()
            f.seek(0)

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response
