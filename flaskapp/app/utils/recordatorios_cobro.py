# flaskapp/app/utils/recordatorios_cobro.py
"""
Recordatorios automáticos de aviso de cobro.

Cada mañana se revisan los recibos Pendiente/Vencido y se manda UN correo
por recibo:
  - 'previo'  : cuando faltan 7 días o menos para la fecha de vencimiento.
  - 'vencido' : cuando ya venció (hasta 3 días después), para no mandar
                avalanchas por recibos viejos.
Cada tipo se manda una sola vez por recibo (tabla recordatorios_cobro).

Config (config.py):
  RECORDATORIOS_COBRO_ACTIVO = False        # apagado por defecto
  RECORDATORIOS_COBRO_DESTINO_PRUEBA = None # si se pone, TODO se manda ahí
  RECORDATORIOS_COBRO_SOLO_PORTAL = True    # solo clientes con cuenta activa y
                                            # confirmada en el Portal del Asegurado
                                            # (se manda al correo del portal)
  RECORDATORIOS_COBRO_HORA = 8              # hora del envío diario
"""
import os
from datetime import date, timedelta
from html import escape

from flask import current_app
from flask_mail import Message
from sqlalchemy.exc import IntegrityError

from app import db, mail
from app.models import Recibo, Poliza, Endoso, Cliente, RecordatorioCobro, PortalUsuario
from app.utils.document_storage import get_carpeta_documento

DIAS_ANTES = 7
DIAS_DESPUES_MAX = 3
ESTADOS_BLOQUEADOS = ('Cancelada', 'Finalizada')


def _tipo_que_toca(recibo, hoy):
    dias = (recibo.fecha_vencimiento - hoy).days
    if 0 <= dias <= DIAS_ANTES:
        return 'previo'
    if -DIAS_DESPUES_MAX <= dias < 0:
        return 'vencido'
    return None


def _money(v):
    return f"${float(v or 0):,.2f}"


def _fecha(d):
    return d.strftime('%d/%m/%Y')


def _cuerpo(cliente, poliza, recibo, tipo, con_pdf=True):
    nombre = f"{cliente.nombre or ''} {cliente.apellido or ''}".strip()
    if tipo == 'previo':
        intro = (f"Le recordamos que el pago de su recibo vence el "
                 f"{_fecha(recibo.fecha_vencimiento)}.")
        asunto = f"Recordatorio de pago – Póliza {poliza.poliza}"
    else:
        intro = (f"Le informamos que el pago de su recibo venció el "
                 f"{_fecha(recibo.fecha_vencimiento)} y aún no lo tenemos registrado.")
        asunto = f"Pago vencido – Póliza {poliza.poliza}"
    datos = [
        ('Póliza', poliza.poliza),
        ('Recibo', recibo.no_de_recibo or str(recibo.id)),
        ('Prima neta', _money(recibo.prima_neta)),
        ('Prima total', _money(recibo.prima_total)),
        ('Fecha de vencimiento', _fecha(recibo.fecha_vencimiento)),
    ]
    texto = (f"Estimado(a) {nombre}:\n\n{intro}\n\n"
             + "\n".join(f"{k}: {v}" for k, v in datos)
             + ("\n\nAdjuntamos su aviso de cobro. " if con_pdf else "\n\n")
             + "Si ya realizó el pago, haga caso omiso de este mensaje.\n\n"
               "Este es un correo automático, por favor no responda a este mensaje.\n")
    filas = "".join(f"<tr><td style='padding:3px 12px 3px 0'><b>{escape(k)}</b></td>"
                    f"<td>{escape(str(v))}</td></tr>" for k, v in datos)
    html = (f"<p>Estimado(a) {escape(nombre)}:</p><p>{escape(intro)}</p>"
            f"<table>{filas}</table>"
            f"<p>{'Adjuntamos su aviso de cobro. ' if con_pdf else ''}Si ya realizó el pago, haga caso omiso de este mensaje.</p>"
            "<p style='color:#888;font-size:12px'>Este es un correo automático, "
            "por favor no responda a este mensaje.</p>")
    return asunto, texto, html


def _ruta_aviso(cliente, poliza, recibo):
    if not recibo.comprobante:
        return None
    ruta = os.path.join(get_carpeta_documento(cliente, poliza, 'aviso_cobro', recibo=recibo),
                        recibo.comprobante)
    return ruta if os.path.isfile(ruta) else None


def enviar_recordatorios(hoy=None, dry_run=False, log=None):
    """Devuelve dict con contadores y lista 'detalle'. Requiere app context."""
    log = log or current_app.logger.info
    hoy = hoy or date.today()
    destino_prueba = current_app.config.get('RECORDATORIOS_COBRO_DESTINO_PRUEBA')
    solo_portal = current_app.config.get('RECORDATORIOS_COBRO_SOLO_PORTAL', True)
    res = {'sin_portal': 0, 'enviados': 0, 'sin_correo': 0, 'ya_enviados': 0, 'errores': 0,
           'sin_pdf': 0, 'detalle': []}

    desde = hoy - timedelta(days=DIAS_DESPUES_MAX)
    hasta = hoy + timedelta(days=DIAS_ANTES)
    recibos = (Recibo.query
               .filter(Recibo.status.in_(('Pendiente', 'Vencido')),
                       Recibo.fecha_vencimiento >= desde,
                       Recibo.fecha_vencimiento <= hasta)
               .order_by(Recibo.fecha_vencimiento, Recibo.id).all())

    for r in recibos:
        tipo = _tipo_que_toca(r, hoy)
        if not tipo:
            continue
        poliza = Poliza.query.get(r.poliza_id)
        if not poliza or poliza.status in ESTADOS_BLOQUEADOS:
            continue
        if r.endoso_id:
            e = Endoso.query.get(r.endoso_id)
            if e and e.status in ESTADOS_BLOQUEADOS:
                continue
        cliente = Cliente.query.get(poliza.cliente_id)
        if not cliente:
            continue
        etiqueta = f"recibo {r.id} (póliza {poliza.poliza}, {tipo})"
        if solo_portal:
            pu = PortalUsuario.query.filter_by(
                cliente_id=cliente.id, status='Activo', correo_confirmado=True).first()
            correo = (pu.correo or '').strip() if pu else ''
            if not correo:
                res['sin_portal'] += 1
                res['detalle'].append((r.id, tipo, 'sin_portal'))
                continue
        else:
            correo = (cliente.correo or '').strip()
        if not correo:
            res['sin_correo'] += 1
            log(f"Recordatorio omitido, cliente sin correo: {etiqueta}")
            res['detalle'].append((r.id, tipo, 'sin_correo'))
            continue
        if RecordatorioCobro.query.filter_by(recibo_id=r.id, tipo=tipo).first():
            res['ya_enviados'] += 1
            continue
        destinatario = destino_prueba or correo
        sin_smtp = (not current_app.config.get('MAIL_USERNAME')
                    and not current_app.config.get('MAIL_SUPPRESS_SEND')
                    and not current_app.config.get('TESTING'))
        if dry_run or sin_smtp:
            res['enviados'] += 1
            res['detalle'].append((r.id, tipo, f'SIMULADO -> {destinatario}' + ('' if dry_run else ' (sin MAIL_USERNAME)')))
            continue

        # Reservar primero (UNIQUE) para que dos procesos no manden doble.
        reg = RecordatorioCobro(recibo_id=r.id, tipo=tipo, destinatario=destinatario)
        db.session.add(reg)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            res['ya_enviados'] += 1
            continue
        try:
            ruta = _ruta_aviso(cliente, poliza, r)
            asunto, texto, html = _cuerpo(cliente, poliza, r, tipo, con_pdf=bool(ruta))
            remitente = (current_app.config.get('MAIL_DEFAULT_SENDER')
                         or current_app.config.get('MAIL_USERNAME'))
            msg = Message(asunto, recipients=[destinatario], body=texto, html=html,
                          sender=remitente)
            if ruta:
                with open(ruta, 'rb') as f:
                    nombre_pdf = r.comprobante_original or r.comprobante
                    msg.attach(nombre_pdf, 'application/pdf', f.read())
            else:
                res['sin_pdf'] += 1
            mail.send(msg)
            res['enviados'] += 1
            res['detalle'].append((r.id, tipo, f'enviado -> {destinatario}'))
            log(f"Recordatorio enviado: {etiqueta} -> {destinatario}")
        except Exception as ex:
            db.session.rollback()
            # liberar la reserva para reintentar mañana
            RecordatorioCobro.query.filter_by(recibo_id=r.id, tipo=tipo).delete()
            db.session.commit()
            res['errores'] += 1
            res['detalle'].append((r.id, tipo, f'ERROR {ex}'))
            current_app.logger.exception(f"Falló recordatorio {etiqueta}")
    return res


def tarea_diaria(app):
    with app.app_context():
        if not app.config.get('RECORDATORIOS_COBRO_ACTIVO'):
            return
        try:
            r = enviar_recordatorios()
            app.logger.info(
                "Recordatorios de cobro: %s enviados, %s sin correo, %s ya enviados, %s errores",
                r['enviados'], r['sin_correo'], r['ya_enviados'], r['errores'])
        except Exception:
            app.logger.exception('Error inesperado en recordatorios de cobro')
