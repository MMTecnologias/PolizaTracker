# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,SelectField,DateField,EmailField
from wtforms.validators import DataRequired,Email,InputRequired,Length
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,SolicitudNewPass,Cliente,Grupo
from sqlalchemy import join, or_,desc
import csv
from io import StringIO
from . import main 

#from sqlalchemy.exc import DataError, IntegrityError, OperationalError, SQLAlchemyError

def check_access(nombre_del_servicio):
    # Verificar si el usuario tiene acceso al servicio "Editar Usuarios"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()
    if not acceso:
        return False
    return True


"""Clientes"""

@main.route('/cliente', methods=['GET'])
@login_required
def cliente():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    grupos=Grupo.query.all()
    return render_template('clientes.html', user=current_user,grupos=grupos)

@main.route('/create_client', methods=['POST'])
def create_client():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    cliente_id = request.form.get('cliente_id')
    rfc = request.form.get('rfc')
    add_group_opt=False
    new_group_id=0
    new_group_name=""

    # If cliente_id is "New", then it's a new client creation
    if cliente_id == "New":
        rfc = request.form.get('rfc')
        # Check if a client with the given RFC already exists
        existing_client = Cliente.query.filter_by(rfc=rfc).first()
        if existing_client:
            return jsonify({'error': True, 'msg': "Ya existe un cliente con ese RFC, intente de nuevo"})
        else:
            grupo_id=request.form.get('grupo')
            if grupo_id =="New":
                    # Handle creating a new group here
                    nuevo_grupo = request.form.get('nuevo_grupo')
                    grupo_existente = Grupo.query.filter_by(grupo=nuevo_grupo).first()
                    if grupo_existente:
                        grupo_id=grupo_existente.id
                    else:
                        nuevo_grupo = Grupo(grupo=nuevo_grupo)
                        db.session.add(nuevo_grupo)
                        db.session.commit()
                        grupo_id=nuevo_grupo.id
                        add_group_opt=True
                        new_group_id=grupo_id
                        new_group_name=nuevo_grupo.grupo

            # Create a new client
            new_client = Cliente(
                nombre=request.form.get('nombre'),
                apellido=request.form.get('apellido'),
                grupo_id=grupo_id,
                rfc=rfc,
                tel_oficina=request.form.get('telefono_oficina'),
                tel_movil=request.form.get('telefono_movil'),
                tel_casa=request.form.get('telefono_casa'),
                correo=request.form.get('correo'),
                direccion=request.form.get('direccion_fiscal'),
                fecha_nacimiento=request.form.get('fecha_nacimiento'),
                sexo=request.form.get('sexo'),
                ocupacion=request.form.get('ocupacion'),
                actividad=request.form.get('giro_actividad')
            )
            # Save the new client to the database
            db.session.add(new_client)
            db.session.commit()

            return jsonify({
                'error': False,
                'redirect': url_for('main.cliente'),
                'msg': '',
                'title':'Cliente registrado exitosamente',
                'add_group_opt':add_group_opt,
                'new_group_id':new_group_id,
                'new_group_name':new_group_name
            })
    else:
        # If cliente_id is not "New", then it's an existing client editing
        cliente_id = int(cliente_id)
        # Get the existing client and update its data
        existing_client = Cliente.query.get(cliente_id)
        if existing_client:
            grupo_id=request.form.get('grupo')
            if grupo_id =="New":
                    # Handle creating a new group here
                    nuevo_grupo = request.form.get('nuevo_grupo')
                    grupo_existente = Grupo.query.filter_by(grupo=nuevo_grupo).first()
                    if grupo_existente:
                        grupo_id=grupo_existente.id
                    else:
                        nuevo_grupo = Grupo(grupo=nuevo_grupo)
                        db.session.add(nuevo_grupo)
                        db.session.commit()
                        grupo_id=nuevo_grupo.id
                        add_group_opt=True
                        new_group_id=grupo_id
                        new_group_name=nuevo_grupo.grupo


            existing_client.nombre = request.form.get('nombre')
            existing_client.apellido = request.form.get('apellido')
            existing_client.grupo_id = grupo_id
            existing_client.tel_oficina = request.form.get('telefono_oficina')
            existing_client.tel_movil = request.form.get('telefono_movil')
            existing_client.tel_casa = request.form.get('telefono_casa')
            existing_client.correo = request.form.get('correo')
            existing_client.direccion = request.form.get('direccion_fiscal')
            existing_client.fecha_nacimiento = request.form.get('fecha_nacimiento')
            existing_client.sexo = request.form.get('sexo')
            existing_client.ocupacion = request.form.get('ocupacion')
            existing_client.actividad = request.form.get('giro_actividad')
            # Save the changes to the database
            db.session.commit()

            return jsonify({
                'error': False,
                'redirect': url_for('main.cliente'),
                'msg': '',
                'title':'Cambios realizados exitosamente',
                'add_group_opt':add_group_opt,
                'new_group_id':new_group_id,
                'new_group_name':new_group_name
            })
        else:
            # Handle the case where the client does not exist
            return jsonify({'error': True, 'msg': 'Cliente no encontrado'})

@main.route('/get_clients_data', methods=['POST'])
def get_clients_data():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    # Get parameters from DataTables AJAX request
    draw = int(request.form.get('draw'))
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('search[value]')
    order_column_index = int(request.form.get('order[0][column]'))
    order_dir = request.form.get('order[0][dir]')

    # Query to fetch clientes data from the database 
    clients_query = db.session.query(Cliente, Grupo.grupo.label('grupo_name')).join(Grupo).filter(Cliente.status == 'Activo')

    # Implement search functionality
    if search_value:
        clients_query = clients_query.filter(or_(
            Cliente.nombre.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%'),
            Cliente.correo.ilike(f'%{search_value}%'),
            # Add more fields for searching as needed
        ))

    # Implement sorting functionality
    order_column_name = None
    if order_column_index == 0:
        order_column_name = 'nombre'
    elif order_column_index == 1:
        order_column_name = 'correo'
    elif order_column_index == 2:
        order_column_name = 'tel_movil'

    if order_column_name:
        if order_dir == 'desc':
            clients_query = clients_query.order_by(desc(order_column_name))
        else:
            clients_query = clients_query.order_by(order_column_name)



    # Get total count of records without filtering
    total_records = clients_query.count()
    
    # Apply pagination
    clients = clients_query.offset(start).limit(length).all()

    # Format data as required by DataTables
    data = []
    for client, grupo_name in clients:
        data.append({
            'id': client.id,
            'nombre': client.nombre,
            'grupo_id': client.grupo_id,
            'grupo': grupo_name,
            'rfc': client.rfc,
            'tel_oficina': client.tel_oficina,
            'tel_movil': client.tel_movil,
            'tel_casa': client.tel_casa,
            'correo': client.correo,
            'direccion': client.direccion,
            'fecha_nacimiento': client.fecha_nacimiento.strftime('%Y-%m-%d'), # Format date as string
            'sexo': client.sexo,
            'ocupacion': client.ocupacion,
            'actividad': client.actividad,
            'apellido': client.apellido,
            'fullname': f"{client.nombre} {client.apellido}"  # Full name
        })

    # Prepare response
    response = {
        'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }

    return jsonify(response)

@main.route('/delete_client', methods=['POST'])
def delete_client():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    client_id = int(request.form.get('client_id'))

    client = Cliente.query.get(client_id)
    if client:
        # Update the user's status to "Eliminado"
        client.status = "Eliminado"
        db.session.commit()
        return jsonify({'error': False, 'title': 'Cliente eliminado', 'msg': 'El cliente ha sido eliminado con éxito.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el cliente.'})


@main.route('/export_clients')
def export_clients():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    headers = ['nombre',
                'apellido',
                'rfc',
                'tel_oficina',
                'tel_movil',
                'tel_casa',
                'correo',
                'direccion',
                'fecha_nacimiento',
                'sexo',
                'ocupacion',
                'actividad',
                'grupo',
                'status']
    clients_query = db.session.query(Cliente, Grupo.grupo.label('grupo_name')).join(Grupo)
    clients_data = clients_query.all()
    def generate():
        f = StringIO()
        f.seek(0)
        f.write(u'\uFEFF')
        writer = csv.writer(f)
        writer.writerow(tuple(headers))


        # Write rows
        for client, grupo_name in clients_data:
            row = [
                client.nombre,
                client.apellido,
                client.rfc,
                client.tel_oficina,
                client.tel_movil,
                client.tel_casa,
                client.correo,
                client.direccion,
                client.fecha_nacimiento.strftime('%Y-%m-%d'),
                client.sexo,
                client.ocupacion,
                client.actividad,
                grupo_name,
                client.status
            ]
            writer.writerow(tuple(row))
            yield f.getvalue()
            f.seek(0)
            f.truncate(0)

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition", "attachment", filename='clientes.csv')
    return response



"""Usuarios"""
# Ruta usuarios
@main.route('/usuario', methods=['GET'])
@login_required
def usuario():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    niveles = NivelAcceso.query.all()
    return render_template('usuario.html', user=current_user,niveles =niveles)

@main.route('/get_usuarios_data', methods=['POST'])
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


@main.route('/create_user', methods=['POST'])
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

@main.route('/delete_user', methods=['POST'])
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

@main.route('/export_users')
def export_users():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    headers = ['nombre',
                'apellido',
                'correo',
                'telefono',
                'usuario',
                'acceso',
                'status']
    users_query = db.session.query(Usuario, NivelAcceso.nombre.label('acceso')).join(NivelAcceso)
    users_data = users_query.all()
    def generate():
        f = StringIO()
        f.seek(0)
        f.write(u'\uFEFF')
        writer = csv.writer(f)
        writer.writerow(tuple(headers))


        # Write rows
        for user, acceso in users_data:
            row = [
                user.nombre,
                user.apellido,
                user.correo,
                user.telefono,
                user.username,
                acceso,
                user.status
            ]
            writer.writerow(tuple(row))
            yield f.getvalue()
            f.seek(0)
            f.truncate(0)

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition", "attachment", filename='usuarios.csv')
    return response


"""Polizas"""
# Ruta usuarios
@main.route('/polizas', methods=['GET'])
@login_required
def polizas():
    return render_template('polizas.html', user=current_user)

"""Menu"""
# Ruta principal del sistema
@main.route('/')
@login_required
def index():
    acceso=NivelAcceso.query.get_or_404(current_user.nivel_id)

    return render_template('menuP.html', user=current_user,acceso=acceso.nombre)


