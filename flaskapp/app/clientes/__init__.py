
from flask import Blueprint

clientes_route = Blueprint('clientes', __name__, url_prefix='/clientes')

from . import routes