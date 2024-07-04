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
from datetime import datetime, date
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
