# app/auth/routes.py
from flask import render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,SelectField
from wtforms.validators import DataRequired
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,SolicitudNewPass
from . import auth

# Clase para el formulario de inicio de sesión
class LoginForm(FlaskForm):
    username = StringField('username', validators=[DataRequired()])
    password = PasswordField('password', validators=[DataRequired()])
    submit = SubmitField('Iniciar Sesión')

# Clase para el formulario de solicitud nueva password
class ReqNewPassForm(FlaskForm):
    username = StringField('username', validators=[DataRequired()])
    submit = SubmitField('Solicitar')


# Ruta para iniciar sesión
@auth.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()

    if request.method == 'POST':
        # Buscar el usuario en la base de datos por nombre de usuario
        usuario = Usuario.query.filter_by(username=form.username.data).first()

        #print(form.username.data)
        #print(form.password.data)
        if usuario and check_password_hash(usuario.password, form.password.data):
            login_user(usuario)
            flash('Inicio de sesión exitoso', 'success')
            return redirect(url_for('main.index'))
        else:
            flash('Nombre de usuario o contraseña incorrectos', 'danger')

    return render_template('login.html', form=form)

# Ruta para pedir un cambio de contrasena
@auth.route('/req_new_pass', methods=['GET', 'POST'])
def req_new_pass():
    form = ReqNewPassForm()

    if request.method == 'POST':
        # Buscar el usuario en la base de datos por nombre de usuario
        usuario = Usuario.query.filter_by(username=form.username.data).first()
        #print(form.username.data)
        #print(form.password.data)
        if usuario:
            prevregistro= SolicitudNewPass.query.filter_by(usuario_id=usuario.id).first()
            if prevregistro:
                if prevregistro.status=="Pendiente":
                    flash('Ya tiene una solicitud pendiente', 'success')
                    return redirect(url_for('auth.login'))
                prevregistro.status="Pendiente"
                db.session.commit()
                flash('Solicitud envidad con exito', 'success')
                return redirect(url_for('auth.login'))
            nuevo_registro = SolicitudNewPass(usuario_id=usuario.id)
            db.session.add(nuevo_registro)
            db.session.commit()
            flash('Solicitud envidad con exito', 'success')
            return redirect(url_for('auth.login'))
        else:
            flash('Nombre de usuario incorrecto', 'danger')

    return render_template('forgot-password.html', form=form)



# Ruta para cerrar sesión
@auth.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Cierre de sesión exitoso', 'success')
    return redirect(url_for('main.index'))

"""FALTA HTML finales"""

# Clase para el formulario de cambio de contraseña
class CambioContrasenaForm(FlaskForm):
    contrasena_actual = PasswordField('Contraseña Actual', validators=[DataRequired()])
    nueva_contrasena = PasswordField('Nueva Contraseña', validators=[DataRequired()])
    confirmar_contrasena = PasswordField('Confirmar Nueva Contraseña', validators=[DataRequired()])
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
            flash('Contraseña cambiada con éxito', 'success')
            return redirect(url_for('main.index'))
        else:
            flash('Contraseña actual incorrecta', 'danger')

    return render_template('cambiar_contrasena.html', form=form)



