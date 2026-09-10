# app/__init__.py
from flask import Flask,send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
import logging

app = Flask(__name__)
app.config.from_pyfile('config.py')

# Se fija el nivel de registro en DEBUG explícitamente -- así los
# current_app.logger.debug(...)/.warning(...)/.exception(...) que
# reemplazaron a varios print() sueltos siguen apareciendo en la
# consola exactamente igual que antes (no se pierde ninguna
# visibilidad del proceso), sin depender de si Flask los muestra o no
# por default. Cuando ya no se quiera ver tanto detalle (ej. en el
# servidor de producción), basta con subir este nivel a logging.INFO o
# logging.WARNING en un solo lugar.
app.logger.setLevel(logging.DEBUG)

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
mail = Mail(app)

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
from app.usuarios import usuarios_route
from app.vencimientos import vencimientos_route
from app.reportes import reportes_route
from app.endosos import endosos_route
from app.portal import portal
from app.dashboard_gerencial import dashboard_gerencial

app.register_blueprint(auth)
app.register_blueprint(main)
app.register_blueprint(polizas_route)
app.register_blueprint(clientes_route)
app.register_blueprint(solicitudes_route)
app.register_blueprint(usuarios_route)
app.register_blueprint(vencimientos_route)
app.register_blueprint(reportes_route)
app.register_blueprint(endosos_route)
app.register_blueprint(portal)
app.register_blueprint(dashboard_gerencial)

from flask import request


@app.before_request
def _redirigir_raiz_del_portal():
    """
    Si entran al dominio dedicado del portal (portal.ggcorp.mmtec.online
    o el que sea, ver PORTAL_DOMINIO en config.py) directo a la raíz
    ('https://ese-dominio/' sin ninguna ruta), se les muestra el login
    del asegurado ahí mismo -- sin redirect, para que la URL que ven en
    el navegador se quede tal cual como '/', sin cambiar a '/portal/login'.
    """
    dominio_portal = app.config.get('PORTAL_DOMINIO')
    if (dominio_portal
            and request.host.split(':')[0] == dominio_portal
            and request.path == '/'):
        return app.view_functions['portal.login_page']()


