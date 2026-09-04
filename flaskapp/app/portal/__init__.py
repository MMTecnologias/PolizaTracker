from flask import Blueprint

portal = Blueprint('portal', __name__, url_prefix='/portal')

from . import routes
