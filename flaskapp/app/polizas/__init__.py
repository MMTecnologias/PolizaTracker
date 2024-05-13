
from flask import Blueprint

polizas_route = Blueprint('polizas', __name__, url_prefix='/polizas')

from . import routes