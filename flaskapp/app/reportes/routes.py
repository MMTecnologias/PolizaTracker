# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class
from sqlalchemy import join, or_, desc, func, select, and_, case
import csv
from io import StringIO
from . import reportes_route
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased
from io import BytesIO
from app.models import export_to_csv, export_to_pdf


# Rutas para reportes gerenciales
# Todas las rutas podran ser generadas por mes o por año
# Se podra seleccionar los años a reportar
# Se podra filtrar por aseguradora, grupo, ramo, agente, vendedor

# Prima Neta Pagada
# Polizas nuevas
# Polizas renovadas vs emitidas el periodo anterior
# Polizas canceladas

# get_multiple_ids
@reportes_route.route('/get_multiple_ids', methods=['GET'])
@login_required
def get_multiple_ids():
    clases = {"Aseguradora": Aseguradora,
              "Grupo": Grupo,
              "Ramo": Ramo,
              "Agente": Agente,
              "Vendedor": Vendedor,
              "Cliente": Cliente}
    response = {}
    for key, tabla in clases.items():
        # Order by id in descending order
        if key == "Cliente":
            query = tabla.query.order_by(
                tabla.nombre.desc(), tabla.apellido.desc())
        else:
            query = tabla.query.order_by(tabla.id.desc())
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


@reportes_route.route('/prima_neta_compare', methods=['POST', 'GET'])
@login_required
def prima_neta_compare():
    """
    Punto de acceso para comparar la prima neta pagada entre dos conjuntos de años y meses.
    Parámetros de la solicitud:
    - year1: Año del primer conjunto
    - months1: Lista de meses del primer conjunto (e.g., [1, 2])
    - year2: Año del segundo conjunto
    - months2: Lista de meses del segundo conjunto (e.g., [3, 4])
    - year3: Año del tercer conjunto (opcional)
    - months3: Lista de meses del tercer conjunto (opcional)
    - aseguradora_id, grupo_id, ramo_id, agente_id, vendedor_id: Filtros opcionales

    Respuesta:
    - data: Lista de diccionarios con los resultados comparativos
    """
    # Obtener parámetros de la solicitud
    year1 = int(request.form.get('year1'))
    months1 = list(map(int, request.form.get('months1').split(',')))
    year2 = int(request.form.get('year2'))
    months2 = list(map(int, request.form.get('months2').split(',')))

    year3 = request.form.get('year3')
    months3 = request.form.get('months3')
    if year3 and months3:
        year3 = int(year3)
        months3 = list(map(int, months3.split(',')))
        if not months3:
            return jsonify({'error': True, 'msg': 'Debe proporcionar meses para el tercer conjunto'})
    else:
        year3 = None
        months3 = None

    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')


    # Validar parámetros
    if not year1 or not months1 or not year2 or not months2:
        return jsonify({'error': True, 'msg': 'Debe proporcionar ambos años y listas de meses'})

    # Construir conjuntos de filtros para pólizas
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

    if polizas_sets:
        polizas = list(set.intersection(*polizas_sets))
    else:
        polizas = []

    # Consultar la base de datos para los dos conjuntos de años y meses
    def query_prima_neta(year, months):
        query = db.session.query(
            func.year(Recibo.fecha_inicio).label('year'),
            func.month(Recibo.fecha_inicio).label('month'),
            func.sum(Recibo.prima_neta).label('total_prima_neta_pagada')
        ).join(Poliza, Recibo.poliza_id == Poliza.id) \
            .filter(func.year(Recibo.fecha_inicio) == year) \
            .filter(func.month(Recibo.fecha_inicio).in_(months))

        if polizas:
            query = query.filter(Recibo.poliza_id.in_(polizas))

        return query.group_by(
            func.year(Recibo.fecha_inicio),
            func.month(Recibo.fecha_inicio)
        ).order_by(
            func.year(Recibo.fecha_inicio),
            func.month(Recibo.fecha_inicio)
        ).all()

    # Ejecutar consultas para ambos conjuntos
    records1 = query_prima_neta(year1, months1)
    records2 = query_prima_neta(year2, months2)
    import logging
    logging.warning(f"[prima_neta] year1={year1} months1={months1} -> {len(records1)} registros: {[(r.year, r.month, r.total_prima_neta_pagada) for r in records1]}")
    logging.warning(f"[prima_neta] year2={year2} months2={months2} -> {len(records2)} registros: {[(r.year, r.month, r.total_prima_neta_pagada) for r in records2]}")
    if year3 and months3:
        records3 = query_prima_neta(year3, months3)

    # Preparar los datos para la respuesta
    data = []

    for record in records1:
        data.append({
            'year': record.year,
            'month': record.month,
            'total_prima_neta_pagada': record.total_prima_neta_pagada,
            'comparison_group': 'Group 1'
        })

    for record in records2:
        data.append({
            'year': record.year,
            'month': record.month,
            'total_prima_neta_pagada': record.total_prima_neta_pagada,
            'comparison_group': 'Group 2'
        })
    if year3 and months3:
        for record in records3:
            data.append({
                'year': record.year,
                'month': record.month,
                'total_prima_neta_pagada': record.total_prima_neta_pagada,
                'comparison_group': 'Group 3'
            })

    # Configurar encabezados para exportar
    headers = ['year', 'month', 'total_prima_neta_pagada', 'comparison_group']
    real_headers = ['Año', 'Mes', 'Prima Neta Pagada', 'Grupo de Comparación']

    # Exportar a CSV
    if request.form.get('export_csv'):
        return export_to_csv(headers, data, 'prima_neta_compare.csv', real_headers)

    # Exportar a PDF
    if request.form.get('export_pdf'):
        to_multiline = []
        title_str = "Comparación de Prima Neta Pagada"
        return export_to_pdf(headers, data, 'prima_neta_compare.pdf', real_headers, to_multiline, title_str)

    # Respuesta JSON
    return jsonify({
        'recordsTotal': len(data),
        'data': data
    })

@reportes_route.route('/prima_neta', methods=['POST', 'GET'])
@login_required
def prima_neta():
    """
    Punto de acceso para generar un informe de la prima neta total pagada agrupada por mes o año.
    El informe puede filtrarse por aseguradora, grupo, ramo, agente y vendedor.
    El informe puede generarse para un rango de fechas específico.

    Parámetros de la solicitud:
    - type_report: 'month' o 'year' (por defecto: 'month')
    - years: Lista de años para filtrar, si no se proporciona se usará el año actual
    - aseguradora_id: ID de la aseguradora para filtrar
    - grupo_id: ID del grupo para filtrar
    - ramo_id: ID del ramo para filtrar
    - agente_id: ID del agente para filtrar
    - vendedor_id: ID del vendedor para filtrar
    - by: para mostrar por aseguradora, grupo, ramo, agente, vendedor

    Respuesta:
    - recordsTotal: Número total de registros enviados
    - recordsTotal_with_values: Número total de registros con val
    - data: Lista de diccionarios que contienen los datos del informe
    """
    type_report = request.form.get(
        'type_report') if request.form.get('type_report') else 'month'
    if type_report not in ['month', 'year']:
        return jsonify({'error': True, 'msg': 'Tipo de reporte no válido, debe ser "month" o "year"'})
    # type_report = 'year'
    years = request.form.get('years')
    # 2017-2025 for testing
    if years:
        years = list(map(int, years.split(',')))
    else:
        years = [datetime.now().year]
    # years=[2017,2018,2019,2020,2021,2022,2023,2024,2025]

    # start = int(request.form.get('start')
    #            ) if request.form.get('start') else None
    # length = int(request.form.get('length')
    #             ) if request.form.get('length') else None

    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')
    by = request.form.get('by') if request.form.get('by') else None

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
        total_records_query = total_records_query.filter(
            Recibo.poliza_id.in_(polizas))
    total_records_query = total_records_query.join(
        Poliza, Recibo.poliza_id == Poliza.id
    ).filter(
        func.year(Recibo.fecha_pago).in_(years)
    )

    if by:
        if by == 'aseguradora':
            total_records_query = total_records_query.add_columns(Aseguradora.aseguradora.label(
                'aseguradora')).join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id)
        elif by == 'grupo':
            total_records_query = total_records_query.add_columns(Grupo.grupo.label('grupo')).join(
                Cliente, Poliza.cliente_id == Cliente.id).join(Grupo, Cliente.grupo_id == Grupo.id)
        elif by == 'ramo':
            total_records_query = total_records_query.add_columns(
                Ramo.ramo.label('ramo')).join(Ramo, Poliza.ramo_id == Ramo.id)
        elif by == 'agente':
            total_records_query = total_records_query.add_columns(
                Agente.nombre.label('agente')).join(Agente, Poliza.agente_id == Agente.id)
        elif by == 'vendedor':
            total_records_query = total_records_query.add_columns(Vendedor.nombre.label(
                'vendedor')).join(Vendedor, Poliza.vendedor_id == Vendedor.id)
        else:
            return jsonify({'error': True, 'msg': 'Filtro "by" no válido'})

    if type_report == 'month':
        total_records_query = total_records_query.group_by(
            func.year(Recibo.fecha_pago),
            func.month(Recibo.fecha_pago)
        )
        if by:
            total_records_query = total_records_query.group_by(by,
                                                               func.year(
                                                                   Recibo.fecha_pago),
                                                               func.month(
                                                                   Recibo.fecha_pago)
                                                               ).order_by(
                func.year(Recibo.fecha_pago),
                func.month(Recibo.fecha_pago)
            )
    else:
        total_records_query = total_records_query.group_by(
            func.year(Recibo.fecha_pago)
        )
        if by:
            total_records_query = total_records_query.group_by(by,
                                                               func.year(
                                                                   Recibo.fecha_pago)
                                                               ).order_by(
                func.year(Recibo.fecha_pago)
            )

    total_records = total_records_query.count()
    """
    #This is not working due to empty years
    if not length and not start:
        records = total_records_query.all()
    else:
        records = total_records_query.limit(length).offset(start).all()
    """
    records = total_records_query.all()
    # Create empty data

    data = []
    data_index = []
    for year in years:
        if type_report == 'month':
            for month in range(1, 13):
                data.append({'year': year, 'month': month,
                            'total_prima_neta_pagada': 0})
                data_index.append((year, month))
        else:
            data.append({'year': year, 'total_prima_neta_pagada': 0})
            data_index.append(year)

    # Fill in the data with the actual values

    if not by:
        for record in records:
            if type_report == 'month':
                data_index_search = (record.year, record.month)
            else:
                data_index_search = record.year
            index_row = data_index.index(data_index_search)
            data[index_row]['total_prima_neta_pagada'] = record.total_prima_neta_pagada
    else:
        data = []
        for record in records:
            # print(record)
            new_record = {}
            new_record[by] = getattr(record, by)
            #print(new_record[by])
            if type_report == 'month':
                new_record['year'] = record.year
                new_record['month'] = record.month
            else:
                new_record['year'] = record.year
            new_record['total_prima_neta_pagada'] = record.total_prima_neta_pagada
            data.append(new_record)
        # Convert by_data to data

    # Make pagination after filling the data
    count = len(data)
    # if not length and not start:
    #   data_pag = data
    # else:
    #    data_pag = data[start:(start+length)]
    # Prepare the response
    response = {
        'recordsTotal': count,  # Total records send
        'recordsTotal_with_values': total_records,  # Total records without filtering
        'data': data  # Data to display
    }
    # export_to_csv or pdf
    if type_report == 'month':
        headers = ['year', 'month', 'total_prima_neta_pagada']
        real_headers = ['Año', 'Mes', 'Prima Neta Pagada']
    else:
        headers = ['year', 'total_prima_neta_pagada']
        real_headers = ['Año', 'Prima Neta Pagada']

    if by:
        headers.append(by)
        real_headers.append(by.capitalize())
    if request.form.get('export_csv'):
        return export_to_csv(headers, data, 'prima_neta.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = []
        title_str = "Reporte de Prima Neta Pagada " + type_report
        return export_to_pdf(headers, data, 'prima_neta.pdf', real_headers, to_multiline, title_str)
    return jsonify(response)

# polizas


@reportes_route.route('/polizas', methods=['POST', 'GET'])
@login_required
def polizas():
    """
    Punto de acceso para generar un informe de polizas agrupadas por mes o año.
    El informe puede filtrarse por aseguradora, grupo, ramo, agente y vendedor.
    El informe puede generarse para un rango de fechas específico.

    parámetros de la solicitud:
    - type_report: 'month' o 'year' (por defecto: 'month')
    - years: Lista de años para filtrar, si no se proporciona se usará el año actual
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

    # type_report = 'year'  # Default value for testing
    type_report = request.form.get(
        'type_report') if request.form.get('type_report') else 'year'
    if type_report not in ['month', 'year']:
        return jsonify({'error': True, 'msg': 'Tipo de reporte no válido, debe ser "month" o "year"'})

    # start_date = '2019-01-01'  # Default value for testing
    # end_date = '2025-12-31'  # Default value for testing
    # start_date = request.form.get('start_date')
    # end_date = request.form.get('end_date')
    years = request.form.get('years')
    if years:
        years = list(map(int, years.split(',')))
    else:
        years = [datetime.now().year]

    # start = int(request.form.get('start')
    #            ) if request.form.get('start') else None
    # length = int(request.form.get('length')
    #             ) if request.form.get('length') else None

    # aseguradora_id = None  # Default value for testing
    # grupo_id = None  # Default value for testing
    # ramo_id = None  # Default value for testing
    # agente_id = None  # Default value for testing
    # vendedor_id = None  # Default value for testing
    aseguradora_id = request.form.get('aseguradora_id')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')

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
        total_records_query = total_records_query.filter(
            Poliza.id.in_(polizas))

    total_records_query = total_records_query.filter(
        func.year(Poliza.fecha_inicio).in_(years)
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

    """
    #This is not working due to empty years
    if not length and not start:
        records = total_records_query.all()
    else:
        records = total_records_query.limit(length).offset(start).all()
    """
    records = total_records_query.all()

    # Create empty data

    data = []
    data_index = []
    for year in years:
        if type_report == 'month':
            for month in range(1, 13):
                data.append({'year': year, 'month': month,
                             'polizas_totales': 0,
                             'polizas_nuevas': 0,
                             'polizas_renovadas': 0,
                             'polizas_canceladas': 0,
                             'renovaciones': 0
                             })
                data_index.append((year, month))
        else:
            data.append({'year': year,
                         'polizas_totales': 0,
                         'polizas_nuevas': 0,
                         'polizas_renovadas': 0,
                         'polizas_canceladas': 0,
                         'renovaciones': 0
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
    new_polizas_query = total_records_query.filter(
        Poliza.poliza_anterior == None)
    new_polizas_records = new_polizas_query.all()
    for record in new_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_nuevas'] = record.total_polizas

    # Query for renewed polizas (Poliza_renovada == 'Si')
    renewed_polizas_query = total_records_query.filter(
        Poliza.Poliza_renovada == 'Si')
    renewed_polizas_records = renewed_polizas_query.all()
    for record in renewed_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_renovadas'] = record.total_polizas
    # Query for canceled polizas
    canceled_polizas_query = total_records_query.filter(
        Poliza.status == 'Cancelada')
    canceled_polizas_records = canceled_polizas_query.all()
    for record in canceled_polizas_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['polizas_canceladas'] = record.total_polizas
    # Query for renewals (has non empty poliza_anteior)
    renewals_query = total_records_query.filter(Poliza.poliza_anterior != None)
    renewals_records = renewals_query.all()
    for record in renewals_records:
        if type_report == 'month':
            data_index_search = (record.year, record.month)
        else:
            data_index_search = record.year
        index_row = data_index.index(data_index_search)
        data[index_row]['renovaciones'] = record.total_polizas

    # Make pagination after filling the data
    count = len(data)
    # if not length and not start:
    #    data_pag = data
    # else:
    #    data_pag = data[start:(start+length)]

    # Prepare the response
    response = {
        'recordsTotal': len(data),  # Total records send
        'data': data
    }
    # export_to_csv or pdf
    headers = ['year', 'month', 'polizas_totales', 'polizas_nuevas',
               'polizas_renovadas', 'polizas_canceladas', 'renovaciones']
    real_headers = ['Año', 'Mes', 'Polizas totales', 'Polizas nuevas',
                    'Polizas renovadas', 'Polizas canceladas', 'Renovaciones']
    if request.form.get('export_csv'):
        return export_to_csv(headers, data, 'polizas.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = []
        title_str = "Reporte de Polizas " + type_report
        return export_to_pdf(headers, data, 'polizas.pdf', real_headers, to_multiline, title_str)

    return jsonify(response)


@reportes_route.route('/polizas_unfilter', methods=['POST', 'GET'])
@login_required
def polizas_unfilter():
    """
    Punto de acceso para generar un informe de polizas agrupadas por mes o año.
    El informe trae toda la informacion sin filtros, pero agrupada por aseguradora, grupo, ramo, agente y vendedor.

    parámetros de la solicitud:
    - type_report: 'month' o 'year' (por defecto: 'month')
    - years: Lista de años para filtrar, si no se proporciona se usará el año actual

    Respuesta:
    - recordsTotal: Número total de registros enviados
    - data: Lista de diccionarios que contienen los datos del informe
        incluyendo polizas totales, polizas nuevas, polizas renovadas, polizas canceladas
    """

    # type_report = 'year'  # Default value for testing
    type_report = request.form.get(
        'type_report') if request.form.get('type_report') else 'year'
    if type_report not in ['month', 'year']:
        return jsonify({'error': True, 'msg': 'Tipo de reporte no válido, debe ser "month" o "year"'})

    # start_date = '2019-01-01'  # Default value for testing
    # end_date = '2025-12-31'  # Default value for testing
    # start_date = request.form.get('start_date')
    # end_date = request.form.get('end_date')
    years = request.form.get('years')
    if years:
        years = list(map(int, years.split(',')))
    else:
        years = [datetime.now().year]

    # Query the database for the count of polizas grouped by month/year
    if type_report == 'month':
        total_records_query = db.session.query(
            func.year(Poliza.fecha_inicio).label('year'),
            func.month(Poliza.fecha_inicio).label('month'),
            func.count(Poliza.id).label('total_polizas'),
            func.count(and_(Poliza.poliza_anterior == None,
                       Poliza.status != 'Cancelada')).label('polizas_nuevas'),
            func.count(Poliza.Poliza_renovada == 'Si').label(
                'polizas_renovadas'),
            func.count(Poliza.status == 'Cancelada').label(
                'polizas_canceladas'),
            func.count(and_(Poliza.poliza_anterior != None,
                       Poliza.status != 'Cancelada')).label('renovaciones')
        )
    else:
        total_records_query = db.session.query(
            func.year(Poliza.fecha_inicio).label('year'),
            func.count(Poliza.id).label('total_polizas'),
            func.count(case((and_(Poliza.poliza_anterior == None,
                       Poliza.status != 'Cancelada'), 1))).label('polizas_nuevas'),
            func.count(case((Poliza.Poliza_renovada == 'Si', 1))
                       ).label('polizas_renovadas'),
            func.count(case((Poliza.status == 'Cancelada', 1))
                       ).label('polizas_canceladas'),
            func.count(case((and_(Poliza.poliza_anterior != None,
                       Poliza.status != 'Cancelada'), 1))).label('renovaciones')
        )

    total_records_query = total_records_query.filter(
        func.year(Poliza.fecha_inicio).in_(years)
    )
    # add columns for aseguradora, grupo, ramo, agente, vendedor
    total_records_query = total_records_query.add_columns(
        Aseguradora.aseguradora.label('aseguradora'),
        Grupo.grupo.label('grupo'),
        Ramo.ramo.label('ramo'),
        Agente.nombre.label('agente'),
        Vendedor.nombre.label('vendedor')
    ).join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Grupo, Cliente.grupo_id == Grupo.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id)
    # add column to make count of polizas renovada, polizas canceladas, polizas nuevas,renovaciones
    total_records_query = total_records_query.add_columns(
    )

    if type_report == 'month':
        total_records_query = total_records_query.group_by(
            func.year(Poliza.fecha_inicio),
            func.month(Poliza.fecha_inicio),
            'aseguradora', 'grupo', 'ramo', 'agente', 'vendedor'
        ).order_by(
            func.year(Poliza.fecha_inicio),
            func.month(Poliza.fecha_inicio),
        )
    else:
        total_records_query = total_records_query.group_by(
            func.year(Poliza.fecha_inicio),
            'aseguradora', 'grupo', 'ramo', 'agente', 'vendedor'
        ).order_by(
            func.year(Poliza.fecha_inicio)
        )

    total_records = total_records_query.count()

    """
    #This is not working due to empty years
    if not length and not start:
        records = total_records_query.all()
    else:
        records = total_records_query.limit(length).offset(start).all()
    """
    records = total_records_query.all()

    # Create empty data

    data = []
    # Fill in the data with the actual values
    for record in records:
        new_record = {"aseguradora": record.aseguradora,
                      "grupo": record.grupo,
                      "ramo": record.ramo,
                      "agente": record.agente,
                      "vendedor": record.vendedor,
                      "polizas_totales": record.total_polizas,
                      "polizas_nuevas": record.polizas_nuevas,
                      "polizas_renovadas": record.polizas_renovadas,
                      "polizas_canceladas": record.polizas_canceladas,
                      "renovaciones": record.renovaciones,
                      "year": record.year}
        if type_report == 'month':
            new_record['month'] = record.month
        data.append(new_record)

    # Make pagination after filling the data
    count = len(data)
    # if not length and not start:
    #    data_pag = data
    # else:
    #    data_pag = data[start:(start+length)]

    # Prepare the response
    response = {
        'recordsTotal': len(data),  # Total records send
        'data': data
    }
    # export_to_csv or pdf
    headers = ['aseguradora', 'grupo', 'ramo', 'agente', 'vendedor', 'year',
               'polizas_totales', 'polizas_nuevas', 'polizas_renovadas',
               'polizas_canceladas', 'renovaciones']

    real_headers = ['Aseguradora', 'Grupo', 'Ramo', 'Agente', 'Vendedor', 'Año',
                    'Polizas totales', 'Polizas nuevas', 'Polizas renovadas',
                    'Polizas canceladas', 'Renovaciones']

    if type_report == 'month':
        headers.append('month')
        real_headers.append('Mes')

    if request.form.get('export_csv'):
        return export_to_csv(headers, data, 'polizas.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = []
        title_str = "Reporte de Polizas " + type_report
        return export_to_pdf(headers, data, 'polizas.pdf', real_headers, to_multiline, title_str)

    return jsonify(response)


@reportes_route.route('/polizas_preprocessed', methods=['POST', 'GET'])
@login_required
def polizas_preprocessed():
    """
    Punto de acceso para generar un informe con todas las para una lista de años,
    con la identificación de polizas nuevas, renovadas, canceladas y renovaciones.

    parámetros de la solicitud:
    - years: Lista de años para filtrar, si no se proporciona se usará el año actual

    Respuesta:
    - recordsTotal: Número total de registros enviados
    - data: Lista de diccionarios que contienen los datos del informe
        incluyendo polizas totales, polizas nuevas, polizas renovadas, polizas canceladas
    """

    years = request.form.get('years')
    if years:
        years = list(map(int, years.split(',')))
    else:
        years = [datetime.now().year]

    # Query, to get all polizas with all of its information, including aseguradora, grupo, ramo, agente, vendedor
    # and boolean values for polizas_nuevas, polizas_renovadas, polizas_canceladas, renovaciones
    # Grupin, count and filter will be handled in the front end

    total_records_query = db.session.query(Poliza,
                                           func.year(Poliza.fecha_inicio).label(
                                               'year'),
                                           func.month(Poliza.fecha_inicio).label(
                                               'month'),
                                           Aseguradora.aseguradora.label(
                                               'aseguradora'),
                                           Grupo.grupo.label('grupo'),
                                           Ramo.ramo.label('ramo'),
                                           Agente.nombre.label('agente'),
                                           Vendedor.nombre.label('vendedor'),
                                           case((and_(Poliza.poliza_anterior == None, Poliza.status != 'Cancelada'), 1), else_=0).label(
                                               'polizas_nuevas'),
                                           case((Poliza.Poliza_renovada == 'Si', 1), else_=0).label(
                                               'polizas_renovadas'),
                                           case((Poliza.status == 'Cancelada', 1), else_=0).label(
                                               'polizas_canceladas'),
                                           case((and_(Poliza.poliza_anterior != None, Poliza.status != 'Cancelada'), 1), else_=0).label(
                                               'renovaciones'),
                                           Cliente.nombre.label('nombre'),
                                           Cliente.apellido.label('apellido'),
                                           ).join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
        .join(Cliente, Poliza.cliente_id == Cliente.id) \
        .join(Grupo, Cliente.grupo_id == Grupo.id) \
        .join(Ramo, Poliza.ramo_id == Ramo.id) \
        .join(Agente, Poliza.agente_id == Agente.id) \
        .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
        .filter(func.year(Poliza.fecha_inicio).in_(years)) \
        .order_by(func.year(Poliza.fecha_inicio), func.month(Poliza.fecha_inicio))

    total_records = total_records_query.count()

    records = total_records_query.all()

    response = []

    for poliza, year, month, aseguradora, grupo, ramo, agente, vendedor, polizas_nuevas, polizas_renovadas, polizas_canceladas, renovaciones, nombre, apellido in records:

        data = {  # First report information
            'year': year,
            'month': month,
            "polizas_totales": 1,
            "polizas_nuevas": polizas_nuevas,
            "polizas_renovadas": polizas_renovadas,
            "polizas_canceladas": polizas_canceladas,
            "renovaciones": renovaciones,
            # Then filter information
            'aseguradora': aseguradora,
            'grupo': grupo,
            'ramo': ramo,
            'agente': agente,
            'status': poliza.status,
            'vendedor': vendedor,
            # Then poliza information
            # 'Poliza o Endoso': 'Poliza',
            'poliza_id': poliza.id,
            'poliza': poliza.poliza,
            'cliente': f'{nombre} {apellido}',
            'fecha_inicio': poliza.fecha_inicio.strftime('%d/%m/%y'),
            'fecha_fin': poliza.fecha_termino.strftime('%d/%m/%y'),
            'prima_neta': poliza.prima_neta,
            'prima_total': poliza.prima_total,
            'moneda': poliza.moneda  # ,
            # 'poliza_anterior': poliza.poliza_anterior,
            # 'endoso': poliza.endoso,
        }
        response.append(data)

    # Prepare the response

    # export_to_csv or pdf
    headers = ['year', 'month', 'polizas_totales', 'polizas_nuevas',
               'polizas_renovadas', 'polizas_canceladas', 'renovaciones',
               'aseguradora', 'grupo', 'ramo', 'agente',
               'poliza', 'cliente', 'fecha_inicio', 'fecha_fin',
               'prima_neta', 'prima_total', 'moneda']
    real_headers = ['Año', 'Mes', 'Total', 'Nueva',
                    'Renovada', 'Cancelada', 'Renovación',
                    'Aseguradora', 'Grupo', 'Ramo', 'Agente',
                    'Poliza', 'Cliente', 'Inicio', 'Fin',
                    'Prima Neta', 'Prima Total', 'Moneda']

    if request.form.get('export_csv'):
        #print(response)
        return export_to_csv(headers, response, 'polizas.csv', real_headers)

    if request.form.get('export_pdf'):
        to_multiline = ['cliente']
        title_str = "Reporte de Polizas "
        return export_to_pdf(headers, response, 'polizas.pdf', real_headers, to_multiline, title_str)

    return jsonify({'recordsTotal': total_records,   # Total records send
                    'data': response
                    })

@reportes_route.route('/polizas_preprocessed_compare', methods=['POST', 'GET'])
@login_required
def polizas_preprocessed_compare():
    """
    Punto de acceso para comparar las pólizas preprocesadas entre dos conjuntos de años y meses.
    Parámetros de la solicitud:
    - year1: Año del primer conjunto
    - months1: Lista de meses del primer conjunto (e.g., [1, 2])
    - year2: Año del segundo conjunto
    - months2: Lista de meses del segundo conjunto (e.g., [3, 4])

    Respuesta:
    - data: Lista de diccionarios con los resultados comparativos
    """
    # Obtener parámetros de la solicitud
    year1 = int(request.form.get('year1'))
    months1 = list(map(int, request.form.get('months1').split(',')))
    year2 = int(request.form.get('year2'))
    months2 = list(map(int, request.form.get('months2').split(',')))

    # Validar parámetros
    if not year1 or not months1 or not year2 or not months2:
        return jsonify({'error': True, 'msg': 'Debe proporcionar ambos años y listas de meses'})

    # Consultar la base de datos para los dos conjuntos de años y meses
    def query_polizas(year, months):
        query = db.session.query(
            Poliza,
            func.year(Poliza.fecha_inicio).label('year'),
            func.month(Poliza.fecha_inicio).label('month'),
            Aseguradora.aseguradora.label('aseguradora'),
            Grupo.grupo.label('grupo'),
            Ramo.ramo.label('ramo'),
            Agente.nombre.label('agente'),
            Vendedor.nombre.label('vendedor'),
            case((and_(Poliza.poliza_anterior == None, Poliza.status != 'Cancelada'), 1), else_=0).label('polizas_nuevas'),
            case((Poliza.Poliza_renovada == 'Si', 1), else_=0).label('polizas_renovadas'),
            case((Poliza.status == 'Cancelada', 1), else_=0).label('polizas_canceladas'),
            case((and_(Poliza.poliza_anterior != None, Poliza.status != 'Cancelada'), 1), else_=0).label('renovaciones'),
            Cliente.nombre.label('nombre'),
            Cliente.apellido.label('apellido')
        ).join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
         .join(Cliente, Poliza.cliente_id == Cliente.id) \
         .join(Grupo, Cliente.grupo_id == Grupo.id) \
         .join(Ramo, Poliza.ramo_id == Ramo.id) \
         .join(Agente, Poliza.agente_id == Agente.id) \
         .join(Vendedor, Poliza.vendedor_id == Vendedor.id) \
         .filter(func.year(Poliza.fecha_inicio) == year) \
         .filter(func.month(Poliza.fecha_inicio).in_(months)) \
         .order_by(func.year(Poliza.fecha_inicio), func.month(Poliza.fecha_inicio))
        return query.all()

    # Ejecutar consultas para ambos conjuntos
    records1 = query_polizas(year1, months1)
    records2 = query_polizas(year2, months2)

    # Preparar los datos para la respuesta
    response = []

    def process_records(records, group_label):
        for poliza, year, month, aseguradora, grupo, ramo, agente, vendedor, polizas_nuevas, polizas_renovadas, polizas_canceladas, renovaciones, nombre, apellido in records:
            data = {
                'year': year,
                'month': month,
                'polizas_totales': 1,
                'polizas_nuevas': polizas_nuevas,
                'polizas_renovadas': polizas_renovadas,
                'polizas_canceladas': polizas_canceladas,
                'renovaciones': renovaciones,
                'aseguradora': aseguradora,
                'grupo': grupo,
                'ramo': ramo,
                'agente': agente,
                'vendedor': vendedor,
                'cliente': f'{nombre} {apellido}',
                'poliza': poliza.poliza,
                'fecha_inicio': poliza.fecha_inicio.strftime('%d/%m/%y'),
                'fecha_fin': poliza.fecha_termino.strftime('%d/%m/%y'),
                'prima_neta': poliza.prima_neta,
                'prima_total': poliza.prima_total,
                'moneda': poliza.moneda,
                'comparison_group': group_label
            }
            response.append(data)

    process_records(records1, 'Group 1')
    process_records(records2, 'Group 2')

    # Configurar encabezados para exportar
    headers = ['year', 'month', 'polizas_totales', 'polizas_nuevas', 'polizas_renovadas', 'polizas_canceladas', 'renovaciones',
               'aseguradora', 'grupo', 'ramo', 'agente', 'vendedor', 'cliente', 'poliza', 'fecha_inicio', 'fecha_fin', 'prima_neta', 'prima_total', 'moneda', 'comparison_group']
    real_headers = ['Año', 'Mes', 'Total', 'Nueva', 'Renovada', 'Cancelada', 'Renovación',
                    'Aseguradora', 'Grupo', 'Ramo', 'Agente', 'Vendedor', 'Cliente', 'Poliza', 'Inicio', 'Fin', 'Prima Neta', 'Prima Total', 'Moneda', 'Grupo de Comparación']

    # Exportar a CSV
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'polizas_preprocessed_compare.csv', real_headers)

    # Exportar a PDF
    if request.form.get('export_pdf'):
        to_multiline = ['cliente']
        title_str = "Comparación de Pólizas Preprocesadas"
        return export_to_pdf(headers, response, 'polizas_preprocessed_compare.pdf', real_headers, to_multiline, title_str)

    # Respuesta JSON
    return jsonify({
        'recordsTotal': len(response),
        'data': response
    })

# Reporte de recibos pagados con filtros por vendedor, por aseguradora, cliente,
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

# export_pdf=true&start_date=&end_date=&aseguradora_id=20&cliente_id=&status=&grupo_id=&ramo_id=&agente_id=&vendedor_id=

    start = int(request.form.get('start')
                ) if request.form.get('start') else None
    length = int(request.form.get('length')
                 ) if request.form.get('length') else None

    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')


    # Validate and parse dates
    valid_start_date = None
    valid_end_date = None

    if start_date and len(start_date.strip()) >= 8:
        try:
            valid_start_date = datetime.strptime(start_date, '%Y-%m-%d')
        except ValueError:
            valid_start_date = None

    if end_date and len(end_date.strip()) >= 8:
        try:
            valid_end_date = datetime.strptime(end_date, '%Y-%m-%d')
        except ValueError:
            valid_end_date = None

    # Commenting out request for testing purposes
    aseguradora_id = request.form.get('aseguradora_id')
    cliente_id = request.form.get('cliente_id')
    status_recibo = request.form.get('status')
    grupo_id = request.form.get('grupo_id')
    ramo_id = request.form.get('ramo_id')
    agente_id = request.form.get('agente_id')
    vendedor_id = request.form.get('vendedor_id')

    # aseguradora_id = None  # Esta en tabla de polizas 3
    # grupo_id = None  # Esta en tabla de clientes
    # ramo_id = None # Esta en tabla de polizas
    # agente_id = None  # Esta en tabla de polizas
    # vendedor_id = None  # Esta en tabla de polizas
    # cliente_id = None

    if cliente_id and grupo_id:
        return jsonify({'error': True,
                        'msg': 'No se puede buscar por cliente y grupo al mismo tiempo'})
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
        .order_by(Recibo.fecha_inicio)

    # Apply date filters only if valid dates are provided
    if valid_start_date and valid_end_date:
        paid_recipts_query = paid_recipts_query.filter(
            Recibo.fecha_inicio >= valid_start_date,
            Recibo.fecha_inicio <= valid_end_date
        )
    elif valid_start_date:
        paid_recipts_query = paid_recipts_query.filter(Recibo.fecha_inicio >= valid_start_date)
    elif valid_end_date:
        paid_recipts_query = paid_recipts_query.filter(Recibo.fecha_inicio <= valid_end_date)

    # Apply status filter only if status_recibo is provided and not empty
    if status_recibo and status_recibo.strip():
        paid_recipts_query = paid_recipts_query.filter(Recibo.status == status_recibo)

    if polizas is not None:
        paid_recipts_query = paid_recipts_query.filter(
            Recibo.poliza_id.in_(polizas))

    total_records = paid_recipts_query.count()

    # For exports, get all records; for JSON response, apply pagination
    if request.form.get('export_csv') or request.form.get('export_pdf'):
        records = paid_recipts_query.all()
    else:
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

    headers = ['poliza', 'no_de_recibo', 'status', 'cliente', 'notas', 'ramo', 'subramo', 'aseguradora', 'fecha_inicio',
               'fecha_fin', 'prima_neta', 'prima_total', 'moneda', 'forma_pago', 'agente', 'vendedor', 'endoso', 'poliza_anterior']
    real_headers = ['poliza', 'Recibo', 'estatus', 'Nombre del cliente  ', 'Notas            ', 'Ramo', 'Subramo', 'Aseguradora',
                    'Inicio', 'Final', 'Prima Neta', 'Prima Total', 'Moneda', 'Forma de pago', 'Agente', 'Vendedor', 'Endoso', 'Anterior']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'recibos_pagados.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['cliente', 'notas']
        if valid_start_date and valid_end_date:
            title_str = "Recibos pagados en %s - %s" % (
                valid_start_date.strftime('%d/%m/%y'), valid_end_date.strftime('%d/%m/%y'))
        else:
            title_str = "Recibos pagados"
        return export_to_pdf(headers, response, 'recibos_pagados.pdf', real_headers, to_multiline, title_str)

    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })

# reporte de fecha de nacimientos de clientes con ordenamiento por columnas y
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
    - current_report: 'month' para filtrar por el mes actual, o el número del mes
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

    # Try values for testing
    # current_report = None
    # search_client_name = None
    # order_by_name = None
    # start = None
    # length = None

    if current_report:
        if current_report not in ['month', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']:
            return jsonify({'error': True, 'msg': 'Reporte actual no válido, debe ser "month" o un número de mes'})
        else:
            if current_report == 'month':
                month = datetime.now().month
            else:
                month = int(current_report)
    # Query the database, include  birth day (day/month) order by month and day
    clients_query = db.session.query(Cliente,
                                     Grupo.grupo.label('grupo_name'),
                                     func.day(Cliente.fecha_nacimiento).label(
                                         'day'),
                                     func.month(Cliente.fecha_nacimiento).label(
                                         'month'),
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

    if current_report in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']:
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
    real_headers = ['Nombre', 'Cumpleaños',
                    'Correo', 'Teléfono', 'Fecha de nacimiento']
    if request.form.get('export_csv'):
        return export_to_csv(headers, response, 'fecha_nacimientos.csv', real_headers)
    if request.form.get('export_pdf'):
        to_multiline = ['nombre']
        names_map = {1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
                     5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
                     9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'}
        title_str = "Cumpleaños" + \
            names_map[month] if current_report else "Cumpleaños"
        return export_to_pdf(headers, response, 'fecha_nacimientos.pdf', real_headers, to_multiline, title_str)
    return jsonify({
        'recordsTotal': total_records,  # Total records without filtering
        'data': response  # Data to display
    })
