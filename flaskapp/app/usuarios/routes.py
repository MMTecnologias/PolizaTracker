# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,Cliente,Grupo,TipoPago,Recibo,Ramo, Subramo, Aseguradora, Agente, Vendedor, Request,Log,new_class
from sqlalchemy import join, or_,desc,func,select
import csv
from io import StringIO
from . import usuarios_route 
from datetime import datetime,date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased



@usuarios_route.route('/get', methods=['POST'])
@login_required
def get():
    
    # Estos datos los recibe desde la función en JS
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('searchValue')
    order=bool(request.form.get('order'))
    usuario_id=request.form.get('usuario_id')

    # Query to fetch clientes data from the database 
    usuarios_query = Usuario.query.filter_by(status='Activo')

    # Implement search functionality
    if order:
        usuarios_query = usuarios_query.order_by('nombre')

    if search_value:
        usuarios_query = usuarios_query.filter(or_(
            Usuario.nombre.ilike(f'%{search_value}%'),
            Usuario.apellido.ilike(f'%{search_value}%'),
            Usuario.correo.ilike(f'%{search_value}%')
            # Add more fields for searching as needed
        ))
    
    if usuario_id:
        usuarios_query = usuarios_query.filter(Usuario.id==int(usuario_id))

    # Get total count of records without filtering
    total_records = usuarios_query.count()
    
    # Apply pagination
    usuarios = usuarios_query.offset(start).limit(length).all()

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
            'acceso': NivelAcceso.query.get(usuario.nivel_id).nombre,
            'nivel_id':usuario.nivel_id
            # Add more fields as needed
        })

    # Prepare response
    response = {
        'recordsTotal': total_records,
        'data': data  # Data to display
    }

    return jsonify(response)
    
#modify log
@usuarios_route.route('/create', methods=['POST'])
@login_required
def create():
    user_id = request.form.get('usuario_id')
    if not user_id:
        return jsonify({'error': True,
                            'msg':"Hace falta enviar usuario_id"})
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

            request_entry = Request(usuario_id=current_user.id, 
                                    description=f"Crear Usuario {new_user.nombre} {new_user.apellido}",
                                    status="Aceptada",
                                    table_name='Usuario', 
                                    row_id=new_user.id)
            db.session.add(request_entry)
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

            old_dict={column.name : getattr(existing_user, column.name) for column in Usuario.__table__.columns}
            
            existing_user.username = request.form.get('username')
            existing_user.nombre = request.form.get('nombre')
            existing_user.apellido = request.form.get('apellido')
            existing_user.correo = request.form.get('email')
            existing_user.telefono = request.form.get('cel')
            #existing_user.nivel_id = request.form.get('acceso')
            db.session.commit()

            new_dict={column.name : getattr(existing_user, column.name) for column in Usuario.__table__.columns}
            
            request_entry = Request(usuario_id=current_user.id, 
                                    description=f"Editar Usuario {existing_user.nombre} {existing_user.apellido}",
                                    status="Aceptada",
                                    table_name='Usuario', 
                                    row_id=existing_user.id)
            db.session.add(request_entry)
            db.session.commit()

            for col,value in new_dict.items():
                if value!=old_dict[col]:
                    log_entry = Log(request_id=request_entry.id,
                                    column_name=col, 
                                    old_value=old_dict[col], 
                                    new_value=value)
                    db.session.add(log_entry)
            db.session.commit() 


            title = "Cambios realizados con éxito"
            return jsonify({'error': False, 'redirect': url_for('main.usuario'), 'msg': '', 'title': title})
        else:
            # Manejar el caso en el que el usuario no exista
            return jsonify({'error': True, 'msg': 'Usuario no encontrado'})

#check
@usuarios_route.route('/delete', methods=['POST'])
@login_required
def delete():

    user_id = request.form.get('user_id')

    if int(current_user.id) == int(user_id):
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No puedes eliminar tu usuario.'})

    user = Usuario.query.get(user_id)
    if user:
        # Update the user's status to "Eliminado"
        user.status = "Eliminado"
        db.session.commit()
        request_entry = Request(usuario_id=current_user.id, 
                                description=f"Eliminar usuario {user.nombre} {user.apellido}",
                                table_name='Usuario', 
                                row_id=user.id,
                                status="Aceptada")
        db.session.add(request_entry)
        db.session.commit()
        return jsonify({'error': False, 'title': 'Usuario eliminado', 'msg': 'El usuario ha sido eliminado con éxito.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el usuario.'})

