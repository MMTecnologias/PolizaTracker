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

# Clase para el formulario de solicitud nueva password
class ReqNewPassForm(FlaskForm):
    username = StringField('username', validators=[DataRequired()])
    submit = SubmitField('Solicitar')



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
        print("hola")
        login_user(usuario)
        #flash('Inicio de sesión exitoso', 'success')
        return jsonify({'success': True, 'redirect': url_for('main.index')})
    
    error_message = 'Login unsuccesuful'

    return jsonify({'success': False, 'error': error_message})



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



# Ruta para cerrar sesión
@auth.route('/logout')
@login_required
def logout():
    logout_user()
    #flash('Cierre de sesión exitoso', 'success')
    return redirect(url_for('main.index'))

"""FALTA HTML finales"""

# Clase para el formulario de cambio de contraseña
class CambioContrasenaForm(FlaskForm):
    contrasena_actual= PasswordField('contrasena_actual', validators=[DataRequired()])
    nueva_contrasena = PasswordField('nueva_contrasena', validators=[DataRequired()])
    confirmar_contrasena = PasswordField('confirmPassword', validators=[DataRequired()])
    submit = SubmitField('Cambiar Contraseña')

# Ruta para cambiar la contraseña
@auth.route('/cambiar_contrasena', methods=['GET', 'POST'])
@login_required
def cambiar_contrasena():
    form = CambioContrasenaForm()

    if request.method == 'POST':
        # Verificar que la contraseña actual sea correcta
        if check_password_hash(current_user.password, form.contrasena_actual.data):
            # Generar el hash de la nueva contraseña y actualizar en la base de datos
            nuevo_hash = generate_password_hash(form.nueva_contrasena.data)
            current_user.password = nuevo_hash
            db.session.commit()
            #flash('Contraseña cambiada con éxito', 'success')
            return redirect(url_for('main.index'))
        else:
            a=1
            #flash('Contraseña actual incorrecta', 'danger')

    return render_template('cambiar_contrasena.html', form=form)



