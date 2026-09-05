from flask import Blueprint

dashboard_gerencial = Blueprint(
    'dashboard_gerencial', __name__, url_prefix='/dashboard_gerencial')

from . import routes
