# app/auth/routes.py
from flask import render_template, redirect, url_for, flash, request,jsonify
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,SelectField
from wtforms.validators import DataRequired
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,SolicitudNewPass
from . import auth

"""Login"""
# Ruta para iniciar sesión
@auth.route('/login', methods=['GET'])#, 'POST'])
def login():
    if current_user.is_authenticated:
        # Si ya ha iniciado sesión, redireccionar a la página principal u otra página
        return redirect(url_for('main.index'))
    return render_template('login2.html')#, form=form)


@auth.route('/login_ajax', methods=['POST'])
def login_ajax():
    if current_user.is_authenticated:
        # If user is already authenticated, redirect to the main page
        return jsonify({'success': False, 'redirect': url_for('main.index')})

    username = request.form.get('username')
    password = request.form.get('password')
    usuario = Usuario.query.filter_by(username=username,status='Activo').first()

    if usuario and check_password_hash(usuario.password, password):
        login_user(usuario)
        #flash('Inicio de sesión exitoso', 'success')
        return jsonify({'success': True, 'redirect': url_for('main.index')})
    
    error_message = 'Login unsuccesuful'

    return jsonify({'success': False, 'error': error_message})


"""Olvidaste la contra"""
@auth.route('/forgotpass_ajax', methods=['POST'])
def forgotpass_ajax():

    response={'correctuser': True, "new":True ,'redirect': url_for('auth.login')}

    username = request.form.get('username')
    usuario = Usuario.query.filter_by(username=username,status='Activo').first()

    if usuario:
        prevregistro= SolicitudNewPass.query.filter_by(usuario_id=usuario.id).first()
        if prevregistro:
            if prevregistro.status=="Pendiente":
                response["new"]=False
                return jsonify(response)
            prevregistro.status="Pendiente"
            db.session.commit()
            return jsonify(response)
        nuevo_registro = SolicitudNewPass(usuario_id=usuario.id)
        db.session.add(nuevo_registro)
        db.session.commit()
        return jsonify(response)
    else:
        response["correctuser"]=False
    return jsonify(response)

# Ruta para pedir un cambio de contrasena
@auth.route('/req_new_pass', methods=['GET'])#, 'POST'])
def req_new_pass():
    if current_user.is_authenticated:
        # Si ya ha iniciado sesión, redireccionar a la página principal u otra página
        return redirect(url_for('main.index'))
    return render_template('forgotpass.html')


"""Logout"""
# Ruta para cerrar sesión
@auth.route('/logout')
@login_required
def logout():
    logout_user()
    #flash('Cierre de sesión exitoso', 'success')
    return redirect(url_for('main.index'))

"""Editar usuario/cambiar contrasena"""
# Ruta para cambiar la contraseña
@auth.route('/cambiar_contrasena', methods=['GET'])
@login_required
def cambiar_contrasena():
    return render_template('editar_usuario_actual.html', user=current_user)

@auth.route('/edit_cuser', methods=['POST'])
def edit_cuser():
    oldpass=request.form.get('passwordold')
    newpass=request.form.get('password')
    if check_password_hash(current_user.password, oldpass):
        existing_user = Usuario.query.get(current_user.id)

        existing_user.nombre = request.form.get('nombre')
        existing_user.apellido = request.form.get('apellido')
        existing_user.correo = request.form.get('email')
        existing_user.telefono = request.form.get('cel')
        existing_user.password=generate_password_hash(newpass)

        db.session.commit()
        title = "Cambios realizados con éxito"
        return jsonify({'error': False, 'redirect': url_for('main.index'), 'msg': '', 'title': title})
    else:
        return jsonify({'error': True, 'msg': 'Contraseña actual incorrecta'})


