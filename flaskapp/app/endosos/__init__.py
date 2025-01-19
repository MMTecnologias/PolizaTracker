
from flask import Blueprint

endosos_route = Blueprint('endosos', __name__, url_prefix='/endosos')

from . import routes