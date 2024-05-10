# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,Cliente,Grupo,TipoPago,Recibo,Ramo, Subramo, Aseguradora, Agente, Vendedor, Request,Log
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




"""Usuarios"""
# Ruta usuarios
@main.route('/usuario', methods=['GET'])
@login_required
def usuario():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    niveles = NivelAcceso.query.all()
    return render_template('usuario.html', user=current_user,niveles =niveles)

#modify
@main.route('/get_usuarios_data', methods=['POST'])
@login_required
def get_usuarios_data():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    # Get parameters from DataTables AJAX request
    draw = request.form.get('draw')
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('search[value]')
    order_column_index = int(request.form.get('order[0][column]'))
    order_dir = request.form.get('order[0][dir]')


    # Query to fetch usuarios data from the database
    usuarios_query = Usuario.query.filter_by(status='Activo')

    # Implement search functionality
    if search_value:
        usuarios_query = usuarios_query.filter(or_(
            Usuario.nombre.ilike(f'%{search_value}%'),
            Usuario.apellido.ilike(f'%{search_value}%'),
            Usuario.correo.ilike(f'%{search_value}%')
        ))

    # Implement sorting functionality
    order_column_name = None
    if order_column_index == 0:
        order_column_name = 'nombre'
    elif order_column_index == 1:
        order_column_name = 'correo'

    if order_column_name:
        if order_dir == 'desc':
            usuarios_query = usuarios_query.order_by(desc(order_column_name))
        else:
            usuarios_query = usuarios_query.order_by(order_column_name)

    # Get total count of records without filtering
    total_records = usuarios_query.count()

    # Apply pagination
    usuarios = usuarios_query.offset(start).limit(length).all()

    # Query to fetch usuarios data from the database
    usuarios = usuarios_query.offset(start).limit(length).all()

    # Format data as required by DataTables
    data = []
    for usuario in usuarios:
        name=usuario.nombre
        lastname=usuario.apellido
        data.append({
            'id': usuario.id,
            'fullname': f"{name} {lastname}",
            'correo': usuario.correo,
            'username': usuario.username,
            'telefono': usuario.telefono,
            'nombre': name,
            'apellido': lastname,
            'acceso': usuario.nivel_id,
            # Add more fields as needed
        })

    # Prepare response
    response = {
        'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }

    return jsonify(response)

#check
@main.route('/get_usuarios_data2', methods=['GET'])
@login_required
def get_usuarios_data2():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    # Get parameters from DataTables AJAX request


    usuarios_query = Usuario.query.filter_by(status='Activo')


    # Get total count of records without filtering
    total_records = usuarios_query.count()


    # Apply pagination
    usuarios = usuarios_query.all()


    # Query to fetch usuarios data from the database
    usuarios = usuarios_query.all()


    # Format data as required by DataTables
    data = []
    for usuario in usuarios:
        name=usuario.nombre
        lastname=usuario.apellido
        data.append({
            'id': usuario.id,
            'fullname': f"{name} {lastname}",
            'correo': usuario.correo,
            'username': usuario.username,
            'telefono': usuario.telefono,
            'nombre': name,
            'apellido': lastname,
            'acceso': usuario.nivel_id,
            # Add more fields as needed
        })


    # Prepare response
    response = {
        'data': data  # Data to display
    }


    return jsonify(response)



#check
@main.route('/create_user', methods=['POST'])
@login_required
def create_user():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    user_id = request.form.get('usuario_id')

    # Si user_id es "New", entonces es una creación de usuario
    if user_id == "New":
        username = request.form.get('username')
        # Verificar si el nombre de usuario ya existe
        existing_user = Usuario.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': True,
                            'msg':"Ese usuario ya existe, intente de nuevo con otro usuario"})
        else:
            # Crear un nuevo usuario
            new_user = Usuario(
                username=username,
                password=generate_password_hash(request.form.get('password')),
                nombre=request.form.get('nombre'),
                apellido=request.form.get('apellido'),
                correo=request.form.get('email'),
                telefono=request.form.get('cel'),
                nivel_id=request.form.get('acceso')
            )
            # Guardar el nuevo usuario en la base de datos
            db.session.add(new_user)
            db.session.commit()

            # Mensaje para el usuario
            msg = f"{request.form.get('email')}\n"
            msg += f"{request.form.get('nombre')}, ¡bienvenido al equipo!\n"
            msg += "Usa las siguientes credenciales para entrar a nuestro sistema:\n"
            msg += f"Usuario: {username}\n Contraseña: {request.form.get('password')}\n"
            msg += "Recuerda cambiar tu contraseña"
            title = "Usuario añadido, envia las credenciales al usuario"
            return jsonify({'error': False, 'redirect': url_for('main.usuario'), 'msg': msg, 'title': title})
    else:
        # Si user_id no es "New", entonces es una edición de usuario
        user_id = int(user_id)
        # Obtener el usuario existente y actualizar sus datos
        existing_user = Usuario.query.get(user_id)
        if existing_user:
            existing_user.username = request.form.get('username')
            existing_user.nombre = request.form.get('nombre')
            existing_user.apellido = request.form.get('apellido')
            existing_user.correo = request.form.get('email')
            existing_user.telefono = request.form.get('cel')
            #existing_user.nivel_id = request.form.get('acceso')
            db.session.commit()
            title = "Cambios realizados con éxito"
            return jsonify({'error': False, 'redirect': url_for('main.usuario'), 'msg': '', 'title': title})
        else:
            # Manejar el caso en el que el usuario no exista
            return jsonify({'error': True, 'msg': 'Usuario no encontrado'})

#check
@main.route('/delete_user', methods=['POST'])
@login_required
def delete_user():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    user_id = request.form.get('user_id')

    if int(current_user.id) == int(user_id):
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No puedes eliminar tu usuario.'})

    user = Usuario.query.get(user_id)
    if user:
        # Update the user's status to "Eliminado"
        user.status = "Eliminado"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Usuario eliminado', 'msg': 'El usuario ha sido eliminado con éxito.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el usuario.'})



@main.route('/create_multiple', methods=['POST'])
@login_required
def create_multiple():
    tipo = request.form.get('tipo')
    nombre=request.form.get('nombre')
    clases={"Aseguradora":Aseguradora,
            "Agente":Agente,
            "Vendedor":Vendedor}
    colnames={"Aseguradora":"aseguradora",
            "Agente":"nombre",
            "Vendedor":"nombre"}
    if tipo not in clases.keys():
        return jsonify({"error":True})
    
    new_record_id=new_class(clases[tipo],"New" ,nombre,colnames[tipo])

    return jsonify({"error":True,"record_id":new_record_id})

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
        query=tabla.query
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

