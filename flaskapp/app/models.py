from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Date, Enum, DECIMAL, ForeignKey, TIMESTAMP
from app import db, app
from sqlalchemy.sql import func
from io import BytesIO, StringIO
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Image, Spacer
from reportlab.lib import colors, styles
from reportlab.lib.styles import getSampleStyleSheet
from flask import Response
import csv
import os


class Grupo(db.Model):
    __tablename__ = 'grupos'
    id = Column(Integer, primary_key=True)
    grupo = Column(String(50), nullable=False, unique=True)


class TipoPago(db.Model):
    __tablename__ = 'tipos_pagos'
    id = Column(Integer, primary_key=True)
    tipo_pago = Column(String(25), nullable=False, unique=True)
    pagos_anuales = Column(Integer, nullable=False, default=0)
    contado = Column(Enum('Si', 'No'), default='No')


class Aseguradora(db.Model):
    __tablename__ = 'aseguradoras'
    id = Column(Integer, primary_key=True)
    aseguradora = Column(String(40), nullable=False, unique=True)


class Ramo(db.Model):
    __tablename__ = 'ramos'
    id = Column(Integer, primary_key=True)
    ramo = Column(String(30), nullable=False, unique=True)


class Subramo(db.Model):
    __tablename__ = 'subramos'
    id = Column(Integer, primary_key=True)
    subramo = Column(String(30), nullable=False, unique=True)


class Agente(db.Model):
    __tablename__ = 'agentes'
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False, unique=True)


class Cliente(db.Model):
    __tablename__ = 'clientes'
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False)
    apellido = Column(String(50), nullable=False)
    grupo_id = Column(Integer, ForeignKey('grupos.id'), nullable=False)
    rfc = Column(String(13), nullable=False)
    # tel_oficina = Column(String(10))
    tel_movil = Column(String(10))
    # tel_casa = Column(String(10))
    correo = Column(String(50))
    direccion = Column(String(125))
    fecha_nacimiento = Column(Date)
    sexo = Column(Enum('Hombre', 'Mujer', 'Indefinido',
                  'Empresa'), default='Indefinido')
    ocupacion = Column(String(30))
    actividad = Column(String(30))
    status = Column(Enum('Activo', 'Eliminado'),
                    nullable=False, default='Activo')
    notas = Column(String(125))
    info_pago = Column(String(50))
    cvv = Column(Integer)
    fecha_vencimiento = Column(String(10))


class Vendedor(db.Model):
    __tablename__ = 'vendedores'
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False, unique=True)


class Poliza(db.Model):
    __tablename__ = 'polizas'
    id = Column(Integer, primary_key=True)
    cliente_id = Column(Integer, ForeignKey('clientes.id'), nullable=False)
    fecha_captura = Column(Date, nullable=False)
    endoso = Column(String(100))
    ramo_id = Column(Integer, ForeignKey('ramos.id'), nullable=False)
    subramo_id = Column(Integer, ForeignKey('subramos.id'), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_termino = Column(Date, nullable=False)
    moneda = Column(Enum('MXN', 'USD', 'UDIS'), nullable=False)
    tipo_pago_id = Column(Integer, ForeignKey(
        'tipos_pagos.id'), nullable=False)
    agente_id = Column(Integer, ForeignKey('agentes.id'), nullable=False)
    aseguradora_id = Column(Integer, ForeignKey(
        'aseguradoras.id'), nullable=False)
    serie = Column(String(30), nullable=False)
    notas = Column(String(400))
    poliza_anterior = Column(String(30))
    renovacion = Column(String(30))
    prima_neta = Column(DECIMAL(12, 2), nullable=False)
    prima_total = Column(DECIMAL(12, 2), nullable=False)
    status = Column(Enum('Vigente', 'Pendiente', 'Cancelada',
                    'Finalizada', 'Por Vencer'), nullable=False, default='Vigente')
    derecho_poliza = Column(DECIMAL(12, 2))
    iva = Column(DECIMAL(12, 2))
    rec_pago = Column(DECIMAL(12, 2))
    comision = Column(DECIMAL(12, 2))
    recibos = Column(Enum('Generados', 'Por generar'), default='Por generar')
    vendedor_id = Column(Integer, ForeignKey('vendedores.id'), nullable=False)
    poliza = Column(String(30), nullable=False)
    # alter table polizas add column conducta_pago varchar(30) default null;
    conducta_pago = Column(String(30), default=None)

    # ALTER TABLE `ggsystem`.`polizas`
    # ADD COLUMN `Poliza_renovada` ENUM('Si', 'No') NOT NULL DEFAULT 'No' AFTER `conducta_pago`;
    Poliza_renovada = Column(Enum('Si', 'No'), nullable=False, default='No')


class Endoso(db.Model):
    __tablename__ = 'endosos'
    id = Column(Integer, primary_key=True)
    tipo_endoso = Column(Enum('A', 'B', 'D'), nullable=False)
    cliente_id = Column(Integer, ForeignKey('clientes.id'), nullable=False)
    poliza_id = Column(Integer, ForeignKey('polizas.id'), nullable=False)
    fecha_captura = Column(Date, nullable=False)
    endoso = Column(String(100))
    ramo_id = Column(Integer, ForeignKey('ramos.id'), nullable=False)
    subramo_id = Column(Integer, ForeignKey('subramos.id'), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_termino = Column(Date, nullable=False)
    moneda = Column(Enum('MXN', 'USD', 'UDIS'), nullable=False)
    tipo_pago_id = Column(Integer, ForeignKey(
        'tipos_pagos.id'), nullable=False)
    agente_id = Column(Integer, ForeignKey('agentes.id'), nullable=False)
    aseguradora_id = Column(Integer, ForeignKey(
        'aseguradoras.id'), nullable=False)
    serie = Column(String(30), nullable=False)
    notas = Column(String(400))
    poliza_anterior = Column(String(30))
    renovacion = Column(String(30))
    prima_neta = Column(DECIMAL(12, 2), nullable=False)
    prima_total = Column(DECIMAL(12, 2), nullable=False)
    status = Column(Enum('Vigente', 'Pendiente', 'Cancelada',
                    'Finalizada'), nullable=False)
    derecho_poliza = Column(DECIMAL(12, 2))
    iva = Column(DECIMAL(12, 2), default=0.16)
    rec_pago = Column(DECIMAL(12, 2))
    comision = Column(DECIMAL(12, 2))
    recibos = Column(Enum('Generados', 'Por generar'), default='Por generar')
    vendedor_id = Column(Integer, ForeignKey('vendedores.id'), nullable=False)
    poliza = Column(String(30), nullable=False)


class Recibo(db.Model):
    __tablename__ = 'recibos'
    id = Column(Integer, primary_key=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    poliza_id = Column(Integer, ForeignKey('polizas.id'), nullable=False)
    endoso_id = Column(Integer, ForeignKey('endosos.id'), nullable=False)
    prima_neta = Column(DECIMAL(12, 2), nullable=False)
    prima_total = Column(DECIMAL(12, 2), nullable=False)
    comision = Column(DECIMAL(12, 2), nullable=False)
    status = Column(Enum('Liquidado', 'Pendiente', 'Vencido',
                    'Cancelado'), nullable=False, default='Pendiente')
    fecha_pago = Column(Date)
    comprobante = Column(String(30))
    no_de_recibo = Column(String(30), default="1 / 1")


class Servicio(db.Model):
    __tablename__ = 'servicios'
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False)


class NivelAcceso(db.Model):
    __tablename__ = 'niveles_acceso'
    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False, unique=True)


class Acceso(db.Model):
    __tablename__ = 'accesos'
    servicio_id = Column(Integer, ForeignKey(
        'servicios.id'), nullable=False, primary_key=True)
    nivel_id = Column(Integer, ForeignKey('niveles_acceso.id'),
                      nullable=False, primary_key=True)


class Usuario(db.Model, UserMixin):
    __tablename__ = 'usuarios'
    id = Column(Integer, primary_key=True)
    username = Column(String(10), nullable=False, unique=True)
    password = Column(String(520), nullable=False)
    nivel_id = Column(Integer, ForeignKey('niveles_acceso.id'), nullable=False)
    nombre = Column(String(50), nullable=False)
    apellido = Column(String(50), nullable=False)
    correo = Column(String(50), nullable=False)
    telefono = Column(String(10), nullable=False)
    status = Column(Enum('Activo', 'Eliminado'),
                    nullable=False, default='Activo')


class SolicitudNewPass(db.Model):
    __tablename__ = 'solicitudes_new_pass'
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), primary_key=True)
    status = Column(Enum('Resuelta', 'Pendiente'),
                    nullable=False, default="Pendiente")


class Request(db.Model):
    __tablename__ = 'requests'
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), nullable=False)
    timestamp = Column(TIMESTAMP, default=func.current_timestamp())
    usuario_review_id = Column(Integer, ForeignKey('usuarios.id'))
    description = Column(String(400))
    status = Column(Enum('Pendiente', 'Aceptada', 'Rechazada'),
                    default='Pendiente')
    row_id = Column(Integer, nullable=False)
    table_name = Column(String(50), nullable=False)
    notas = Column(String(255), default=None)


class Log(db.Model):
    __tablename__ = 'log'
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey('requests.id'), nullable=False)
    column_name = Column(String(50), nullable=False)
    old_value = Column(String(400))
    new_value = Column(String(400))


# Ahora debes ajustar cualquier lógica adicional que estés utilizando en tu aplicación para que funcione con estas clases de modelo. También, asegúrate de tener las importaciones necesarias en otros archivos de tu aplicación.
def new_class(clase, form_id, nuevo, columname):
    if form_id == "New":
        existente = clase.query.filter(
            getattr(clase, columname) == nuevo).first()
        if existente:
            id = existente.id
        else:
            kwargs = {columname: nuevo}
            nuevo = clase(**kwargs)
            db.session.add(nuevo)
            db.session.commit()
            id = nuevo.id
    else:
        id = int(form_id)
    return id


def new_class_edit(clase, form_id, nuevo, columname):
    if form_id == "New":
        existente = clase.query.filter(
            getattr(clase, columname) == nuevo).first()
        if existente:
            id = existente.id
            return {"error": True, "record_id": id, "msg": "Esta intentando crear un elemento que ya existe"}
        else:
            kwargs = {columname: nuevo}
            nuevo = clase(**kwargs)
            db.session.add(nuevo)
            db.session.commit()
            id = nuevo.id
            return {"error": False, "record_id": id, "msg": "Elemento creado correctamente"}
    else:
        existente = clase.query.get(int(form_id))
        if existente:
            setattr(existente, columname, nuevo)
            db.session.commit()
            return {"error": False, "record_id": form_id, "msg": "Elemento editado correctamente"}
        else:
            return {"error": True, "record_id": "", "msg": "Esta intentando editar un elemento que no existe"}


def export_to_csv(headers, jsondic, filename, real_headers=None):
    if real_headers is None:
        real_headers = headers

    def generate():
        f = StringIO()
        writer = csv.writer(f)

        # Escribir los encabezados
        writer.writerow(real_headers)
        
        # Escribir los datos
        for data in jsondic:
            row = []
            for header in headers:
                value = data.get(header, '')
                # Manejar valores None
                if value is None:
                    value = ''
                row.append(str(value))
            writer.writerow(row)

        content = f.getvalue()
        f.close()
        return content

    csv_content = generate()
    response = Response(csv_content, mimetype='text/csv')
    response.headers.set("Content-Disposition", "attachment", filename=filename)
    return response


def export_to_pdf(headers, jsondic, filename, real_headers=None, to_multiline=None, title_str="Title"):
    title_str = str(title_str)
    if real_headers is None:
        real_headers = headers
    if to_multiline is None:
        to_multiline = []
    # Create a buffer to hold the PDF data
    buffer = BytesIO()
    # Set up the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=landscape(
        letter), leftMargin=4, rightMargin=4, topMargin=4, bottomMargin=4, title=title_str)
    # Create the table data
    style = getSampleStyleSheet()['Normal']
    style.fontName = 'Helvetica'
    style.fontSize = 8
    style.textColor = colors.black
    style.wordWrap = True
    style.alignment = 0
    style.valign = 1
    style.bottomPadding = 6
    # print(real_headers)
    # print(jsondic)
    data = [real_headers] + [
        [Paragraph(
            '' if not data[header] else data[header], style) if header in to_multiline else data[header] for header in headers]
        for data in jsondic
    ]
    # print("Porcessed")
    # print(data)
    # Create the table and set its style
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.gray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('WORDWRAP', (0, 1), (-1, -1), True),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    # Build the PDF document
    elements = []
    # Load the logo image
    # logo_path = "static/assets/images/GGcorp_logo_for_Repor.png"  # Update this path to the actual location of your logo
    logo_path = os.path.join(
        app.root_path, 'static/assets/images/GGcorp_logo_for_Repor.png')
    logo = Image(logo_path)
    # og size is 615x1024
    logo.drawHeight = 102.4/2  # Adjust the height as needed
    logo.drawWidth = 61.5/2  # Adjust the width as needed
    """
    # Add the logo to the document
    elements.append(logo)
    # Create a style for the title
    title_style = getSampleStyleSheet()['Title']
    title_style.fontName = 'Helvetica'
    title_style.fontSize = 14
    title_style.leading = 20
    title_style.alignment = 1  # Center alignment
    # Create the title paragraph
    p = Paragraph(title_str, title_style)
    elements.append(p)
    """
    # Custom header (logo on the right, title on the left)
    header_table_data = [
        [
            Paragraph(
                f"<b>{title_str}</b>",  # Title on the left
                getSampleStyleSheet()['Title']
            ),
            logo  # Logo on the right
        ]
    ]
    header_table = Table(
        header_table_data,
        # Adjust column widths (e.g., 400px for title, 100px for logo)
        colWidths=[700, 50]
    )
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),  # Align the title to the left
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),  # Align the logo to the right
        # Vertically align to the middle
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    # Add the custom header
    elements.append(header_table)
    # Add some spacing after the header
    elements.append(Spacer(1, 10))
    # Add the table with data
    elements.append(table)
    doc.build(elements)
    # Reset the buffer position
    buffer.seek(0)
    # Return the PDF data as a response
    response = Response(buffer, mimetype='application/pdf')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response


def print_to_pdf(headers, jsondic, filename, real_headers=None, to_multiline=None):
    response = export_to_pdf(headers, jsondic, filename,
                             real_headers, to_multiline)
    # Open the print interface in the browser
    response.headers.set("Content-Disposition", "inline")
    return response


def export_tocsv2(headers, jsondic, filename):
    def generate():
        f = StringIO()
        f.seek(0)
        f.write(u'\uFEFF')
        writer = csv.writer(f)
        writer.writerow(tuple(headers))
        # Write rows
        print(jsondic)
        for data in jsondic:
            row = [data[header] for header in headers]
            writer.writerow(tuple(row))
            yield f.getvalue()
            f.seek(0)

    response = Response(generate(), mimetype='text/csv')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response


def export_to_pdf2(headers, jsondic, filename, real_headers=None, to_multiline=None, title_str="Title"):
    title_str = str(title_str)
    if real_headers is None:
        real_headers = headers
    if to_multiline is None:
        to_multiline = []
    # Create a buffer to hold the PDF data
    buffer = BytesIO()
    # Set up the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=landscape(
        letter), leftMargin=4, rightMargin=4, topMargin=4, bottomMargin=4, title=title_str)

    # Create the table data
    style = getSampleStyleSheet()['Normal']
    style.fontName = 'Helvetica'
    style.fontSize = 8
    style.textColor = colors.black
    style.wordWrap = True
    style.alignment = 0
    style.valign = 1
    style.bottomPadding = 6

    print(real_headers)
    print(jsondic)
    data = [real_headers] + [
        [Paragraph(
            '' if not data[header] else data[header], style) if header in to_multiline else data[header] for header in headers]
        for data in jsondic
    ]
    print("Porcessed")
    print(data)
    # Create the table and set its style
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.gray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('WORDWRAP', (0, 1), (-1, -1), True),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    # Build the PDF document
    elements = []

    # Create a style for the title
    title_style = getSampleStyleSheet()['Title']
    title_style.fontName = 'Helvetica'
    title_style.fontSize = 14
    title_style.leading = 20
    title_style.alignment = 1  # Center alignment

    # Create the title paragraph
    p = Paragraph(title_str, title_style)
    elements.append(p)

    elements.append(table)
    doc.build(elements)

    # Reset the buffer position
    buffer.seek(0)

    # Return the PDF data as a response
    response = Response(buffer, mimetype='application/pdf')
    response.headers.set("Content-Disposition",
                         "attachment", filename=filename)
    return response
