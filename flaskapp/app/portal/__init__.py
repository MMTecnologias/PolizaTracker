from flask import Blueprint, request, abort, current_app

portal = Blueprint('portal', __name__, url_prefix='/portal')


@portal.before_request
def _restringir_dominio_portal():
    """
    El Portal del Asegurado debe ser accesible SOLO a través del
    subdominio dedicado (ej. portal.ggcorp.mmtec.online), no del dominio
    principal (ggcorp.mmtec.online) que usan los agentes/staff. Si en
    config.py no se define PORTAL_DOMINIO, esta restricción se desactiva
    por completo -- así en desarrollo local (127.0.0.1/localhost) sigue
    funcionando sin configurar nada extra.
    """
    dominio_permitido = current_app.config.get('PORTAL_DOMINIO')
    if not dominio_permitido:
        return
    host_actual = request.host.split(':')[0]
    if host_actual != dominio_permitido:
        abort(404)


from . import routes
from . import auth_routes
