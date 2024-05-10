# app/__init__.py
from flask import Flask,send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

app = Flask(__name__)
app.config.from_pyfile('config.py')

import mimetypes
# Explicitly set MIME type for JavaScript files
mimetypes.add_type('application/javascript', '.js')

# Route to serve static files
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'auth.login'

from app.models import Usuario 
# Función user_loader para cargar el usuario
@login_manager.user_loader
def load_user(user_id):
    return Usuario.query.get(int(user_id))

# Registro de blueprints
from app.auth import auth
from app.main import main
from app.polizas import polizas_route
from app.clientes import clientes_route
from app.solicitudes import solicitudes_route

app.register_blueprint(auth)
app.register_blueprint(main)
app.register_blueprint(polizas_route)
app.register_blueprint(clientes_route)
app.register_blueprint(solicitudes_route)


