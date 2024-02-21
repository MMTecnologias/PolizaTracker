# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,SelectField,DateField,EmailField
from wtforms.validators import DataRequired,Email,InputRequired,Length
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,SolicitudNewPass,Cliente,Grupo
from . import main 

#from sqlalchemy.exc import DataError, IntegrityError, OperationalError, SQLAlchemyError

def check_access(nombre_del_servicio):
    # Verificar si el usuario tiene acceso al servicio "Editar Usuarios"
    servicio_crear_usuario_id=Servicio.query.filter_by(nombre=nombre_del_servicio).first().id
    acceso=Acceso.query.filter_by(servicio_id=servicio_crear_usuario_id,nivel_id=current_user.nivel_id).first()
    if not acceso:
        flash('No tienes acceso a esta función', 'danger')
        return False
    return True


"""Clientes"""
# Form de clientes
class ClientRegistrationForm(FlaskForm):
    nombre = StringField('nombre', validators=[InputRequired(), Length(max=50)])
    apellido = StringField('apellido', validators=[InputRequired(), Length(max=50)])
    grupo = SelectField('grupo', coerce=int, validators=[InputRequired()])
    cliente_id = SelectField('cliente_id', coerce=int)
    rfc = StringField('rfc', validators=[InputRequired(), Length(min=12, max=13)])
    telefono_oficina = StringField('telefono_oficina', validators=[Length(max=10)])
    telefono_movil = StringField('telefono_movil', validators=[Length(max=10)])
    telefono_casa = StringField('telefono_casa', validators=[Length(max=10)])
    correo = EmailField('correo', validators=[InputRequired(), Email(), Length(max=50)])
    direccion_fiscal = StringField('direccion_fiscal', validators=[Length(max=125)])
    fecha_nacimiento = DateField('fecha_nacimiento', validators=[InputRequired()],format='%Y-%m-%d')
    sexo = SelectField('sexo', choices=[('Hombre', 'Hombre'), ('Mujer', 'Mujer'), ('Otro', 'Otro')], validators=[InputRequired()])
    ocupacion = StringField('ocupacion', validators=[Length(max=30)])
    giro_actividad = StringField('giro_actividad', validators=[Length(max=30)])
    nuevo_grupo = StringField('nuevo_grupo', validators=[Length(max=30)])  # Add this field for new group input
    
@main.route('/cliente', methods=['GET', 'POST'])
@login_required
def cliente():
    grupos=Grupo.query.all()
    form = ClientRegistrationForm()
    if request.method == 'POST':
        #try:
            #print(request.form['submit_button'])
            #if request.form['submit_button'] == 'guardar':
                if form.grupo.data ==None:
                    # Handle creating a new group here
                    nuevo_grupo = form.nuevo_grupo.data
                    grupo_existente = Grupo.query.filter_by(grupo=nuevo_grupo).first()
                    if grupo_existente:
                        grupo_id=grupo_existente.id
                    else:
                        nuevo_grupo = Grupo(grupo=nuevo_grupo)
                        db.session.add(nuevo_grupo)
                        db.session.commit()
                        grupo_id=nuevo_grupo.id
                        grupos=Grupo.query.all()
                else:
                    grupo_id=form.grupo.data
                
                if form.cliente_id.data==None:
                    cliente_existente = Cliente.query.filter_by(rfc=form.rfc.data).first()
                    if cliente_existente:
                        return "Ya existe un cliente con ese RFC"
                    else:
                        nuevo_cliente = Cliente(
                                nombre=form.nombre.data,
                                apellido=form.apellido.data,
                                grupo_id=grupo_id,
                                rfc=form.rfc.data,
                                tel_oficina=form.telefono_oficina.data,
                                tel_movil=form.telefono_movil.data,
                                tel_casa=form.telefono_casa.data,
                                correo=form.correo.data,
                                direccion=form.direccion_fiscal.data,
                                fecha_nacimiento=form.fecha_nacimiento.data,
                                sexo=form.sexo.data,
                                ocupacion=form.ocupacion.data,
                                actividad=form.giro_actividad.data
                            )
                        db.session.add(nuevo_cliente)
                        db.session.commit()
                else:
                    cliente = Cliente.query.get_or_404(form.cliente_id.data)
                    # Actualizar los atributos del cliente con los datos del formulario
                    cliente.nombre = form.nombre.data
                    cliente.apellido = form.apellido.data
                    cliente.grupo_id = grupo_id
                    cliente.rfc = form.rfc.data
                    cliente.tel_oficina = form.telefono_oficina.data
                    cliente.tel_movil = form.telefono_movil.data
                    cliente.tel_casa = form.telefono_casa.data
                    cliente.correo = form.correo.data
                    cliente.direccion = form.direccion_fiscal.data
                    cliente.fecha_nacimiento = form.fecha_nacimiento.data
                    cliente.sexo = form.sexo.data
                    cliente.ocupacion = form.ocupacion.data
                    cliente.actividad = form.giro_actividad.data
                    # Guardar los cambios en la base de datos
                    db.session.commit()
            #else:
             #   print("Otro boton")
        #except:
        #    abort(404)


    return render_template('clientes.html', user=current_user,grupos=grupos)

@main.route('/get_clients')
@login_required
def get_clients():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    print("GETTING")
    clients = Cliente.query.paginate(page=page, per_page=per_page)

    # Return data as JSON
    return jsonify({
        'clients': [{
            'name': client.nombre,
            'apellido': client.apellido,
            'correo': client.correo,
            'celular': client.tel_movil,
            'id':client.id
            # Add more fields as needed
        } for client in clients.items],
        'has_prev': clients.has_prev,
        'has_next': clients.has_next,
        'prev_num': clients.prev_num,
        'next_num': clients.next_num,
        'total': clients.total,
        'pages': clients.pages,
        'page': clients.page
    })

@main.route('/get_client/<int:id>')
@login_required
def get_client(id):
    client = Cliente.query.get_or_404(id)
    
    # Return data as JSON
    return jsonify({
            'id': client.id,
            'nombre': client.nombre,
            'apellido': client.apellido,
            'rfc': client.rfc,
            'tel_oficina': client.tel_oficina,
            'tel_movil': client.tel_movil,
            'tel_casa': client.tel_casa,
            'correo': client.correo,
            'direccion': client.direccion,
            'fecha_nacimiento': client.fecha_nacimiento,
            'sexo': client.sexo,
            'ocupacion': client.ocupacion,
            'actividad': client.actividad,
            'grupo_id': client.grupo_id
    })


"""Usuarios"""
# Ruta usuarios
@main.route('/usuario', methods=['GET'])
@login_required
def usuario():
    niveles = NivelAcceso.query.all()
    return render_template('usuario.html', user=current_user,niveles =niveles)

@main.route('/get_usuarios_data', methods=['POST'])
def get_usuarios_data():
    # Get parameters from DataTables AJAX request
    draw = request.form.get('draw')
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))

    # Query to fetch usuarios data from the database
    usuarios = Usuario.query.offset(start).limit(length).all()

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
        'recordsTotal': len(usuarios),  # Total records without filtering
        'recordsFiltered': len(usuarios),  # Total records after filtering
        'data': data  # Data to display
    }

    return jsonify(response)


@main.route('/create_user', methods=['POST'])
def create_user():
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


"""FALTAN HTML finales"""
# Ruta para ver los registros de la tabla de grupos
@main.route('/ver_solicitudes')
@login_required
def ver_solicitudes():
    if not check_access("Admin usuarios"):
        return redirect(url_for('main.index'))
    solicitudes = SolicitudNewPass.query.filter_by(status="Pendiente").all()
    resumen=[(Usuario.query.get_or_404(solicitud.usuario_id).username,solicitud) for solicitud in solicitudes]


    return render_template('ver_solicitudes.html', resumen=resumen)



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
    if not check_access("Admin usuarios"):
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

        prevregistro= SolicitudNewPass.query.filter_by(usuario_id=usuario.id).first()
        if prevregistro:
            if prevregistro.status=="Pendiente":
                prevregistro.status="Resuelta"
        db.session.commit()
        flash('Usuario editado con éxito', 'success')
        return redirect(url_for('main.index'))

    # Recupera la lista de niveles de acceso para el formulario
    niveles_acceso = NivelAcceso.query.all()
    form.nivel_id.choices = [(nivel.id, nivel.nombre) for nivel in niveles_acceso]
    form.password.description = 'Deja este campo en blanco si no deseas cambiar la contraseña'

    return render_template('editar_usuario.html', usuario=usuario, form=form)



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
    
    if not check_access("Admin usuarios"):
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



# Ruta para ver los registros de la tabla de grupos
@main.route('/ver_grupos')
@login_required
def ver_grupos():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    grupos = Grupo.query.all()
    return render_template('ver_grupos.html', grupos=grupos)

# Ruta para editar un registro en la tabla de grupos
@main.route('/editar_grupo/<int:id>', methods=['GET', 'POST'])
@login_required
def editar_grupo(id):
    # Verificar si el usuario tiene acceso a la edición de grupos
    if not check_access("Clientes"):
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


