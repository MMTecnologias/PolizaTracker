# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,Cliente,Grupo,TipoPago,Recibo,Ramo, Subramo, Aseguradora, Agente, Vendedor, Request,Log,new_class
from sqlalchemy import join, or_,desc,func,select
import csv
from io import StringIO
from . import solicitudes_route
from datetime import datetime,date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased




def revert_logs_from_request(request):
    """
    Apply changes to the database based on the information in the log entry.
    """
    log_entries = Log.query.filter_by(request_id=request.id).all()

    table_class=globals()[request.table_name]
    record = table_class.query.get(request.row_id)
    for log_entry in log_entries:
        # Update the corresponding attribute with the new value
        setattr(record, log_entry.column_name, log_entry.old_value)
        # Commit the changes to the database
    db.session.commit()

@solicitudes_route.route('/process', methods=['POST'])
@login_required
def process():

    request_id = request.form.get('request_id')
    action = request.form.get('action')

    # Get the request
    request_entry = Request.query.get(request_id)
    if not request_entry:
        return  jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró la solicitud.'})

    if request_entry.status!="Pendiente":
        return  jsonify({'error': True, 'title': 'Error', 'msg': 'Esta solicitud ya fue revisada.'})

    # Check if the action is valid
    if action not in ['Aceptada', 'Rechazada']:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'Accion invalida.'})

    if action == 'Aceptada':
        # Update the status of the request to 'Aceptada'
        request_entry.status = 'Aceptada'
        request_entry.usuario_review_id = current_user.id
        db.session.commit()

        return jsonify({'error': False, 'title': 'Solicitud Aceptada', 'msg': ''})

    elif action == 'Rechazada':
        # Update the status of the request to 'Rechazada'
            # Apply the changes based on the log entries
        revert_logs_from_request(request_entry)
        request_entry.status = 'Rechazada'
        request_entry.usuario_review_id = current_user.id
        db.session.commit()
        return jsonify({'error': False, 'title': 'Solicitud Rechazada', 'msg': 'Cambios revertidos'})

@solicitudes_route.route('/get_pending', methods=['GET'])
@login_required
def get_pending():
    # Estos datos los recibe desde la función en JS
    #start = request.form.get('start')
    #length = request.form.get('length')

    #start = int(start) if start else 0
    #length = int(length) if length else 20

    start=0
    length=20

    # Query to fetch clientes data from the database
    request_query = db.session.query(Request, Usuario.nombre.label('usuario_nombre'), Usuario.apellido.label('usuario_apellido')).join(Usuario, Request.usuario_id == Usuario.id).filter(Request.status == 'Pendiente')

    # Get total count of records without filtering
    total_records = request_query.count()
    # Apply pagination
    requests = request_query.offset(start).limit(length).all()

    # Format data
    data = []
    
    for request, usuario_nombre,usuario_apellido in requests:
        
        data.append({
            'id': request.id,
            'usuario': f"{usuario_nombre} {usuario_apellido}",
            'timestamp': request.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'descripcion': request.description +' - '+request.notas if request.notas else request.description,
        })

    # Prepare response
    response = {
        'recordsTotal': total_records,  # Total records without filtering
        'data': data  # Data to display
    }
    return jsonify(response)

@solicitudes_route.route('/get_all', methods=['POST'])
@login_required
def get_all():
    # Estos datos los recibe desde la función en JS
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    #start = 0
    #length = 500
    UsuarioReview = aliased(Usuario)
    # Query to fetch clientes data from the database
    request_query = db.session.query(Request,
                                     Usuario.nombre.label('usuario_nombre'),
                                     Usuario.apellido.label('usuario_apellido'),
                                     UsuarioReview.nombre.label('reviso_nombre'),
                                     UsuarioReview.apellido.label('reviso_apellido'))\
                                .join(Usuario, Request.usuario_id == Usuario.id)\
                                .outerjoin(UsuarioReview, Request.usuario_review_id == UsuarioReview.id)\
                                .order_by(Request.id.desc())

    # Get total count of records without filtering
    total_records = request_query.count()
    # Apply pagination
    requests = request_query.offset(start).limit(length).all()

    # Format data
    data = []
    for request, usuario_nombre,usuario_apellido,reviso_nombre,reviso_apellido in requests:
        data.append({
            'id': request.id,
            'usuario': f"{usuario_nombre} {usuario_apellido}",
            'reviso': f"{reviso_nombre} {reviso_apellido}",
            'timestamp': request.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'descripcion': request.description,
            'row_id':request.row_id,
            'table_name':request.table_name,
            'status':request.status
        })

    # Prepare response
    response = {
        'recordsTotal': total_records,  # Total records without filtering
        'data': data  # Data to display
    }

    return jsonify(response)


@solicitudes_route.route('/logs', methods=['POST'])
@login_required
def logs():

    start = request.form.get('start')
    length = request.form.get('length')

    start = int(start) if start else 0
    length = int(length) if length else 20

    request_id = int(request.form.get('request_id'))

    log_query=Log.query.filter_by(request_id=request_id)

    # Get total count of records without filtering
    total_records = log_query.count()
    # Apply pagination
    logs = log_query.offset(start).limit(length).all()

    # Format data
    data = []

    request = Request.query.get(request_id)
    if not request:
        return  jsonify({
        'recordsTotal': 0,  # Total records without filtering
        'data': []  # Data to display
         })

    for log in logs:
        # Extracting all columns from the Poliza object
        log_data = {}
        # Iterate through each column in the Poliza table
        for column in Log.__table__.columns:
            # Get the value of the column
            value = getattr(log, column.name)
            # Add column name and corresponding value to poliza_data dictionary
            log_data[column.name] = value

        # Append additional information
        #log_data.update({})

        # Append to data list
        data.append(log_data)


    # Prepare response
    response = {
        'descripcion': request.description,
        'status':request.status,
        'recordsTotal': total_records,  # Total records without filtering
        'data': data  # Data to display
    }

    return jsonify(response)



