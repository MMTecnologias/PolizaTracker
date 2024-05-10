
from flask import Blueprint

usuarios_route = Blueprint('usuarios', __name__, url_prefix='/usuarios')

from . import routes