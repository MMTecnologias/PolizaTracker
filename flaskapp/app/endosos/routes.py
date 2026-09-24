# app/main/routes.py
from flask import render_template, redirect, url_for, flash, request, current_app, jsonify, abort, Flask, Response, send_from_directory
from flask import request as flask_request
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db, login_manager
from app.models import Usuario, Servicio, Acceso, NivelAcceso, Grupo, Poliza, Cliente, Grupo, TipoPago, Recibo, Ramo, Subramo, Aseguradora, Agente, Vendedor, Request, Log, Endoso, new_class
from sqlalchemy import join, or_, desc, func, select
import csv
from io import StringIO
from . import endosos_route
from datetime import datetime, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import aliased
import os
import uuid
from werkzeug.utils import secure_filename
from app.utils.document_storage import get_carpeta_endoso
from app.utils.pdf_extract import extract_real_pdf


@endosos_route.route('/get_receipts', methods=['POST'])
@login_required
def get_receipts():
    # Recibe
    poliza_id = flask_request.form.get('poliza_id')
    start = int(flask_request.form.get('start'))
    length = int(flask_request.form.get('length'))

    endoso_id = flask_request.form.get('endoso_id')
    if endoso_id:
        recibos_query = Recibo.query.filter_by(endoso_id=endoso_id)
        poliza_id = Recibo.query.get(endoso_id).poliza_id
    else:
        # Error
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se envió el ID del endoso.'})

    moneda = Poliza.query.get(int(poliza_id)).moneda
    # Get total count of records without filtering
    total_records = recibos_query.count()
    # Apply pagination
    recibos = recibos_query.offset(start).limit(length).all()

    poliza = Poliza.query.get(poliza_id)
    # Format data as required by DataTables
    data = []
    for recibo in recibos:
        data.append({
            'numero': recibo.no_de_recibo,
            'fecha_recibo': recibo.fecha_inicio.strftime('%Y-%m-%d'),
            "vencimiento": recibo.fecha_vencimiento.strftime('%Y-%m-%d'),
            "prima_neta": float(recibo.prima_neta),
            "prima_total": float(recibo.prima_total),
            "comision": float(recibo.comision),
            "pagado": True if recibo.status == 'Liquidado' else False,
            "fecha_pago": "" if recibo.fecha_pago is None else recibo.fecha_pago.strftime('%Y-%m-%d'),
            "comprobante": "" if recibo.comprobante is None else recibo.comprobante,
            "cancelado": True if poliza.status == 'Cancelada' else False,
            'id': recibo.id,
            'moneda': moneda
            # Add more fields as needed
        })
    # 'Liquidado', 'Pendiente', 'Vencido', 'Cancelado'), nullable=False,default='Pendiente')

    # Prepare response
    response = {
        # 'draw': draw,
        'recordsTotal': total_records,  # Total records without filtering
        'recordsFiltered': total_records,  # Total records after filtering
        'data': data  # Data to display
    }
    return jsonify(response)


@endosos_route.route('/get', methods=['POST'])
@login_required
def get():
    # Estos datos los recibe desde la función en JS
    start = int(flask_request.form.get('start') or 0)
    length = int(flask_request.form.get('length') or 0)
    search_value = flask_request.form.get('searchValue')
    order = bool(flask_request.form.get('order'))
    endoso_id = flask_request.form.get('endoso_id')

    endosos_query = db.session.query(Endoso,
                                     Cliente.nombre.label("client_name"),
                                     Cliente.apellido.label("client_lastname"),
                                     Aseguradora.aseguradora.label(
                                         "aseguradora"),
                                     Ramo.ramo.label("ramo"),
                                     Subramo.subramo.label("subramo"),
                                     TipoPago.tipo_pago.label("tipo_pago"),
                                     Agente.nombre.label("agente"),
                                     Vendedor.nombre.label("vendedor")) \
        .select_from(Endoso) \
        .join(Cliente, Endoso.cliente_id == Cliente.id) \
        .outerjoin(Grupo, Cliente.grupo_id == Grupo.id) \
        .join(Aseguradora, Endoso.aseguradora_id == Aseguradora.id) \
        .join(Ramo, Endoso.ramo_id == Ramo.id)  \
        .join(Subramo, Endoso.subramo_id == Subramo.id)  \
        .join(TipoPago, Endoso.tipo_pago_id == TipoPago.id) \
        .join(Agente, Endoso.agente_id == Agente.id) \
        .join(Vendedor, Endoso.vendedor_id == Vendedor.id)

    if endoso_id:
        endosos_query = endosos_query.filter(Endoso.id == int(endoso_id))
    elif search_value:
        # Misma búsqueda rápida que en pólizas (sin importar espacios ni
        # mayúsculas), más el número de endoso y el de la póliza a la que
        # pertenece.
        needle = ''.join(search_value.strip().lower().split())
        sin_espacios = lambda col: func.lower(func.replace(col, ' ', ''))
        endosos_query = endosos_query.filter(or_(
            sin_espacios(Cliente.nombre).like(f'%{needle}%'),
            sin_espacios(Cliente.apellido).like(f'%{needle}%'),
            sin_espacios(func.concat(Cliente.nombre, ' ', Cliente.apellido)).like(f'%{needle}%'),
            sin_espacios(Grupo.grupo).like(f'%{needle}%'),
            sin_espacios(Endoso.endoso).like(f'%{needle}%'),
            sin_espacios(Endoso.poliza).like(f'%{needle}%'),
            sin_espacios(Endoso.serie).like(f'%{needle}%'),
        ))

    # Filtros estructurados (panel "Filtros"), mismos que en pólizas: se
    # combinan con AND y se pueden usar junto con la búsqueda rápida.
    filtro_aseguradora_id = flask_request.form.get('filtro_aseguradora_id')
    if filtro_aseguradora_id:
        endosos_query = endosos_query.filter(
            Endoso.aseguradora_id == int(filtro_aseguradora_id))

    filtro_status = flask_request.form.get('filtro_status')
    if filtro_status:
        endosos_query = endosos_query.filter(Endoso.status == filtro_status)

    filtro_tipo = flask_request.form.get('filtro_tipo')
    if filtro_tipo in ('A', 'B', 'D'):
        endosos_query = endosos_query.filter(Endoso.tipo_endoso == filtro_tipo)

    filtro_grupo_id = flask_request.form.get('filtro_grupo_id')
    if filtro_grupo_id:
        endosos_query = endosos_query.filter(Grupo.id == int(filtro_grupo_id))

    filtro_cliente_id = flask_request.form.get('filtro_cliente_id')
    filtro_cliente = flask_request.form.get('filtro_cliente')
    if filtro_cliente_id:
        try:
            endosos_query = endosos_query.filter(
                Cliente.id == int(filtro_cliente_id))
        except (TypeError, ValueError):
            pass
    elif filtro_cliente:
        needle = ''.join(filtro_cliente.strip().lower().split())
        endosos_query = endosos_query.filter(or_(
            func.lower(func.replace(Cliente.nombre, ' ', '')).like(f'%{needle}%'),
            func.lower(func.replace(Cliente.apellido, ' ', '')).like(f'%{needle}%'),
            func.lower(func.replace(func.concat(Cliente.nombre, ' ', Cliente.apellido), ' ', '')).like(f'%{needle}%'),
        ))

    # Rango de fechas por inicio de vigencia del endoso (igual que pólizas).
    for campo, operador in (('filtro_fecha_desde', '>='), ('filtro_fecha_hasta', '<=')):
        valor = flask_request.form.get(campo)
        if valor:
            try:
                fecha = datetime.strptime(valor, '%Y-%m-%d').date()
            except ValueError:
                continue
            endosos_query = endosos_query.filter(
                Endoso.fecha_inicio >= fecha if operador == '>=' else Endoso.fecha_inicio <= fecha)

    if flask_request.form.get('filtro_sin_pdf'):
        endosos_query = endosos_query.filter(
            or_(Endoso.pdf_path.is_(None), Endoso.pdf_path == ''))

    if order:
        endosos_query = endosos_query.order_by(desc(Endoso.fecha_inicio), desc(Endoso.id))
    else:
        endosos_query = endosos_query.order_by(Endoso.endoso)

    total_records = endosos_query.count()

    # length=0 (y start=0) significa "todos": lo usan ver/editar un endoso
    # y exportar/imprimir lo filtrado.
    if not length:
        endosos = endosos_query.all()
    else:
        endosos = endosos_query.offset(start).limit(length).all()

    data = []
    for endoso, nombre, apellido, aseguradora, ramo, subramo, tipo_pago, agente, vendedor in endosos:
        endoso_data = {}
        for column in Endoso.__table__.columns:
            value = getattr(endoso, column.name)
            if isinstance(value, date):
                value = value.strftime('%Y-%m-%d')
            elif isinstance(value, Decimal):
                value = float(value)
            endoso_data[column.name] = value

        endoso_data.update({
            'cliente': f"{nombre} {apellido}",
            'aseguradora': aseguradora,
            'vigencia': f"{endoso.fecha_inicio.strftime('%Y-%m-%d')} to {endoso.fecha_termino.strftime('%Y-%m-%d')}",
            'ramo': f"{ramo}",
            'subramo': f"{subramo}",
            'tipoPago': f"{tipo_pago}",
            'agente': f"{agente}",
            'vendedor': f"{vendedor}",
            'fecha_termino': endoso.fecha_termino.strftime('%Y-%m-%d')
        })
        data.append(endoso_data)

    return jsonify({
        'recordsTotal': total_records,
        'data': data
    })


@endosos_route.route('/delete', methods=['POST'])
@login_required
def delete():
    endoso_id = int(flask_request.form.get('endoso_id'))
    razon = flask_request.form.get('razon')
    endoso = Endoso.query.get(endoso_id)
    if endoso:
        # Update the endoso's status to "Eliminado"
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Cancelar endoso {endoso.endoso}",
                                table_name='Endoso',
                                row_id=endoso.id,
                                notas=razon)
        db.session.add(request_entry)
        db.session.commit()
        log_entry = Log(request_id=request_entry.id,
                        column_name='status',
                        old_value=endoso.status,
                        new_value='Cancelada')

        db.session.add(log_entry)
        endoso.status = "Cancelada"

        recibos_a_cancelar = Recibo.query.filter(
            Recibo.endoso_id == endoso.id,
            Recibo.status.in_(['Pendiente', 'Vencido']),
        ).all()
        for recibo in recibos_a_cancelar:
            recibo.status = 'Cancelado'

        db.session.commit()
        return jsonify({'error': False, 'title': 'Endoso cancelado', 'msg': 'El endoso ha sido cancelado con éxito, esta acción está sujeta a revisión y puede ser revertida por el administrador.'})
    else:
        return jsonify({'error': True, 'title': 'Error', 'msg': 'No se encontró el endoso.'})


@endosos_route.route('/process_receipt', methods=['POST'])
@login_required
def process_receipt():
    """
    Processes a receipt based on the action specified in the request form.
    The function handles three actions:
    - "Pagar": Marks the receipt as paid and logs the action.
    - "Cancelar Pago": Cancels the payment of the receipt and logs the action.
    - "Modificar Fecha de Pago": Modifies the payment date of the receipt and logs the action.
    Returns:
        JSON response indicating the success or failure of the action.
    Raises:
        ValueError: If the provided payment date is not valid or is in the future.
    Request Form Parameters:
        recibo_id (str): The ID of the receipt to be processed.
        accion (str): The action to be performed on the receipt.
        fecha_pago (str, optional): The new payment date for the receipt (required for "Modificar Fecha de Pago" action).
    JSON Response:
        error (bool): Indicates if there was an error.
        msg (str): A message describing the result of the action.
    """
    recibo_id = flask_request.form.get('recibo_id')
    accion = flask_request.form.get('accion')
    recibo = Recibo.query.get(recibo_id)
    poliza = Poliza.query.get(recibo.poliza_id)
    if not recibo:
        return jsonify({
            'error': True,
            'msg': 'Recibo no encontrado'
        })
    if accion not in ("Pagar", 'Cancelar Pago', 'Modificar Fecha de Pago'):
        return jsonify({
            'error': True,
            'msg': 'Acción no válida'
        })

    if accion == "Pagar":
        recibo.status = 'Liquidado'
        recibo.fecha_pago = datetime.now().strftime('%Y-%m-%d')

        request_entry = Request(usuario_id=current_user.id,
                                description=f"Pagar recibo {recibo.no_de_recibo} de la poliza {poliza.poliza}",
                                status="Aceptada",
                                table_name='Recibo',
                                row_id=recibo.id)
        db.session.add(request_entry)
        db.session.commit()

        return jsonify({
            'error': False,
            'msg': 'Recibo pagado exitosamente'
        })
    elif accion == 'Cancelar Pago':
        request_entry = Request(usuario_id=current_user.id,
                                description=f"Cancelar pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza}",
                                table_name='Recibo',
                                row_id=recibo.id)
        db.session.add(request_entry)
        db.session.commit()
        log_entry_1 = Log(request_id=request_entry.id,
                          column_name='status',
                          old_value=recibo.status,
                          new_value='Pendiente')
        log_entry_2 = Log(request_id=request_entry.id,
                          column_name='fecha_pago',
                          old_value=recibo.fecha_pago,
                          new_value=None)

        db.session.add(log_entry_1)
        db.session.add(log_entry_2)
        recibo.status = 'Pendiente'
        recibo.fecha_pago = None
        db.session.commit()

        return jsonify({
            'error': False,
            'msg': 'Pago de recibo cancelado exitosamente, esta accion esta sujeta a revision'
        })
    elif accion == 'Modificar Fecha de Pago':
        nueva_fecha_pago = flask_request.form.get('fecha_pago')
        try:
            nueva_fecha_pago = datetime.strptime(nueva_fecha_pago, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                'error': True,
                'msg': 'Fecha de pago no válida'
            })

        hoy = datetime.now()
        delta = (hoy - nueva_fecha_pago).days

        if delta < 0:
            return jsonify({
                'error': True,
                'msg': 'La fecha de pago no puede ser en el futuro'
            })
        elif delta <= 5:
            recibo.fecha_pago = nueva_fecha_pago
            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Modificar fecha de pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza} a {nueva_fecha_pago.strftime('%Y-%m-%d')}",
                                    status="Aceptada",
                                    table_name='Recibo',
                                    row_id=recibo.id)
            db.session.add(request_entry)
            db.session.commit()
            return jsonify({
                'error': False,
                'msg': 'Fecha de pago modificada exitosamente'
            })
        else:
            request_entry = Request(usuario_id=current_user.id,
                                    description=f"Modificar fecha de pago del recibo {recibo.no_de_recibo} de la poliza {poliza.poliza} a {nueva_fecha_pago.strftime('%Y-%m-%d')}",
                                    table_name='Recibo',
                                    row_id=recibo.id)
            db.session.add(request_entry)
            db.session.commit()
            log_entry = Log(request_id=request_entry.id,
                            column_name='fecha_pago',
                            old_value=recibo.fecha_pago,
                            new_value=nueva_fecha_pago)

            db.session.add(log_entry)
            recibo.fecha_pago = nueva_fecha_pago
            db.session.commit()

            return jsonify({
                'error': False,
                'msg': 'Fecha de pago modificada exitosamente, esta accion esta sujeta a revision debido a registro tardio'
            })


@endosos_route.route('/upload_pdf', methods=['POST'])
@login_required
def upload_pdf():
    from app.polizas.routes import (
        JSON_SCHEMA,
        call_ollama_model,
        extract_text_from_pdf_content,
        save_pdf_content,
    )

    if 'pdf_file' not in flask_request.files:
        return jsonify({'error': True, 'msg': 'No se proporcionó archivo PDF'})

    file = flask_request.files['pdf_file']
    if not file.filename or file.filename == '':
        return jsonify({'error': True, 'msg': 'No se seleccionó archivo'})

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': True, 'msg': 'El archivo debe ser PDF'})

    file_content = file.read()
    if len(file_content) > 10 * 1024 * 1024:
        return jsonify({'error': True, 'msg': 'El archivo es demasiado grande. Máximo 10MB.'})
    if len(file_content) == 0:
        return jsonify({'error': True, 'msg': 'El archivo está vacío.'})

    endoso_id = flask_request.form.get('endoso_id')
    upload_trace_id = uuid.uuid4().hex[:8]

    if not endoso_id or endoso_id == 'New':
        try:
            text = extract_text_from_pdf_content(
                file_content, prefer_endoso=True, trace_id=upload_trace_id)
            extracted_data = call_ollama_model(text, JSON_SCHEMA)
            pdf_path = save_pdf_content(
                file_content, file.filename,
                trace_id=upload_trace_id,
                folder_config_key='ENDOSO_PDF_UPLOAD_FOLDER'
            )
            return jsonify({
                'error': False,
                'data': extracted_data,
                'pdf_path': pdf_path,
                'msg': 'PDF procesado temporalmente'
            })
        except Exception as e:
            return jsonify({'error': True, 'msg': f'Error al procesar PDF: {str(e)}'})

    endoso = Endoso.query.get(int(endoso_id))
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'})

    old_pdf_path = endoso.pdf_path
    pdf_path = save_pdf_content(
        file_content, file.filename, endoso.poliza,
        trace_id=upload_trace_id,
        folder_config_key='ENDOSO_PDF_UPLOAD_FOLDER'
    )

    if old_pdf_path:
        old_full_path = (
            old_pdf_path if os.path.isabs(old_pdf_path)
            else os.path.join(current_app.root_path, 'static', old_pdf_path)
        )
        if os.path.exists(old_full_path):
            try:
                os.remove(old_full_path)
            except Exception:
                pass

    endoso.pdf_path = pdf_path
    request_entry = Request(usuario_id=current_user.id,
                            description=f"Cargar PDF del endoso {endoso.endoso} de la póliza {endoso.poliza}",
                            status="Aceptada",
                            table_name='Endoso',
                            row_id=endoso.id)
    db.session.add(request_entry)
    db.session.commit()

    return jsonify({
        'error': False,
        'msg': 'PDF de endoso cargado exitosamente',
        'pdf_path': pdf_path
    })


@endosos_route.route('/download_pdf/<int:endoso_id>', methods=['GET'])
@login_required
def download_pdf(endoso_id):
    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'})

    if not endoso.pdf_path:
        return jsonify({'error': True, 'msg': 'No hay PDF asociado a este endoso'})

    if os.path.isabs(endoso.pdf_path):
        pdf_full_path = endoso.pdf_path
        directory = os.path.dirname(pdf_full_path)
        filename = os.path.basename(pdf_full_path)
    else:
        pdf_full_path = os.path.join(
            current_app.root_path, 'static', endoso.pdf_path)
        directory = os.path.join(current_app.root_path, 'static')
        filename = endoso.pdf_path

    if not os.path.exists(pdf_full_path):
        return jsonify({'error': True, 'msg': 'El archivo PDF no existe'})

    return send_from_directory(
        directory,
        filename,
        as_attachment=True,
        download_name=f"endoso_{endoso.poliza}.pdf"
    )


@endosos_route.route('/delete_pdf/<int:endoso_id>', methods=['POST'])
@login_required
def delete_pdf(endoso_id):
    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'})
    if not endoso.pdf_path:
        return jsonify({'error': True, 'msg': 'Este endoso no tiene un PDF cargado'})

    old_full_path = (
        endoso.pdf_path if os.path.isabs(endoso.pdf_path)
        else os.path.join(current_app.root_path, 'static', endoso.pdf_path)
    )
    if os.path.exists(old_full_path):
        try:
            os.remove(old_full_path)
        except Exception:
            pass

    endoso.pdf_path = None
    db.session.add(Request(usuario_id=current_user.id,
                           description=f"Eliminar PDF del endoso {endoso.endoso} de la póliza {endoso.poliza}",
                           status="Aceptada",
                           table_name='Endoso',
                           row_id=endoso.id))
    db.session.commit()

    return jsonify({'error': False, 'msg': 'PDF eliminado exitosamente'})


# ---------------------------------------------------------------------------
# Factura del endoso (PDF + XML). Mismo comportamiento que la factura de
# pólizas; los archivos viven en la carpeta del endoso, dentro de la de su
# póliza: Cliente_.../Poliza_.../endosos/Endoso_{id}_{numero}/factura/
# ---------------------------------------------------------------------------
def _carpeta_factura_endoso(endoso):
    poliza = Poliza.query.get(endoso.poliza_id)
    cliente = Cliente.query.get(poliza.cliente_id) if poliza else None
    return get_carpeta_endoso(cliente, poliza, endoso, 'factura')


def _borrar_archivo(folder, filename):
    if not filename:
        return
    path = os.path.join(folder, secure_filename(filename))
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass


@endosos_route.route('/upload_factura', methods=['POST'])
@login_required
def upload_factura():
    endoso_id = flask_request.form.get('endoso_id')
    pdf_file = flask_request.files.get('factura_pdf')
    xml_file = flask_request.files.get('factura_xml')

    if not endoso_id:
        return jsonify({'error': True, 'msg': 'No se proporcionó el endoso'})
    if not pdf_file and not xml_file:
        return jsonify({'error': True, 'msg': 'Selecciona al menos un archivo (PDF o XML)'})

    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'})
    if not Poliza.query.get(endoso.poliza_id):
        return jsonify({'error': True, 'msg': 'No se encontró la póliza del endoso'})

    folder = _carpeta_factura_endoso(endoso)

    # Se validan AMBOS archivos antes de escribir cualquiera, para no dejar
    # guardado solo uno si el otro viene mal.
    pdf_content = xml_content = None
    if pdf_file and pdf_file.filename:
        if not pdf_file.filename.lower().endswith('.pdf'):
            return jsonify({'error': True, 'msg': 'La factura en PDF debe ser un archivo .pdf'})
        pdf_content = pdf_file.read()
        pdf_content = extract_real_pdf(pdf_content)
        if pdf_content is None:
            return jsonify({'error': True, 'msg': 'El archivo PDF no es válido'})
        if len(pdf_content) > 10 * 1024 * 1024:
            return jsonify({'error': True, 'msg': 'El PDF es demasiado grande. Máximo 10MB.'})
    if xml_file and xml_file.filename:
        if not xml_file.filename.lower().endswith('.xml'):
            return jsonify({'error': True, 'msg': 'La factura en XML debe ser un archivo .xml'})
        xml_content = xml_file.read()
        if not xml_content.lstrip().startswith(b'<'):
            return jsonify({'error': True, 'msg': 'El archivo XML no es válido'})
        if len(xml_content) > 10 * 1024 * 1024:
            return jsonify({'error': True, 'msg': 'El XML es demasiado grande. Máximo 10MB.'})

    if pdf_content is not None:
        _borrar_archivo(folder, endoso.factura_pdf)
        pdf_filename = f"fe{endoso.id}_{uuid.uuid4().hex[:8]}.pdf"
        with open(os.path.join(folder, pdf_filename), 'wb') as f:
            f.write(pdf_content)
        endoso.factura_pdf = pdf_filename
        endoso.factura_pdf_original = secure_filename(pdf_file.filename)

    if xml_content is not None:
        _borrar_archivo(folder, endoso.factura_xml)
        xml_filename = f"fe{endoso.id}_{uuid.uuid4().hex[:8]}.xml"
        with open(os.path.join(folder, xml_filename), 'wb') as f:
            f.write(xml_content)
        endoso.factura_xml = xml_filename
        endoso.factura_xml_original = secure_filename(xml_file.filename)

    db.session.add(Request(usuario_id=current_user.id,
                           description=f"Cargar factura del endoso {endoso.endoso} de la póliza {endoso.poliza}",
                           status="Aceptada",
                           table_name='Endoso',
                           row_id=endoso.id))
    db.session.commit()

    return jsonify({
        'error': False,
        'msg': 'Factura cargada exitosamente',
        'factura_pdf': endoso.factura_pdf,
        'factura_xml': endoso.factura_xml,
    })


@endosos_route.route('/download_factura/<int:endoso_id>/<tipo>', methods=['GET'])
@login_required
def download_factura(endoso_id, tipo):
    if tipo not in ('pdf', 'xml'):
        return jsonify({'error': True, 'msg': 'Tipo de documento inválido'}), 400

    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'}), 404

    stored_filename = endoso.factura_pdf if tipo == 'pdf' else endoso.factura_xml
    if not stored_filename:
        return jsonify({'error': True, 'msg': 'No se ha cargado el documento aun'}), 404

    filename = secure_filename(stored_filename)
    original_filename = (endoso.factura_pdf_original if tipo == 'pdf'
                         else endoso.factura_xml_original)
    folder = _carpeta_factura_endoso(endoso)
    if not os.path.exists(os.path.join(folder, filename)):
        return jsonify({'error': True, 'msg': 'No se ha cargado el documento aun'}), 404

    # El XML se descarga directo; el PDF se abre para verse en el navegador.
    return send_from_directory(
        folder,
        filename,
        as_attachment=(tipo == 'xml'),
        download_name=original_filename or filename,
    )


@endosos_route.route('/delete_factura/<int:endoso_id>/<tipo>', methods=['POST'])
@login_required
def delete_factura(endoso_id, tipo):
    if tipo not in ('pdf', 'xml'):
        return jsonify({'error': True, 'msg': 'Tipo de documento inválido'}), 400

    endoso = Endoso.query.get(endoso_id)
    if not endoso:
        return jsonify({'error': True, 'msg': 'Endoso no encontrado'})

    stored_filename = endoso.factura_pdf if tipo == 'pdf' else endoso.factura_xml
    if not stored_filename:
        return jsonify({'error': True, 'msg': 'Este endoso no tiene ese documento cargado'})

    _borrar_archivo(_carpeta_factura_endoso(endoso), stored_filename)

    if tipo == 'pdf':
        endoso.factura_pdf = None
        endoso.factura_pdf_original = None
    else:
        endoso.factura_xml = None
        endoso.factura_xml_original = None

    db.session.add(Request(usuario_id=current_user.id,
                           description=f"Eliminar factura ({tipo}) del endoso {endoso.endoso} de la póliza {endoso.poliza}",
                           status="Aceptada",
                           table_name='Endoso',
                           row_id=endoso.id))
    db.session.commit()

    return jsonify({'error': False, 'msg': 'Documento eliminado exitosamente'})
