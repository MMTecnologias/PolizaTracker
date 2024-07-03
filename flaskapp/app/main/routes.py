# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,Cliente,Grupo,TipoPago,Recibo,Ramo, Subramo, Aseguradora, Agente, Vendedor, Request,Log,new_class,new_class_edit
from sqlalchemy import join, or_,desc,func,select
import csv
from io import StringIO
from . import main
from datetime import datetime,date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased


#from sqlalchemy.exc import DataError, IntegrityError, OperationalError, SQLAlchemyError
"""  #Code to check use of rutes
from collections import defaultdict
# Dictionary to store route access counts
route_access_counts = defaultdict(int)
route_access_counts_2 = {}

@app.before_request
def track_route_access():
    # Increment access count for the requested route
    if str(request.path) in route_access_counts_2.keys():
        route_access_counts[request.path] += 1

@main.route('/see', methods=['GET'])
@login_required
def see():
    return route_access_counts

@main.route('/see2', methods=['GET'])
@login_required
# Function to get all registered routes
def see2():
    for rule in app.url_map.iter_rules():
        route_access_counts_2[rule.rule] = 0
    return route_access_counts_2
 """

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
"""Funciones generales"""

def check_access(nombre_del_servicio):
    # Verificar si el usuario tiene acceso al servicio "Editar Usuarios"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()
    if not acceso:
        return False
    return True

"""Renderiza htmls"""

#Utilerias
@main.route('/utilerias', methods=['GET'])
@login_required
def utilerias():
    return render_template('utilerias.html',user=current_user)

#Utilerias
@main.route('/vencimientos', methods=['GET'])
@login_required
def vencimientos():
    return render_template('vencimientos.html',user=current_user)

#Recibos
@main.route('/recibos', methods=['GET'])
@login_required
def recibos():
    polizas=Poliza.query.all()
    return render_template('recibos.html',polizas=polizas)


#Clientes
@main.route('/cliente', methods=['GET'])
@login_required
def cliente():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    grupos=Grupo.query.all()
    return render_template('clientes.html', user=current_user,grupos=grupos)

#Polizas
@main.route('/polizas', methods=['GET'])
@login_required
def polizas():
    ramos=Ramo.query.all()
    subramos=Subramo.query.all()
    pagos=TipoPago.query.all()
    aseguradoras=Aseguradora.query.all()
    agentes=Agente.query.all()
    vendedores=Vendedor.query.all()
    return render_template('polizas.html', user=current_user,ramos=ramos,subramos=subramos,pagos=pagos,aseguradoras=aseguradoras,agentes=agentes,vendedores=vendedores)

# Ruta usuarios
@main.route('/usuario', methods=['GET'])
@login_required
def usuario():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    niveles = NivelAcceso.query.all()
    return render_template('usuario.html', user=current_user,niveles =niveles)


# Ruta principal del sistema
@main.route('/')
@login_required
def index():
    acceso=NivelAcceso.query.get_or_404(current_user.nivel_id)

    return render_template('menuP.html', user=current_user,acceso=acceso.nombre)

#Solicitudes
@main.route('/solicitudes', methods=['GET'])
@login_required
def solicitudes():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    grupos=Grupo.query.all()
    return render_template('solicitudes.html', user=current_user,grupos=grupos)


"""Rutas simples"""
#Ruta de grupos
@main.route('/grupo', methods=['GET'])
@login_required
def grupo():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    grupos= db.session.query(Grupo).all()

    data = []
    for grupo in grupos:
        data.append({
            'id': grupo.id,
            'nombre': grupo.grupo,
        })
    return jsonify(data)




@main.route('/create_multiple', methods=['POST'])
@login_required
def create_multiple():
    tipo = request.form.get('tipo')
    nombre=request.form.get('nombre')
    form_id = request.form.get('form_id') if request.form.get('form_id') else "New"

    clases={"Aseguradora":Aseguradora,
            "Agente":Agente,
            "Vendedor":Vendedor}
    colnames={"Aseguradora":"aseguradora",
            "Agente":"nombre",
            "Vendedor":"nombre"}
    if tipo not in clases.keys():
        return jsonify({"error":True,"msg": "No se encuentra el tipo de elemento"})


    dict_return=new_class_edit(clases[tipo],form_id ,nombre,colnames[tipo])

    return jsonify(dict_return)

#@main.route('/get_data_multiple', methods=['GET'])
@main.route('/get_data_multiple', methods=['POST'])
@login_required
def get_data_multiple():
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    #start = 0
    #length = 2
    clases={"Aseguradora":Aseguradora,
            "Agente":Agente,
            "Vendedor":Vendedor}
    response={}
    for key,tabla in clases.items():
        query=tabla.query.order_by(tabla.id.desc())  # Order by id in descending order
        total_records = query.count()
        # Apply pagination
        records = query.offset(start).limit(length).all()
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

