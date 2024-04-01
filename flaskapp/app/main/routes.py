# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request,current_app,jsonify, abort,Flask, Response
from flask_login import login_user, logout_user, login_required, current_user
#from flask_wtf import FlaskForm
#from wtforms import StringField, PasswordField, SubmitField,SelectField,DateField,EmailField
#from wtforms.validators import DataRequired,Email,InputRequired,Length
from werkzeug.security import check_password_hash,generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso,Grupo,Poliza,Cliente,Grupo,TipoPago,Recibo,Ramo, Subramo, Aseguradora, Agente
from sqlalchemy import join, or_,desc,func,select
import csv
from io import StringIO
from . import main 
from datetime import datetime
from dateutil.relativedelta import relativedelta


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
@login_required
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
@login_required
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
    return response
    # jsonResp = {'jack': 4098, 'sape': 4139}

    

@main.route('/delete_client', methods=['POST'])
@login_required
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
@login_required
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

@main.route('/export_users')
@login_required
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
    ramos=Ramo.query.all()
    subramos=Subramo.query.all()
    pagos=TipoPago.query.all()
    aseguradoras=Aseguradora.query.all()
    agentes=Agente.query.all()
    return render_template('polizas.html', user=current_user,ramos=ramos,subramos=subramos,pagos=pagos,aseguradoras=aseguradoras,agentes=agentes)


@app.route('/get_polizas_data', methods=['POST'])
@login_required
def get_polizas_data():
    # Get parameters from DataTables AJAX request
    draw = int(request.form.get('draw'))
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    search_value = request.form.get('search[value]')
    order_column_index = int(request.form.get('order[0][column]'))
    order_dir = request.form.get('order[0][dir]')

    # Query to fetch polizas data from the database 
    """
    polizas_query = db.session.query(Poliza, Cliente.nombre.label("client_name"),Cliente.apellido.label("client_lastname"),Ramo,Subramo,Aseguradora.aseguradora.label("aseguradora"),TipoPago,Agente) \
    .select_from(Poliza) \
    .join(Cliente, Poliza.cliente_id == Cliente.id) \
    .join(Ramo, Poliza.ramo_id == Ramo.id) \
    .join(Subramo, Poliza.subramo_id == Subramo.id) \
    .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) \
    .join(TipoPago, Poliza.tipo_pago_id == TipoPago.id) \
    .join(Agente, Poliza.agente_id == Agente.id)
    """
    polizas_query = db.session.query(Poliza, Cliente.nombre.label("client_name"),Cliente.apellido.label("client_lastname"),Aseguradora.aseguradora.label("aseguradora")) \
    .select_from(Poliza) \
    .join(Cliente, Poliza.cliente_id == Cliente.id) \
    .join(Aseguradora, Poliza.aseguradora_id == Aseguradora.id) 

    # Implement search functionality
    if search_value:
        polizas_query = polizas_query.filter(or_(
            Poliza.serie.ilike(f'%{search_value}%'),
            Cliente.nombre.ilike(f'%{search_value}%'),
            Aseguradora.aseguradora.ilike(f'%{search_value}%'),
            Cliente.apellido.ilike(f'%{search_value}%')
            # Add more fields for searching as needed
        ))

    # Implement sorting functionality
    order_column_name = None
    if order_column_index == 0:
        order_column_name = 'serie'
    elif order_column_index == 1:
        order_column_name = 'client_name'
    elif order_column_index == 2:
        order_column_name = 'aseguradora'

    if order_column_name:
        if order_dir == 'desc':
            polizas_query = polizas_query.order_by(desc(order_column_name))
        else:
            polizas_query = polizas_query.order_by(order_column_name)

    # Get total count of records without filtering
    total_records = polizas_query.count()
    
    # Apply pagination
    polizas = polizas_query.offset(start).limit(length).all()

    # Format data as required by DataTables
    data = []
    for poliza, nombre,apellido, aseguradora in polizas:
        data.append({
            'poliza': poliza.serie,
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'vigencia': f"{poliza.fecha_inicio.strftime('%Y-%m-%d')} to {poliza.fecha_termino.strftime('%Y-%m-%d')}",
            'id': poliza.id
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


@app.route('/get_receipts_data', methods=['POST'])
@login_required
def get_receipts_data():
    poliza_id = request.form.get('poliza_id')  # Assuming the poliza_id is sent via POST
    draw = int(request.form.get('draw'))
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))
    
    if poliza_id=="New":
        response = {
            'draw': draw,
            'recordsTotal': 0,  # Total records without filtering
            'recordsFiltered': 0,  # Total records after filtering
            'data': []  # Data to display
        }
        return jsonify(response)
    

    # Query to fetch polizas data from the database 
    recibos_query =Recibo.query.filter_by(poliza_id=poliza_id) 

    # Get total count of records without filtering
    total_records = recibos_query.count()
    
    # Apply pagination
    recibos = recibos_query.offset(start).limit(length).all()

    # Format data as required by DataTables
    data = []
    for recibo in recibos:
        data.append({
            'numero': recibo.no_de_recibo,
            'fecha_recibo':recibo.fecha_inicio.strftime('%Y-%m-%d'),
            "vencimiento" : recibo.fecha_vencimiento.strftime('%Y-%m-%d') ,
            "prima_neta" : float(recibo.prima_neta) ,
            "prima_total" : float(recibo.prima_total) ,
            "comision" : float(recibo.comision) ,
            "pagado" : True if recibo.status=='Liquidado' else False,
            "fecha_pago" : "" if recibo.fecha_pago is None else  recibo.fecha_pago.strftime('%Y-%m-%d'),
            "comprobante" : "" if recibo.comprobante is None else  recibo.comprobante ,
            "cancelado" : True if recibo.status=='Cancelado' else False,
            'id': recibo.id
            # Add more fields as needed
        })
    #'Liquidado', 'Pendiente', 'Vencido', 'Cancelado'), nullable=False,default='Pendiente')

    # Prepare response
    response = {
        'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }
    print(response)
    return jsonify(response)

@main.route('/search_clients', methods=['POST'])
@login_required
def search_clients():
    if not check_access("Clientes"):
        return jsonify({'options': []})  # Return empty options if access is not permitted

    # Get search query from request data
    search_query = request.form.get('query')
    clients_query = db.session.query(Cliente.id, Cliente.nombre, Cliente.apellido) \
                            .filter(Cliente.status == 'Activo') \
                            .filter(or_(
                                func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(f'%{search_query}%')
                            )) \
                            .order_by(desc(Cliente.id)) \
                            .limit(20)

    # Fetch client options
    options = [{'id': client.id, 'name': f"{client.nombre} {client.apellido}"} for client in clients_query]

    return jsonify({'options': options})



"""Menu"""
# Ruta principal del sistema
@main.route('/')
@login_required
def index():
    acceso=NivelAcceso.query.get_or_404(current_user.nivel_id)

    return render_template('menuP.html', user=current_user,acceso=acceso.nombre)

"""Recibos"""
@main.route('/recibos', methods=['GET'])
@login_required
def recibos():
    polizas=Poliza.query.all()
    return render_template('recibos.html',polizas=polizas)

# Ruta para obtener los valores de la póliza
@app.route('/get_policy_values/<int:policy_id>', methods=['GET'])
@login_required
def get_policy_values(policy_id):
    # Buscar la póliza en la base de datos por su ID
    poliza = Poliza.query.get(policy_id)

    if not poliza:
        return jsonify({'error': True, 'msg':'Poliza no encontrada'})

    # Calcular la duración de la póliza en años, considerando años bisiestos
    start_date = poliza.fecha_inicio
    end_date = poliza.fecha_termino
    policy_duration = int(round((end_date - start_date).days / 365.2425))  # Duración en años, considerando años bisiestos y redondeado a entero

    # Obtener el tipo de pago de la póliza
    tipo_pago = TipoPago.query.get(poliza.tipo_pago_id)


    # Obtener el número de pagos según el tipo de pago
    if tipo_pago.contado=="Si":
        num_payments = 1  
    else:
        num_payments = tipo_pago.pagos_anuales*policy_duration  # De lo contrario, el número de pagos es igual a los pagos mensuales

    # Devolver los valores como un objeto JSON
    return jsonify({
        'netPremium': float(poliza.prima_neta),
        'totalPremium': float(poliza.prima_total),
        'numReceipts': int(num_payments),
        'policyDuration': int(policy_duration),  # Convertir a entero
    })

def calcular_recibos():
    # Retrieve data from the form
    prima_total = float(request.form.get('totalPremium'))
    prima_neta = float(request.form.get('netPremium'))
    iva = float(request.form.get('iva'))
    derecho_poliza = float(request.form.get('insurance'))*(1+iva/ 100)
    iva=prima_neta *iva / 100
    commission = float(request.form.get('commission'))
    commission = prima_total * commission/100
    nopagos = int(request.form.get('receipts'))  # Assuming this is the number of payments
    print(derecho_poliza)
    recargo_por_pago = prima_total - derecho_poliza - prima_neta - iva
    # Perform calculations
    response = {
        'firstpay': {
            "netPremium": "",
            "comision": "",
            "totalPremium": ""
        },
        'subspay': {
            "netPremium": "",
            "comision": "",
            "totalPremium": ""
        }
    }

    # Calculate the values for the first payment
    total_premium = (prima_neta +iva + recargo_por_pago) / nopagos 
    net_premium = prima_neta / nopagos
    commission_pp = commission / nopagos

    response['firstpay']['netPremium'] = net_premium
    response['firstpay']['totalPremium'] = total_premium + derecho_poliza
    response['firstpay']['comision'] = commission_pp

    # If there are subsequent payments, calculate their values as well
    if nopagos > 1:
        response['subspay']['netPremium'] = net_premium
        response['subspay']['totalPremium'] = total_premium
        response['subspay']['comision'] = commission_pp

    response['derecho_poliza']=derecho_poliza
    response['iva']=iva/prima_neta
    response['rec_pago']=recargo_por_pago/prima_neta
    response['comision']=commission/prima_total
    response['poliza_id']=request.form.get('selectPoliza')
    response['nopagos']=nopagos
    #print(response)
    return response

def add_months(start_date, num_months):
    # Convertir la cadena de fecha en un objeto datetime
   
    start_date=str(start_date)
    start_date = datetime.strptime(start_date, '%Y-%m-%d')
    
    new_date = start_date + relativedelta(months=num_months)
    # Devolver la nueva fecha como cadena
    return new_date.strftime('%Y-%m-%d')

@main.route('/calculate_receipts', methods=['POST'])
@login_required
def calculate_receipts():
    response=calcular_recibos()
    return jsonify(response)

@main.route('/save_receipts', methods=['POST'])
@login_required
def save_receipts():
    response=calcular_recibos()
    poliza_id=response['poliza_id']
    poliza = Poliza.query.get(poliza_id)
    if not poliza:
        return jsonify({'error': True, 'msg':'Poliza no encontrada'})
    if poliza.recibos=="Generados":
        return jsonify({'error': True, 'msg':'Esta poliza ya tiene recibos generados'})
    try:
        # Ejecuta el bucle para crear registros
        start_date = poliza.fecha_inicio
        end_date = poliza.fecha_termino
        tipo_pago = TipoPago.query.get(poliza.tipo_pago_id)

        if tipo_pago.contado=="Si":
            print("done")
            nuevo_recibo=Recibo(fecha_inicio =start_date,
                                fecha_vencimiento =end_date,
                                poliza_id=poliza_id,
                                prima_neta=response['firstpay']['netPremium'],
                                prima_total =response['firstpay']['totalPremium'],
                                comision=response['firstpay']['comision']
                                )
            db.session.add(nuevo_recibo)
        else:
            num_months=int(12/tipo_pago.pagos_anuales)
            fecha_inicio =start_date
            fecha_vencimiento=add_months(fecha_inicio, num_months)
            nopagos=response['nopagos']
            nuevo_recibo=Recibo(fecha_inicio =fecha_inicio,
                                fecha_vencimiento =fecha_vencimiento,
                                poliza_id=poliza_id,
                                prima_neta=response['firstpay']['netPremium'],
                                prima_total =response['firstpay']['totalPremium'],
                                comision=response['firstpay']['comision'],
                                no_de_recibo="1 / "+str(nopagos)
                                )
            db.session.add(nuevo_recibo)
            for nopay in range(2,nopagos+1):
                fecha_inicio =fecha_vencimiento
                fecha_vencimiento=end_date if nopay == nopagos else add_months(fecha_inicio, num_months)
                nuevo_recibo=Recibo(fecha_inicio =fecha_inicio,
                                fecha_vencimiento =fecha_vencimiento,
                                poliza_id=poliza_id,
                                prima_neta=response['subspay']['netPremium'],
                                prima_total =response['subspay']['totalPremium'],
                                comision=response['subspay']['comision'],
                                no_de_recibo=  str(nopay)+" / "+str(nopagos)
                                )
                db.session.add(nuevo_recibo)

        poliza.derecho_poliza = response['derecho_poliza']
        poliza.iva = response['iva']
        poliza.rec_pago = response['rec_pago']
        poliza.comision = response['comision']
        poliza.recibos = "Generados"
        # Realiza el commit después de completar las inserciones
        db.session.commit()

        return jsonify({'error': False, 'msg':'Recibos generados con exito'})
    except:
        # Si ocurre algún error, realiza un rollback
        db.session.rollback()
        return jsonify({'error': True, 'msg':'Error en la creación de recibos'})



@main.route('/fetch_test', methods=['GET'])
def fetchtest():
    return jsonify ([
                        {"nombre":"baruc", "edad":27, "genero": "masculino"},
                        {"nombre":"sherley", "edad":27, "genero": "femenino"}
                     
                     ])


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


    return jsonify(data)

# test table polizas


@main.route('/get_clients_data2', methods=['POST'])
@login_required
def get_clients_data2():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    
    start = int(request.form.get('start'))
    length = int(request.form.get('length'))

    # Query to fetch clientes data from the database 
    clients_query = db.session.query(Cliente, Grupo.grupo.label('grupo_name')).join(Grupo).filter(Cliente.status == 'Activo')
    
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

    return jsonify(total_records, data)

    # jsonResp = {'jack': 4098, 'sape': 4139}


@main.route('/get_clients_filtered', methods=['POST'])
@login_required
def get_clients_filtered():
    if not check_access("Clientes"):
        return redirect(url_for('main.index'))
    # Get parameters from DataTables AJAX request
    search_value = request.form.get('search_value')

    # Query to fetch clientes data from the database 
    clients_query = db.session.query(Cliente, Grupo.grupo.label('grupo_name')).join(Grupo).filter(Cliente.status == 'Activo')

    # Implement search functionality
    if search_value:
        clients_query = clients_query.filter(or_(
            Cliente.id.ilike(f'%{search_value}%'),
            # Add more fields for searching as needed
        ))

    clients = clients_query
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

    return jsonify(data)