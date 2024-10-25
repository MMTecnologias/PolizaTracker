# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import reportes_route
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased
from io import BytesIO
from app.models import export_to_csv, export_to_pdf


#### Rutas para reportes gerenciales
#### Todas las rutas podran ser generadas por mes o por año
#### Se podra seleccionar los años a reportar
#### Se podra filtrar por aseguradora, grupo, ramo, agente, vendedor

# Prima Neta Pagada
# Polizas nuevas
# Polizas renovadas vs emitidas el periodo anterior
# Polizas canceladas

#get_multiple_ids
@reportes_route.route('/get_multiple_ids', methods=['GET'])
@login_required
def get_multiple_ids():
    clases={"Aseguradora":Aseguradora,
            "Grupo":Grupo,
            "Ramo":Ramo,
            "Agente":Agente,
            "Vendedor":Vendedor,
            "Cliente":Cliente}
    response={}
    for key,tabla in clases.items():
        query=tabla.query.order_by(tabla.id.desc())  # Order by id in descending order
        total_records = query.count()
        # Apply pagination
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
        response[key] = {
            'recordsTotal': total_records,  # Total records without filtering
            'data': data  # Data to display
        }

    return jsonify(response)

# Prima Neta (Incompleto)
# Usar group by month year func de SQLAlchemy
@reportes_route.route('/prima_neta', methods=['POST', 'GET'])
@login_required
def prima_neta():
    """
    Punto de acceso para generar un informe de la prima neta total pagada agrupada por mes o año.
    El informe puede filtrarse por aseguradora, grupo, ramo, agente y vendedor.
    El informe puede generarse para un rango de fechas específico.

    Parámetros de la solicitud:
    - type_report: 'month' o 'year' (por defecto: 'month')
    - start_date: Fecha de inicio para el informe (formato: 'YYYY-MM-DD')
    - end_date: Fecha de fin para el informe (formato: 'YYYY-MM-DD')
    - aseguradora_id: ID de la aseguradora para filtrar
    - grupo_id: ID del grupo para filtrar
    - ramo_id: ID del ramo para filtrar
    - agente_id: ID del agente para filtrar
    - vendedor_id: ID del vendedor para filtrar

    Respuesta:
    - recordsTotal: Número total de registros enviados
    - recordsTotal_with_values: Número total de registros con val
    - data: Lista de diccionarios que contienen los datos del informe
    """
    type_report = request.form.get('type_report') if request.form.get('type_report') else 'month'
    if type_report not in ['month', 'year']:
        return jsonify({'error': True, 'msg': 'Tipo de reporte no válido, debe ser "month" o "year"'})

    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')
    if not start_date or not end_date:
        year = datetime.now().year
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        end_date = datetime.strptime(end_date, '%Y-%m-%d')

    start=int(request.form.get('start')) if request.form.get('start') else None
    length=int(request.form.get('length')) if request.form.get('length') else None

    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')

    polizas_sets = []

    if aseguradora_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.aseguradora_id == int(aseguradora_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if grupo_id:
        clients_query = db.session.query(Cliente.id).filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = db.session.query(Poliza.id).filter(Poliza.cliente_id.in_(clients)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if ramo_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.ramo_id == int(ramo_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if agente_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.agente_id == int(agente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if vendedor_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.vendedor_id == int(vendedor_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if polizas_sets:
        polizas = list(set.intersection(*polizas_sets))
    else:
        polizas = []

    # Now `polizas` contains the set of valid poliza ids based on the selected filters

    # Query the database for the total prima neta pagada grouped by month/year
    if type_report == 'month':
        total_records_query = db.session.query(
            func.year(Recibo.fecha_pago).label('year'),
            func.month(Recibo.fecha_pago).label('month'),
            func.sum(Recibo.prima_neta).label('total_prima_neta_pagada')
        )
    else:
        total_records_query = db.session.query(
            func.year(Recibo.fecha_pago).label('year'),
            func.sum(Recibo.prima_neta).label('total_prima_neta_pagada')
        )
    if polizas:
        total_records_query = total_records_query.filter(Recibo.poliza_id.in_(polizas))
    total_records_query = total_records_query.join(
        Poliza, Recibo.poliza_id == Poliza.id
    ).filter(
        Recibo.fecha_pago >= start_date,
        Recibo.fecha_pago <= end_date,
    )

    if type_report == 'month':
        total_records_query = total_records_query.group_by(
            func.year(Recibo.fecha_pago),
            func.month(Recibo.fecha_pago)
        ).order_by(
            func.year(Recibo.fecha_pago),
            func.month(Recibo.fecha_pago)
        )
    else:
        total_records_query = total_records_query.group_by(
            func.year(Recibo.fecha_pago)
        ).order_by(
            func.year(Recibo.fecha_pago)
        )

    total_records = total_records_query.count()
    if not length and not start:
        records = total_records_query.all()
    else:
        records = total_records_query.limit(length).offset(start).all()

    # Create empty data
    start_year = start_date.year
    start_month = start_date.month
    end_year = end_date.year
    end_month = end_date.month
    data = []
    data_index = []
    for year in range(start_year, end_year + 1):
        if type_report == 'month':
            for month in range(1, 13):
                if year == start_year and month < start_month:
                    continue
                if year == end_year and month > end_month:
                    break
                data.append({'year': year, 'month': month, 'total_prima_neta_pagada': 0})
                data_index.append((year, month))
        else:
            data.append({'year': year, 'total_prima_neta_pagada': 0})
            data_index.append(year)

    # Fill in the data with the actual values
    for record in records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['total_prima_neta_pagada'] = record.total_prima_neta_pagada

    # Prepare the response
    response = {
        'recordsTotal': len(data),  # Total records send
        'recordsTotal_with_values': total_records,  # Total records without filtering
        'data': data  # Data to display
    }
    return jsonify(response)

#polizas
@reportes_route.route('/polizas', methods=['POST', 'GET'])
@login_required
def polizas():
    """
    Punto de acceso para generar un informe de polizas agrupadas por mes o año.
    El informe puede filtrarse por aseguradora, grupo, ramo, agente y vendedor.
    El informe puede generarse para un rango de fechas específico.

    parámetros de la solicitud:
    - type_report: 'month' o 'year' (por defecto: 'month')
    - start_date: Fecha de inicio para el informe (formato: 'YYYY-MM-DD')
    - end_date: Fecha de fin para el informe (formato: 'YYYY-MM-DD')
    - aseguradora_id: ID de la aseguradora para filtrar
    - grupo_id: ID del grupo para filtrar
    - ramo_id: ID del ramo para filtrar
    - agente_id: ID del agente para filtrar
    - vendedor_id: ID del vendedor para filtrar

    Respuesta:
    - recordsTotal: Número total de registros enviados
    - data: Lista de diccionarios que contienen los datos del informe
        incluyendo polizas totales, polizas nuevas, polizas renovadas, polizas canceladas
    """



    #type_report = 'year'  # Default value for testing
    type_report = request.form.get('type_report') if request.form.get('type_report') else 'month'
    if type_report not in ['month', 'year']:
        return jsonify({'error': True, 'msg': 'Tipo de reporte no válido, debe ser "month" o "year"'})

    #start_date = '2019-01-01'  # Default value for testing
    #end_date = '2025-12-31'  # Default value for testing
    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')



    if not start_date or not end_date:
        year = datetime.now().year
        end_date = datetime(year, 12, 31)
        minus=1 if type_report == 'year' else 0
        start_date = datetime(year-minus, 1, 1)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        end_date = datetime.strptime(end_date, '%Y-%m-%d')
        if type_report == 'year':
            #Start exactly one year before
            start_date = start_date - relativedelta(years=1)

    start=int(request.form.get('start')) if request.form.get('start') else None
    length=int(request.form.get('length')) if request.form.get('length') else None
            
    #aseguradora_id = None  # Default value for testing
    #grupo_id = None  # Default value for testing
    #ramo_id = None  # Default value for testing
    #agente_id = None  # Default value for testing
    #vendedor_id = None  # Default value for testing
    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')


    polizas_sets = []

    if aseguradora_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.aseguradora_id == int(aseguradora_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if grupo_id:
        clients_query = db.session.query(Cliente.id).filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = db.session.query(Poliza.id).filter(Poliza.cliente_id.in_(clients)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if ramo_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.ramo_id == int(ramo_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if agente_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.agente_id == int(agente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if vendedor_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.vendedor_id == int(vendedor_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))

    if polizas_sets:
        polizas = list(set.intersection(*polizas_sets))
    else:
        polizas = []

    # Query the database for the count of polizas grouped by month/year
    if type_report == 'month':
        total_records_query = db.session.query(
            func.year(Poliza.fecha_inicio).label('year'),
            func.month(Poliza.fecha_inicio).label('month'),
            func.count(Poliza.id).label('total_polizas')
        )
    else:
        total_records_query = db.session.query(
            func.year(Poliza.fecha_inicio).label('year'),
            func.count(Poliza.id).label('total_polizas')
        )
    if polizas:
        total_records_query = total_records_query.filter(Poliza.id.in_(polizas))
    total_records_query = total_records_query.filter(
        Poliza.fecha_inicio >= start_date,
        Poliza.fecha_inicio <= end_date,
    )
    
    if type_report == 'month':
        total_records_query = total_records_query.group_by(
            func.year(Poliza.fecha_inicio),
            func.month(Poliza.fecha_inicio)
        ).order_by(
            func.year(Poliza.fecha_inicio),
            func.month(Poliza.fecha_inicio)
        )
    else:
        total_records_query = total_records_query.group_by(
            func.year(Poliza.fecha_inicio)
        ).order_by(
            func.year(Poliza.fecha_inicio)
        )

    total_records = total_records_query.count()

    if not length and not start:
        records = total_records_query.all()
    else:
        records = total_records_query.limit(length).offset(start).all()

    # Create empty data
    start_year = start_date.year
    start_month = start_date.month
    end_year = end_date.year
    end_month = end_date.month
    data = []
    data_index = []
    for year in range(start_year, end_year + 1):
        if type_report == 'month':
            for month in range(1, 13):
                if year == start_year and month < start_month:
                    continue
                if year == end_year and month > end_month:
                    break
                data.append({'year': year, 'month': month, 
                             'polizas_totales': 0,
                             'polizas_nuevas': 0,
                             'polizas_renovadas': 0,
                             'polizas_canceladas': 0,
                             'renovaciones':0
                             })
                data_index.append((year, month))
        else:
            data.append({'year': year, 
                             'polizas_totales': 0,
                             'polizas_nuevas': 0,
                             'polizas_renovadas': 0,
                             'polizas_canceladas': 0,
                             'renovaciones':0
                             })
            data_index.append(year)

    # Fill in the data with the actual values
    for record in records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_totales'] = record.total_polizas

    # Query for new polizas (has empty poliza_anteior)
    new_polizas_query = total_records_query.filter(Poliza.poliza_anterior == None)
    new_polizas_records = new_polizas_query.all()
    for record in new_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_nuevas'] = record.total_polizas

    # Query for renewed polizas (Poliza_renovada == 'Si')
    renewed_polizas_query = total_records_query.filter(Poliza.Poliza_renovada == 'Si')
    renewed_polizas_records = renewed_polizas_query.all()
    for record in renewed_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_renovadas'] = record.total_polizas
    # Query for canceled polizas
    canceled_polizas_query = total_records_query.filter(Poliza.status == 'Cancelada')
    canceled_polizas_records = canceled_polizas_query.all()
    for record in canceled_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_canceladas'] = record.total_polizas
    #Query for renewals (has non empty poliza_anteior)
    renewals_query = total_records_query.filter(Poliza.poliza_anterior != None)
    renewals_records = renewals_query.all()
    for record in renewals_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['renovaciones'] = record.total_polizas



    # Prepare the response
    response = {
        'recordsTotal': len(data),  # Total records send
        'data': data  # Data to display
    }
    return jsonify(response)


#Reporte de recibos pagados con filtros por vendedor, por aseguradora, cliente,
# grupo y fecha en ricbos pagados tambien añadir columnas de vendedor y
#  la fecha de la vigencia  tanto inicio como fin y añadir prima neta y prima total
@reportes_route.route('/recibos_pagados', methods=['POST', 'GET'])
@login_required
def recibos_pagados():
    """
    Punto de acceso para generar un informe de recibos pagados.
    El informe puede filtrarse por aseguradora, grupo, ramo, agente, vendedor y cliente.
    El informe puede generarse para un rango de fechas específico.

    parámetros de la solicitud:
    - start_date: Fecha de inicio para el informe (formato: 'YYYY-MM-DD')
    - end_date: Fecha de fin para el informe (formato: 'YYYY-MM-DD')
        Si no se proporciona ninguna fecha, se generará un informe para el año actual
    - aseguradora_id: ID de la aseguradora para filtrar
    - grupo_id: ID del grupo para filtrar
    - ramo_id: ID del ramo para filtrar
    - agente_id: ID del agente para filtrar
    - vendedor_id: ID del vendedor para filtrar
    - cliente_id: ID del cliente para filtrar
    - start: Índice de inicio para la paginación
    - length: Número de registros por página para la paginación
    - export_csv: 'true' para exportar a CSV
    - export_pdf: 'true' para exportar a PDF
    """

    start = int(request.form.get('start')
                ) if request.form.get('start') else None
    length = int(request.form.get('length')
                 ) if request.form.get('length') else None
    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')
    #start_date = '2023-01-01'  # Default value for testing
    #end_date = '2024-12-31'  # Default value for testing
    if not start_date or not end_date:
        year = datetime.now().year
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        end_date = datetime.strptime(end_date, '%Y-%m-%d')

    # Commenting out request for testing purposes
    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')
    cliente_id = request.form.get('cliente_id')

    #aseguradora_id = None  # Esta en tabla de polizas 3
    #grupo_id = None  # Esta en tabla de clientes
    #ramo_id = None # Esta en tabla de polizas
    #agente_id = None  # Esta en tabla de polizas
    #vendedor_id = None  # Esta en tabla de polizas
    #cliente_id = None
    
    if cliente_id and grupo_id:
        return jsonify({'error':True,
                        'msg': 'No se puede buscar por cliente y grupo al mismo tiempo'})
    polizas_sets = []    
    if aseguradora_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.aseguradora_id == int(aseguradora_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if grupo_id:
        clients_query = db.session.query(Cliente.id).filter(Cliente.grupo_id == int(grupo_id)).all()
        clients = [client.id for client in clients_query]
        polizas_query = db.session.query(Poliza.id).filter(Poliza.cliente_id.in_(clients)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if ramo_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.ramo_id == int(ramo_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if agente_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.agente_id == int(agente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if vendedor_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.vendedor_id == int(vendedor_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if cliente_id:
        polizas_query = db.session.query(Poliza.id).filter(Poliza.cliente_id == int(cliente_id)).all()
        polizas_sets.append(set([poliza.id for poliza in polizas_query]))
    if polizas_sets:
        polizas = list(set.intersection(*polizas_sets))
    else:
        polizas = []

    # Query the database
    paid_recipts_query = db.session.query(Recibo,
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
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
        .filter(Recibo.fecha_inicio >= start_date,
                Recibo.fecha_inicio <= end_date,
                Recibo.status == "Liquidado") \
        .order_by(Recibo.fecha_inicio)
    
    if polizas:
        paid_recipts_query = paid_recipts_query.filter(Recibo.poliza_id.in_(polizas))
    
    total_records = paid_recipts_query.count()

    if not length and not start:
        records = paid_recipts_query.all()
    else:
        records = paid_recipts_query.limit(length).offset(start).all()

    # Prepare the response data
    response = []
    for recibo, poliza, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in records:

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
            'vendedor': f'{vendedor}',
            'endoso': poliza.endoso,
            'poliza_anterior': poliza.poliza_anterior,
            'aseguradora': aseguradora
        }

        response.append(data)
    
    headers = ['poliza', 'no_de_recibo', 'cliente', 'notas', 'ramo', 'subramo','aseguradora', 'fecha_inicio',
               'fecha_fin', 'prima_neta', 'prima_total','moneda', 'forma_pago', 'agente','vendedor', 'endoso', 'poliza_anterior']
    real_headers = ['poliza', 'Recibo', 'Nombre del cliente  ', 'Notas            ', 'Ramo', 'Subramo', 'Aseguradora',
                    'Inicio', 'Final', 'Prima Neta', 'Prima Total','Moneda', 'Forma de pago', 'Agente','Vendedor', 'Endoso', 'Anterior']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'upcoming_receipts.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['cliente', 'notas']
        title_str = "Recibos pagados en %s - %s" % (
                start_date.strftime('%d/%m/%y'), end_date.strftime('%d/%m/%y'))
        return export_to_pdf(headers, response, 'upcoming_receipts.pdf', real_headers, to_multiline, title_str)

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })

#reporte de fecha de nacimientos de clientes con ordenamiento por columnas y 
# que ese ordanimiento que el usuario haya hecho se pueda exportar a excel y pdf 

@reportes_route.route('/fecha_nacimientos', methods=['POST', 'GET'])
@login_required
def fecha_nacimientos():
    """
    Punto de acceso para generar un informe de la fecha de nacimiento de los clientes.
    El informe puede filtrarse por nombre de cliente y ordenarse por nombre.
    El informe puede generarse para el mes actual.

    Parámetros de la solicitud:
    - start: Índice de inicio para la paginación
    - length: Número de registros por página para la paginación
    - search_client_name: Nombre del cliente para buscar
    - order_by_name: 'asc' o 'desc' para ordenar por nombre
    - current_report: 'month' para filtrar por el mes actual
    - export_csv: 'true' para exportar a CSV
    - export_pdf: 'true' para exportar a PDF

    """


    start = int(request.form.get('start')
                ) if request.form.get('start') else None
    length = int(request.form.get('length')
                 ) if request.form.get('length') else None
    search_client_name = request.form.get('search_client_name')
    order_by_name = request.form.get('order_by_name')
    if order_by_name and order_by_name not in ['asc', 'desc']:
        return jsonify({'error': True, 'msg': 'Ordenamiento no válido, debe ser "asc" o "desc"'})
    
    current_report = request.form.get('current_report')
   
    
    #Try values for testing
    #current_report = None
    #search_client_name = None
    #order_by_name = None
    #start = None
    #length = None

    if current_report :
        month = datetime.now().month
    # Query the database, include  birth day (day/month) order by month and day
    clients_query = db.session.query(Cliente, 
                                     Grupo.grupo.label('grupo_name'),
                                     func.day(Cliente.fecha_nacimiento).label('day'),
                                     func.month(Cliente.fecha_nacimiento).label('month'),
                                     func.year(Cliente.fecha_nacimiento).label('year')) \
        .join(Grupo).filter(Cliente.status == 'Activo') \
        .order_by('month', 'day')
    
    
    if search_client_name:
        clients_query = clients_query.filter(or_(
            Cliente.nombre.ilike(f'%{search_client_name}%'),
            Cliente.apellido.ilike(f'%{search_client_name}%'),
            Cliente.correo.ilike(f'%{search_client_name}%'),
            # Add more fields for searching as needed
        ))
    
    if current_report == 'month':
        clients_query = clients_query.filter(
            func.month(Cliente.fecha_nacimiento) == month
        )

    if order_by_name:
        if order_by_name == 'asc':
            clients_query = clients_query.order_by(
                Cliente.nombre.asc()
            )
        else:
            clients_query = clients_query.order_by(
                Cliente.nombre.desc()
            )
    total_records = clients_query.count()
    if not length and not start:
        clients = clients_query.all()
    else:
        clients = clients_query.limit(length).offset(start).all()
    # Prepare the response data
    response = []
    for client, grupo_name, day, month, year in clients:
        data = {
            'nombre': f'{client.nombre} {client.apellido}', 
            'bday': f'{day}/{month}',
            'correo': client.correo,
            'telefono': client.tel_movil,

            'fecha_nacimiento': client.fecha_nacimiento.strftime('%d/%m/%y') if client.fecha_nacimiento else None
        }
        response.append(data)
    headers = ['nombre', 'bday', 'correo', 'telefono', 'fecha_nacimiento']
    real_headers = ['Nombre', 'Cumpleaños', 'Correo', 'Teléfono', 'Fecha de nacimiento']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'fecha_nacimientos.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['nombre']
        title_str = "Cumpleaños" 
        return export_to_pdf(headers, response, 'fecha_nacimientos.pdf', real_headers, to_multiline, title_str)
    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })






