# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,SelectField
from wtforms.validators import DataRequired
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza
from . import main 


# Ruta principal del sistema
@main.route('/')
@login_required
def index():
    return render_template('index.html', user=current_user)


# Clase para el formulario de creación de usuarios
class CrearUsuarioForm(FlaskForm):
    username = StringField('Nombre de Usuario', validators=[DataRequired()])
    password = PasswordField('Contraseña', validators=[DataRequired()])
    nivel_id = SelectField('Nivel de Acceso', coerce=int, validators=[DataRequired()])
    submit = SubmitField('Crear Usuario')


# Ruta para acceder a la página de creación de usuarios (solo si tiene acceso al servicio)
@main.route('/crear_usuario', methods=['GET', 'POST'])
@login_required
def crear_usuario():
    # Verificar si el usuario tiene acceso al servicio "Crear Usuarios"
    
    nombre_del_servicio="Crear Usuario"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()

    if not acceso:
        flash('No tienes acceso a esta función', 'danger')
        return redirect(url_for('main.index'))

    form = CrearUsuarioForm()

    if request.method == 'POST':
        # Verifica si el nombre de usuario ya existe
        usuario_existente = Usuario.query.filter_by(username=form.username.data).first()
        if usuario_existente:
            flash('El nombre de usuario ya existe', 'danger')
        else:
            # Crea un nuevo usuario
            #print(generate_password_hash(form.password.data))
            nuevo_usuario = Usuario(username=form.username.data, password=generate_password_hash(form.password.data), nivel_id=form.nivel_id.data)
            db.session.add(nuevo_usuario)
            db.session.commit()
            flash('Usuario creado con éxito', 'success')
            return redirect(url_for('main.index'))

    # Recupera la lista de niveles de acceso para el formulario
    niveles_acceso = NivelAcceso.query.all()
    form.nivel_id.choices = [(nivel.id, nivel.nombre) for nivel in niveles_acceso]

    return render_template('crear_usuario.html', form=form)


# Clase para el formulario de edición de usuarios
class EditarUsuarioForm(FlaskForm):
    password = PasswordField('Nueva Contraseña')
    nivel_id = SelectField('Nivel de Acceso', coerce=int)
    submit = SubmitField('Editar Usuario')


# Ruta para acceder a la página de edición de usuarios (solo si tiene acceso al servicio)
@main.route('/editar_usuario/<int:id>', methods=['GET', 'POST'])
@login_required
def editar_usuario(id):
    # Verificar si el usuario tiene acceso al servicio "Editar Usuarios"
    nombre_del_servicio="Editar Usuario"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()
    
    if not acceso:
        flash('No tienes acceso a esta función', 'danger')
        return redirect(url_for('main.index'))

    usuario = Usuario.query.get_or_404(id)
    form = EditarUsuarioForm()

    if request.method == 'POST':
        # Actualizar contraseña si se proporcionó una nueva
        if form.password.data:
            usuario.password = generate_password_hash(form.password.data)

        # Actualizar nivel de acceso si se seleccionó uno nuevo
        if form.nivel_id.data:
            usuario.nivel_id = form.nivel_id.data

        db.session.commit()
        flash('Usuario editado con éxito', 'success')
        return redirect(url_for('main.index'))

    # Recupera la lista de niveles de acceso para el formulario
    niveles_acceso = NivelAcceso.query.all()
    form.nivel_id.choices = [(nivel.id, nivel.nombre) for nivel in niveles_acceso]
    form.password.description = 'Deja este campo en blanco si no deseas cambiar la contraseña'

    return render_template('editar_usuario.html', usuario=usuario, form=form)


# Ruta para ver los registros de la tabla de grupos
@main.route('/ver_grupos')
@login_required
def ver_grupos():
    grupos = Grupo.query.all()
    return render_template('ver_grupos.html', grupos=grupos)

# Ruta para editar un registro en la tabla de grupos
@main.route('/editar_grupo/<int:id>', methods=['GET', 'POST'])
@login_required
def editar_grupo(id):
    # Verificar si el usuario tiene acceso a la edición de grupos
    nombre_del_servicio="Editar Grupo"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()

    if not acceso:
        flash('No tienes acceso a esta función', 'danger')
        return redirect(url_for('main.index'))

    grupo = Grupo.query.get_or_404(id)

    if request.method == 'POST':
        nuevo_nombre = request.form['nombre']

        # Verificar si ya existe un grupo con el nuevo nombre
        grupo_existente = Grupo.query.filter_by(grupo=nuevo_nombre).first()
        if grupo_existente:
            flash('Ya existe un grupo con ese nombre', 'danger')
        else:
            grupo.grupo = nuevo_nombre
            db.session.commit()
            flash('Grupo editado con éxito', 'success')
            return redirect(url_for('main.ver_grupos'))

    return render_template('editar_grupo.html', grupo=grupo)

""""
#Buscar en poliza
@main.route('/<tabla>/<columna>/<valor>')
def polizas_json(tabla,columna, valor):
    clase = globals()[tabla]

    query = clase.query.filter(getattr(clase, columna).like(f"%{valor}%")).all()

    resultados = 1
    return 1
"""


#Mostrar todas las rutas
@main.route('/rutas')
def mostrar_rutas():
    rutas = []
    for rule in current_app.url_map.iter_rules():
        rutas.append(str(rule))
    return render_template('mostrar_rutas.html', rutas=rutas)


