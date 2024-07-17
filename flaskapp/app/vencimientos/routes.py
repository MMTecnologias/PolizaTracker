# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log,Endoso, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import vencimientos_route
from datetime import datetime, date,timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased


def update_poliza_status(no_months):
    # Get the current date
    current_date = date.today()

    # Get all polizas with status "Vigente" or "Por Vencer"
    polizas = Poliza.query.filter(Poliza.status.in_(["Vigente", "Por Vencer"])).all()

    # Iterate through each poliza
    for poliza in polizas:
        # Check if the fecha_termino is before the current date
        if poliza.fecha_termino < current_date:
            poliza.status = "Finalizada"
        else:
            # Calculate the number of months until the finalization date
            num_months = (poliza.fecha_termino.year - current_date.year) * 12 + (poliza.fecha_termino.month - current_date.month)

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
        .filter(Poliza.status.in_(["Finalizada", "Por Vencer"]))

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

        # poliza_data = {column.name: getattr(poliza, column.name) for column in Poliza.__table__.columns}

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


    start = int(request.form.get('start')) if request.form.get('start') else None
    length = int(request.form.get('length')) if request.form.get('length') else None

    # Retrieve the start and end dates for the report
    start_date = datetime.now() if not request.form.get('start_date') else datetime.strptime(request.form.get('start_date'), '%Y-%m-%d')
    end_date = start_date + timedelta(days=days_tolerance//2) if not request.form.get('end_date') else datetime.strptime(request.form.get('end_date'), '%Y-%m-%d')
    

    # Calculate the payment due date range
    payment_due_start = start_date - timedelta(days=days_tolerance)
    payment_due_end = end_date - timedelta(days=days_tolerance//2)

    # Query the database for upcoming receipts
    upcoming_receipts_query = db.session.query(Recibo,
                                               Poliza,
                                               Cliente.nombre.label("client_name"),
                                               Cliente.apellido.label("client_lastname"),
                                               Aseguradora.aseguradora.label("aseguradora"),
                                               Ramo.ramo.label("ramo"),
                                               Subramo.subramo.label("subramo"),
                                               TipoPago.tipo_pago.label("tipo_pago"),
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
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
        .filter(Recibo.fecha_inicio >= payment_due_start,
                Recibo.fecha_inicio <= payment_due_end,
                Recibo.status == "Pendiente") \
        .order_by(Recibo.fecha_inicio)
    
    total_records = upcoming_receipts_query.count()

    if start and length:
        upcoming_receipts = upcoming_receipts_query.offset(start).limit(length).all()
    else:
        upcoming_receipts = upcoming_receipts_query.all()

    # Prepare the response data
    response = []
    for recibo, poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in upcoming_receipts:

        data = {
            'poliza_id': recibo.poliza_id,
            'poliza': poliza.poliza,
            'no_de_recibo': f"'{recibo.no_de_recibo}",  # Convert to string
            'cliente': f'{nombre} {apellido}',
            'notas': poliza.notas,
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': recibo.fecha_inicio.strftime('%Y-%m-%d'),
            'fecha_fin': recibo.fecha_vencimiento.strftime('%Y-%m-%d'),
            'prima_neta': recibo.prima_neta,
            'prima_total': recibo.prima_total,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior
        }

        response.append(data)

    # Export to CSV
    if request.form.get('export_csv'):
        headers = ['poliza_id', 'poliza', 'no_de_recibo', 'cliente', 'notas', 'ramo', 'subramo', 'fecha_inicio', 'fecha_fin', 'prima_neta', 'prima_total', 'forma_pago', 'agente', 'endoso', 'poliza_anterior']
        return export_to_csv(headers, response,'upcoming_receipts.csv')

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })

@vencimientos_route.route('/get_upcoming_policies', methods=['POST', 'GET'])
@login_required
def get_upcoming_policies():
    days_tolerance = 30

    
    start = int(request.form.get('start')) if request.form.get('start') else None
    length = int(request.form.get('length')) if request.form.get('length') else None

    # Retrieve the start and end dates for the report
    start_date = datetime.now() if not request.form.get('start_date') else datetime.strptime(request.form.get('start_date'), '%Y-%m-%d')
    end_date = start_date + timedelta(days=days_tolerance) if not request.form.get('end_date') else datetime.strptime(request.form.get('end_date'), '%Y-%m-%d')
    

    # Calculate the policy due date range
    policy_due_start = start_date 
    policy_due_end = end_date + timedelta(days=days_tolerance)

    # Query the database for upcoming policies
    upcoming_policies_query = db.session.query(Poliza,
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
        .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Subramo, Poliza.subramo_id == Subramo.id) \
        .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
        .filter(Poliza.fecha_termino >= policy_due_start,
                Poliza.fecha_termino <= policy_due_end,
                Poliza.status.in_(["Vigente", "Por Vencer"])) \
        .order_by(Poliza.fecha_termino)

    total_records = upcoming_policies_query.count()

    if start and length:
        upcoming_policies = upcoming_policies_query.offset(start).limit(length).all()
    else:
        upcoming_policies = upcoming_policies_query.all()

    # Prepare the response data
    response = []
    for poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in upcoming_policies:

        data = {
            'poliza_id': poliza.id,
            'poliza': poliza.poliza,
            'cliente': f'{nombre} {apellido}',
            'ramo': ramo,
            'subramo': subramo,
            'fecha_inicio': poliza.fecha_inicio.strftime('%Y-%m-%d'),
            'fecha_fin': poliza.fecha_termino.strftime('%Y-%m-%d'),
            'prima_neta': poliza.prima_neta,
            'prima_total': poliza.prima_total,
            'forma_pago': tipo_pago,
            'agente': f'{agente}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior
        }

        response.append(data)

    # Export to CSV
    if request.form.get('export_csv'):
        headers = ['poliza_id', 'poliza', 'cliente', 'ramo', 'subramo', 'fecha_inicio', 'fecha_fin', 'prima_neta', 'prima_total', 'forma_pago', 'agente', 'endoso', 'poliza_anterior']
        return export_to_csv(headers, response, 'upcoming_policies.csv')

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })


def export_to_csv(headers, jsondic,filename):
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
    response.headers.set("Content-Disposition", "attachment", filename=filename)
    return response
