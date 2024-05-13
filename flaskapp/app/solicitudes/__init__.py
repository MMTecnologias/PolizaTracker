
from flask import Blueprint

solicitudes_route = Blueprint('solicitudes', __name__, url_prefix='/solicitudes')

from . import routes