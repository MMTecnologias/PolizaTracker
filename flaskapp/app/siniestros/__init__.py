from flask import Blueprint

siniestros_route = Blueprint('siniestros', __name__, url_prefix='/siniestros')

from app.siniestros import routes  # noqa: E402,F401
from app.siniestros import modulos  # noqa: E402,F401
from app.siniestros import activos  # noqa: E402,F401
from app.siniestros import nuevo  # noqa: E402,F401
