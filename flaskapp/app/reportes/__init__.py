
from flask import Blueprint

reportes_route = Blueprint('reportes', __name__, url_prefix='/reportes')

from . import routes