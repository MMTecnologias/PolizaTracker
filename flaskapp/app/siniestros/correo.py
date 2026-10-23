"""
Envío de correos del módulo de Siniestros.

El correo sale del usuario que realiza el proceso (el correo que tiene registrado
en su usuario), no de una cuenta fija:
  - Si el correo del usuario es del mismo dominio que la cuenta SMTP del sistema
    (MAIL_USERNAME), el correo sale directamente "De: <correo del usuario>".
  - Si es de otro dominio (gmail, outlook, etc.) el servidor SMTP no puede firmar por
    él (SPF/DMARC lo mandarían a spam), así que sale con su nombre desde la cuenta del
    sistema, con "Responder a" su correo, y se le manda copia para que quede en su bandeja.
Sin MAIL_USERNAME configurado (desarrollo) imprime el correo en consola y no manda nada.
"""
import html
from flask import current_app
from flask_mail import Message
from app import mail


def _dominio(correo):
    return (correo or '').rsplit('@', 1)[-1].strip().lower() if '@' in (correo or '') else ''


def remitente_de(usuario):
    """(sender, reply_to, en_copia) según el usuario que envía."""
    cfg = current_app.config
    sistema = cfg.get('MAIL_USERNAME') or ''
    nombre = f'{usuario.nombre} {usuario.apellido}'.strip()
    propio = (usuario.correo or '').strip()
    if not propio:
        raise ValueError('Tu usuario no tiene correo registrado; pídele al administrador que lo capture.')
    if sistema and _dominio(propio) == _dominio(sistema):
        return (nombre, propio), propio, False
    base = cfg.get('MAIL_DEFAULT_SENDER') or sistema or propio
    if isinstance(base, tuple):
        base = base[1]
    return (nombre, base), propio, True


def enviar_correo_siniestro(usuario, destinatario, asunto, texto):
    sender, reply_to, copia = remitente_de(usuario)
    firma = f'{usuario.nombre} {usuario.apellido}'.strip()
    cuerpo = texto.rstrip() + f'\n\n--\n{firma}\nCoordinación de siniestros'
    cuerpo_html = ('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222;white-space:pre-wrap">'
                   + html.escape(texto.rstrip()) + '</div>'
                   + f'<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555;margin-top:18px">{html.escape(firma)}<br>Coordinación de siniestros</p>')
    if not current_app.config.get('MAIL_USERNAME'):
        print('\n' + '=' * 70 + '\nCORREO DE SINIESTRO (modo desarrollo, no se envió)')
        print(f'De: {sender[0]} <{sender[1]}> · Responder a: {reply_to}\nPara: {destinatario}\nAsunto: {asunto}\n' + '-' * 70 + f'\n{cuerpo}\n' + '=' * 70 + '\n')
        return {'simulado': True, 'de': reply_to, 'copia': copia}
    msg = Message(asunto, recipients=[destinatario], body=cuerpo, html=cuerpo_html, sender=sender,
                  reply_to=reply_to, cc=[reply_to] if copia else None)
    mail.send(msg)
    return {'simulado': False, 'de': sender[1], 'copia': copia}
