"""
Login / registro / recuperar contraseña del Portal del Asegurado.

Todo lo que vive aquí es independiente del login interno de agentes/staff
(app/auth, basado en Flask-Login + el modelo Usuario). Un asegurado nunca
tiene una sesión de Usuario, y viceversa — así que aunque alguien
adivinara una URL interna, nunca podría entrar sin haber iniciado sesión
como Usuario de verdad. La sesión del portal vive en
session['portal_cliente_id'].
"""
import re
import difflib
from datetime import datetime, timedelta
from functools import wraps

from flask import request, jsonify, session, redirect, url_for, render_template
from werkzeug.security import generate_password_hash, check_password_hash

from app import db
from app.models import Cliente, Poliza, PortalUsuario, PortalToken, PortalSolicitudRegistro
from . import portal
from .correo import generar_token, enviar_confirmacion_correo, enviar_reset_password

TOKEN_CONFIRMACION_HORAS = 48
TOKEN_RESET_HORAS = 2


# ------------------------------------------------------------------
# Helpers de normalización y verificación de identidad
# ------------------------------------------------------------------

import unicodedata


def _normalizar_texto(valor):
    """
    Además de mayúsculas y espacios, quita acentos y trata la 'ñ' como
    'n' -- para que "GARDUÑO" y "GARDUNO" (un error de tecleo muy común,
    sobre todo con la ñ y los acentos) se reconozcan como la misma
    persona al verificar identidad. Se sigue exigiendo que coincidan
    TANTO nombre como apellido -- esto no afloja esa exigencia, solo
    tolera variaciones de tecleo en cómo se escriben los mismos
    caracteres.
    """
    limpio = re.sub(r'\s+', ' ', (valor or '').strip()).upper()
    sin_acentos = unicodedata.normalize('NFKD', limpio)
    sin_acentos = ''.join(c for c in sin_acentos if not unicodedata.combining(c))
    return sin_acentos.replace('Ñ', 'N')


def _normalizar_rfc(valor):
    return re.sub(r'[\s\-]', '', (valor or '').strip()).upper()


# Términos de tipo de sociedad / puntuación que no aportan nada a la
# identidad de la empresa y que la gente teclea de formas muy distintas
# ("SA DE CV", "S.A. DE C.V.", "SAPI DE CV", etc.) -- se quitan antes de
# comparar para que el match no dependa de acertarle exacto a esto.
_SUFIJOS_RAZON_SOCIAL = (
    'SOCIEDAD ANONIMA DE CAPITAL VARIABLE', 'SOCIEDAD ANONIMA PROMOTORA DE INVERSION',
    'SAPI DE CV', 'SAPI', 'SA DE CV', 'SC DE RL DE CV', 'SC DE RL', 'S DE RL DE CV',
    'S DE RL', 'SRL DE CV', 'SRL', 'SA', 'SC', 'AC', 'SAS',
)


def _normalizar_razon_social(valor):
    """
    Normaliza una razón social para comparación flexible: mayúsculas,
    sin acentos, sin puntuación y sin los sufijos de tipo de sociedad
    (S.A. de C.V., SAPI, etc.) que la gente escribe de muchas formas
    distintas pero que no identifican a la empresa en sí.
    """
    limpio = _normalizar_texto(valor)
    limpio = re.sub(r'[.,]', '', limpio)
    limpio = re.sub(r'\s+', ' ', limpio).strip()
    for sufijo in _SUFIJOS_RAZON_SOCIAL:
        limpio = re.sub(r'\b' + re.escape(sufijo) + r'\b', '', limpio)
    return re.sub(r'\s+', ' ', limpio).strip()


def _razon_social_coincide(a, b):
    """
    Compara dos razones sociales de forma flexible: no exige que se
    escriban idéntico, solo que sean lo bastante parecidas (o que una
    contenga a la otra) una vez quitados sufijos y puntuación.
    """
    a_norm = _normalizar_razon_social(a)
    b_norm = _normalizar_razon_social(b)
    if not a_norm or not b_norm:
        return False
    if a_norm == b_norm:
        return True
    if a_norm in b_norm or b_norm in a_norm:
        return True
    # Compara también por conjunto de palabras compartidas -- cubre el
    # caso de palabras en otro orden ("Comercial Garduño" vs "Garduño
    # Comercial") que el ratio de secuencia castiga de más.
    palabras_a = set(a_norm.split())
    palabras_b = set(b_norm.split())
    if palabras_a and palabras_b:
        comunes = palabras_a & palabras_b
        if len(comunes) / max(len(palabras_a), len(palabras_b)) >= 0.6:
            return True
    return difflib.SequenceMatcher(None, a_norm, b_norm).ratio() >= 0.65


def _buscar_cliente_por_rfc_y_nombre(nombre, apellido, rfc):
    rfc_norm = _normalizar_rfc(rfc)
    if not rfc_norm:
        return None, None

    candidatos = [
        c for c in Cliente.query.filter(Cliente.status == 'Activo').all()
        if _normalizar_rfc(c.rfc) == rfc_norm
    ]
    if not candidatos:
        return None, None

    nombre_norm = _normalizar_texto(nombre)
    apellido_norm = _normalizar_texto(apellido)

    for c in candidatos:
        if (_normalizar_texto(c.nombre) == nombre_norm
                and _normalizar_texto(c.apellido) == apellido_norm):
            return c, None

    return None, 'El RFC existe en nuestros registros, pero el nombre/apellido no coincide.'


def _buscar_cliente_por_poliza_y_nombre(numero_poliza, nombre, apellido):
    numero_norm = _normalizar_texto(numero_poliza)
    if not numero_norm:
        return None

    poliza = Poliza.query.filter(
        Poliza.poliza.ilike(numero_norm)).first()
    if not poliza:
        return None

    cliente = Cliente.query.get(poliza.cliente_id)
    if not cliente or cliente.status != 'Activo':
        return None

    nombre_norm = _normalizar_texto(nombre)
    apellido_norm = _normalizar_texto(apellido)

    # Basta con que coincida el nombre O el apellido con el dueño real de
    # esa póliza — el número de póliza en sí ya es un dato que nadie de
    # fuera puede adivinar, así que sirve como evidencia fuerte aunque el
    # solicitante se haya equivocado tecleando el RFC.
    if (_normalizar_texto(cliente.nombre) == nombre_norm
            or _normalizar_texto(cliente.apellido) == apellido_norm):
        return cliente

    return None


def _buscar_cliente_moral_por_rfc_y_razon_social(razon_social, rfc):
    rfc_norm = _normalizar_rfc(rfc)
    if not rfc_norm:
        return None, None

    candidatos = [
        c for c in Cliente.query.filter(
            Cliente.status == 'Activo', Cliente.sexo == 'Empresa').all()
        if _normalizar_rfc(c.rfc) == rfc_norm
    ]
    if not candidatos:
        return None, None

    # El RFC ya es un identificador fuerte por sí solo -- si solo hay un
    # cliente moral con ese RFC, se da por verificado aunque la razón
    # social se haya tecleado muy distinto a como está en la BD (con o
    # sin tipo de sociedad, abreviada, con otro orden de palabras, etc.).
    if len(candidatos) == 1:
        return candidatos[0], None

    for c in candidatos:
        if _razon_social_coincide(c.nombre, razon_social):
            return c, None

    return None, 'El RFC existe en nuestros registros, pero la razón social no coincide.'


def _buscar_cliente_moral_por_poliza_y_razon_social(numero_poliza, razon_social):
    numero_norm = _normalizar_texto(numero_poliza)
    if not numero_norm:
        return None

    poliza = Poliza.query.filter(
        Poliza.poliza.ilike(numero_norm)).first()
    if not poliza:
        return None

    cliente = Cliente.query.get(poliza.cliente_id)
    if not cliente or cliente.status != 'Activo' or cliente.sexo != 'Empresa':
        return None

    if _razon_social_coincide(cliente.nombre, razon_social):
        return cliente

    return None


def portal_login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'portal_cliente_id' not in session:
            return redirect(url_for('portal.login_page'))
        return f(*args, **kwargs)
    return decorated


def _crear_token(portal_usuario_id, tipo, horas_validez):
    token = generar_token()
    registro = PortalToken(
        portal_usuario_id=portal_usuario_id,
        tipo=tipo,
        token=token,
        expira_en=datetime.utcnow() + timedelta(hours=horas_validez),
    )
    db.session.add(registro)
    db.session.commit()
    return token


def _validar_token(token, tipo):
    registro = PortalToken.query.filter_by(token=token, tipo=tipo).first()
    if not registro:
        return None, 'Este link no es válido.'
    if registro.usado:
        return None, 'Este link ya fue usado.'
    if registro.expira_en < datetime.utcnow():
        return None, 'Este link ya expiró.'
    return registro, None


# ------------------------------------------------------------------
# Páginas
# ------------------------------------------------------------------

@portal.route('/login', methods=['GET'])
def login_page():
    if 'portal_cliente_id' in session:
        return redirect(url_for('portal.dashboard'))
    return render_template('portal/login.html')


@portal.route('/restablecer-password/<token>', methods=['GET'])
def restablecer_password_page(token):
    registro, error = _validar_token(token, 'reset_password')
    return render_template('portal/restablecer_password.html',
                            token_valido=(registro is not None),
                            token=token, error=error)


@portal.route('/confirmar-correo/<token>', methods=['GET'])
def confirmar_correo(token):
    registro, error = _validar_token(token, 'confirmacion_correo')
    if not registro:
        return redirect(url_for('portal.login_page', confirmado='error'))

    portal_usuario = PortalUsuario.query.get(registro.portal_usuario_id)
    portal_usuario.correo_confirmado = True
    registro.usado = True
    db.session.commit()

    return redirect(url_for('portal.login_page', confirmado='ok'))


# ------------------------------------------------------------------
# API — registro
# ------------------------------------------------------------------

@portal.route('/api/registro', methods=['POST'])
def api_registro():
    tipo_persona = (request.form.get('tipo_persona') or 'fisica').strip().lower()
    es_moral = tipo_persona == 'moral'

    nombre = (request.form.get('nombre') or '').strip()
    apellido = (request.form.get('apellido') or '').strip()
    razon_social = (request.form.get('razon_social') or '').strip()
    rfc = (request.form.get('rfc') or '').strip().upper()
    numero_poliza = (request.form.get('numero_poliza') or '').strip()
    correo = (request.form.get('correo') or '').strip().lower()
    telefono = (request.form.get('telefono') or '').strip()
    password = request.form.get('password') or ''
    confirmar_password = request.form.get('confirmar_password') or ''

    if es_moral:
        if not all([razon_social, rfc, correo, telefono, password]):
            return jsonify({'error': True, 'msg': 'Faltan campos requeridos.'}), 400
    else:
        if not all([nombre, apellido, rfc, correo, telefono, password]):
            return jsonify({'error': True, 'msg': 'Faltan campos requeridos.'}), 400
    if password != confirmar_password:
        return jsonify({'error': True, 'msg': 'Las contraseñas no coinciden.'}), 400
    if len(password) < 8:
        return jsonify({'error': True, 'msg': 'La contraseña debe tener al menos 8 caracteres.'}), 400

    if PortalUsuario.query.filter_by(correo=correo).first():
        return jsonify({'error': True, 'msg': 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.'}), 400
    if PortalSolicitudRegistro.query.filter_by(correo=correo, status='Pendiente').first():
        return jsonify({'error': True, 'msg': 'Ya hay una solicitud pendiente con ese correo.'}), 400

    password_hash = generate_password_hash(password)

    if es_moral:
        cliente, motivo = _buscar_cliente_moral_por_rfc_y_razon_social(razon_social, rfc)
        if not cliente and numero_poliza:
            cliente = _buscar_cliente_moral_por_poliza_y_razon_social(numero_poliza, razon_social)
            if cliente:
                motivo = None
    else:
        cliente, motivo = _buscar_cliente_por_rfc_y_nombre(nombre, apellido, rfc)
        if not cliente and numero_poliza:
            cliente = _buscar_cliente_por_poliza_y_nombre(numero_poliza, nombre, apellido)
            if cliente:
                motivo = None

    if cliente:
        if PortalUsuario.query.filter_by(cliente_id=cliente.id).first():
            return jsonify({
                'error': True,
                'msg': 'Ya existe una cuenta ligada a este cliente. Intenta iniciar sesión o recuperar tu contraseña.',
            }), 400

        # Actualiza los datos de contacto del cliente con lo recién
        # capturado — la mayoría de los clientes no tienen correo/teléfono
        # guardado todavía, así que el registro también sirve para llenar
        # ese hueco.
        cliente.correo = correo
        cliente.tel_movil = telefono

        portal_usuario = PortalUsuario(
            cliente_id=cliente.id,
            correo=correo,
            password=password_hash,
            correo_confirmado=False,
        )
        db.session.add(portal_usuario)
        db.session.commit()

        token = _crear_token(portal_usuario.id, 'confirmacion_correo',
                              TOKEN_CONFIRMACION_HORAS)
        link = url_for('portal.confirmar_correo', token=token, _external=True)
        enviar_confirmacion_correo(correo, razon_social if es_moral else nombre, link)

        return jsonify({'status': 'verificado', 'correo': correo})

    # No se pudo verificar automáticamente — queda pendiente de revisión manual
    solicitud = PortalSolicitudRegistro(
        nombre=razon_social if es_moral else nombre,
        apellido='' if es_moral else apellido,
        rfc=rfc,
        numero_poliza=numero_poliza or None,
        correo=correo,
        telefono=telefono,
        password=password_hash,
        motivo=motivo or 'No se encontró ningún cliente con ese RFC.',
    )
    db.session.add(solicitud)
    db.session.commit()

    return jsonify({'status': 'pendiente'})


# ------------------------------------------------------------------
# API — login / logout
# ------------------------------------------------------------------

@portal.route('/api/login', methods=['POST'])
def api_login():
    correo = (request.form.get('correo') or '').strip().lower()
    password = request.form.get('password') or ''

    portal_usuario = PortalUsuario.query.filter_by(
        correo=correo, status='Activo').first()

    if not portal_usuario or not check_password_hash(portal_usuario.password, password):
        return jsonify({'error': True, 'msg': 'Correo o contraseña incorrectos.'}), 400

    if not portal_usuario.correo_confirmado:
        return jsonify({
            'error': True,
            'msg': 'Todavía no confirmas tu correo. Revisa tu bandeja de entrada (o spam) para activar tu cuenta.',
            'correo_sin_confirmar': True,
        }), 400

    cliente = Cliente.query.get(portal_usuario.cliente_id)
    if not cliente or cliente.status != 'Activo':
        return jsonify({'error': True, 'msg': 'Tu cuenta no está disponible por ahora. Contacta a soporte.'}), 400

    session['portal_cliente_id'] = cliente.id
    session['portal_usuario_id'] = portal_usuario.id
    return jsonify({'ok': True, 'redirect': url_for('portal.dashboard')})


@portal.route('/api/reenviar-confirmacion', methods=['POST'])
def api_reenviar_confirmacion():
    correo = (request.form.get('correo') or '').strip().lower()
    portal_usuario = PortalUsuario.query.filter_by(correo=correo).first()

    # Se responde igual exista o no la cuenta, para no revelar qué
    # correos están registrados.
    if portal_usuario and not portal_usuario.correo_confirmado:
        cliente = Cliente.query.get(portal_usuario.cliente_id)
        token = _crear_token(portal_usuario.id, 'confirmacion_correo',
                              TOKEN_CONFIRMACION_HORAS)
        link = url_for('portal.confirmar_correo', token=token, _external=True)
        enviar_confirmacion_correo(correo, cliente.nombre if cliente else '', link)

    return jsonify({'ok': True})


@portal.route('/logout', methods=['GET', 'POST'])
def logout():
    session.pop('portal_cliente_id', None)
    session.pop('portal_usuario_id', None)
    return redirect(url_for('portal.login_page'))


# ------------------------------------------------------------------
# API — recuperar contraseña
# ------------------------------------------------------------------

@portal.route('/api/olvide-password', methods=['POST'])
def api_olvide_password():
    correo = (request.form.get('correo') or '').strip().lower()
    portal_usuario = PortalUsuario.query.filter_by(
        correo=correo, status='Activo').first()

    # Mismo criterio: responde igual exista o no la cuenta.
    if portal_usuario:
        cliente = Cliente.query.get(portal_usuario.cliente_id)
        token = _crear_token(portal_usuario.id, 'reset_password',
                              TOKEN_RESET_HORAS)
        link = url_for('portal.restablecer_password_page',
                        token=token, _external=True)
        enviar_reset_password(correo, cliente.nombre if cliente else '', link)

    return jsonify({'ok': True})


@portal.route('/api/restablecer-password', methods=['POST'])
def api_restablecer_password():
    token = request.form.get('token') or ''
    password = request.form.get('password') or ''
    confirmar_password = request.form.get('confirmar_password') or ''

    if password != confirmar_password:
        return jsonify({'error': True, 'msg': 'Las contraseñas no coinciden.'}), 400
    if len(password) < 8:
        return jsonify({'error': True, 'msg': 'La contraseña debe tener al menos 8 caracteres.'}), 400

    registro, error = _validar_token(token, 'reset_password')
    if not registro:
        return jsonify({'error': True, 'msg': error}), 400

    portal_usuario = PortalUsuario.query.get(registro.portal_usuario_id)
    portal_usuario.password = generate_password_hash(password)
    registro.usado = True
    db.session.commit()

    return jsonify({'ok': True, 'redirect': url_for('portal.login_page')})
