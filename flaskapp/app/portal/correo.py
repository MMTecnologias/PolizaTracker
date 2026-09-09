"""
Envío de correos del Portal del Asegurado (confirmación de cuenta y
recuperar contraseña).

Modo desarrollo: si en config.py no hay MAIL_USERNAME configurado, en vez
de fallar, se imprime el contenido del correo en la consola donde corre
`python run.py` — así se puede probar el flujo completo en local sin
necesitar credenciales SMTP reales todavía. En cuanto se agreguen
MAIL_USERNAME/MAIL_PASSWORD a config.py, empieza a mandar correos de
verdad sin tocar código.
"""
import secrets
from flask import current_app
from flask_mail import Message
from app import mail

COLOR_PRIMARIO = '#c94a1c'


def _enviar(destinatario, asunto, cuerpo_html):
    if not current_app.config.get('MAIL_USERNAME'):
        print('\n' + '=' * 70)
        print('CORREO (modo desarrollo — no se configuró MAIL_USERNAME todavía)')
        print(f'Para:    {destinatario}')
        print(f'Asunto:  {asunto}')
        print('-' * 70)
        print(cuerpo_html)
        print('=' * 70 + '\n')
        return

    msg = Message(asunto, recipients=[destinatario], html=cuerpo_html)
    mail.send(msg)


def generar_token():
    return secrets.token_urlsafe(32)


def _plantilla(titulo, nombre, mensaje, texto_boton, link):
    return f'''
    <div style="font-family: Arial, Helvetica, sans-serif; max-width:480px; margin:0 auto; padding:24px;">
      <div style="background:{COLOR_PRIMARIO}; color:white; padding:16px 24px; border-radius:10px 10px 0 0;">
        <h2 style="margin:0; font-size:18px;">Portal del Asegurado — GGcorp</h2>
      </div>
      <div style="border:1px solid #eee; border-top:none; border-radius:0 0 10px 10px; padding:24px;">
        <h3 style="color:#2b2b2b; margin-top:0;">{titulo}</h3>
        <p style="color:#555; font-size:14px; line-height:1.6;">Hola {nombre},</p>
        <p style="color:#555; font-size:14px; line-height:1.6;">{mensaje}</p>
        <p style="text-align:center; margin:28px 0;">
          <a href="{link}" style="background:{COLOR_PRIMARIO}; color:white; padding:13px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; display:inline-block;">{texto_boton}</a>
        </p>
        <p style="color:#999; font-size:12px; line-height:1.5;">Este link es válido por tiempo limitado y solo puede usarse una vez. Si no fuiste tú quien lo solicitó, puedes ignorar este correo.</p>
      </div>
    </div>
    '''


def enviar_confirmacion_correo(destinatario, nombre, link):
    asunto = 'Confirma tu cuenta — Portal del Asegurado GGcorp'
    cuerpo = _plantilla(
        '¡Ya casi!',
        nombre,
        'Gracias por registrarte en el Portal del Asegurado de GGcorp. '
        'Da clic en el siguiente botón para confirmar tu cuenta y poder iniciar sesión.',
        'Confirmar mi cuenta',
        link,
    )
    _enviar(destinatario, asunto, cuerpo)


def enviar_reset_password(destinatario, nombre, link):
    asunto = 'Restablecer tu contraseña — Portal del Asegurado GGcorp'
    cuerpo = _plantilla(
        'Recupera tu contraseña',
        nombre,
        'Recibimos una solicitud para restablecer tu contraseña del Portal del Asegurado. '
        'Da clic en el siguiente botón para elegir una nueva.',
        'Restablecer contraseña',
        link,
    )
    _enviar(destinatario, asunto, cuerpo)
