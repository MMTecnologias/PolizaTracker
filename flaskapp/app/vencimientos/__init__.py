
from flask import Blueprint

vencimientos_route = Blueprint('vencimientos', __name__, url_prefix='/vencimientos')

from . import routes