# app/utils/chubb_avisos.py
"""
Lectura y validación de los AVISOS DE COBRO de Chubb.

Chubb no reparte la prima neta, el financiamiento y los gastos de
expedición en partes iguales entre los recibos (el recibo 1 trae una
parte mayor y TODOS los gastos de expedición), así que los montos de
los recibos no se pueden calcular: hay que tomarlos de los avisos de
cobro que Chubb emite para cada pago.

Este módulo NO depende de Flask ni de la base de datos: recibe bytes de
PDF y devuelve estructuras simples, para poder probarlo con PDFs reales
fuera de la aplicación. Cada aviso de cobro es una página (o varias) con
esta forma de texto:

    AVISO DE COBRO
    Póliza: M946012886
    Vigencia: Del 11/Jul/2026 12:00 horas al 11/Ene/2027 12:00 horas
    Inciso: 1 Serie del aviso 1 / 2 220083496
    Endoso:
    ...
    Prima Neta $ 5,956.51
    Otros descuentos $ 0.00
    Financiamiento por pago fraccionado $ 265.63
    Gastos de expedición $ 799.00
    I.V.A. (16) % $ 1,123.37        (en algunos avisos solo "I.V.A.")
    Total a pagar: $ 8,144.51
    ...
    Referencia: M94601288600016 Fecha límite de pago: 10/Ago/2026

Un mismo PDF puede traer todos los avisos (uno por página) o puede
subirse un PDF por aviso.
"""
import io
import re
import unicodedata
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from app.utils.pdf_extract import extract_real_pdf

MESES = {
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
    'jan': 1, 'apr': 4, 'aug': 8, 'dec': 12,
}

MAX_AVISOS = 60


class AvisoChubbError(Exception):
    """Error legible para el usuario al leer los avisos de cobro."""


# ------------------------------------------------------------------
# Utilidades de parseo
# ------------------------------------------------------------------

def _sin_acentos(texto):
    nfkd = unicodedata.normalize('NFKD', texto or '')
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def normalizar_poliza(valor):
    """'M9 45020513' y 'M945020513' son la misma póliza: se comparan sin
    espacios, guiones ni mayúsculas/minúsculas."""
    return re.sub(r'[\s\-]', '', str(valor or '')).upper()


def _a_decimal(texto):
    """'$ 1,123.37' / '-$ 12.00' / '($12.00)' -> Decimal."""
    if texto is None:
        return None
    t = str(texto).strip()
    negativo = t.startswith('-') or (t.startswith('(') and t.endswith(')'))
    limpio = re.sub(r'[^\d.]', '', t)
    if not limpio:
        return None
    valor = Decimal(limpio)
    return -valor if negativo else valor


def _fecha(texto):
    """'14/Dic/2025' (o '14/12/2025') -> date."""
    m = re.match(r'^\s*(\d{1,2})/([A-Za-zÁÉÍÓÚáéíóú]+|\d{1,2})/(\d{4})\s*$', texto or '')
    if not m:
        return None
    dia, mes, anio = m.group(1), m.group(2), m.group(3)
    if mes.isdigit():
        num_mes = int(mes)
    else:
        num_mes = MESES.get(_sin_acentos(mes).lower()[:3])
    if not num_mes:
        return None
    try:
        return date(int(anio), num_mes, int(dia))
    except ValueError:
        return None


def _monto(texto, etiqueta_regex):
    """Busca '<etiqueta> $ 1,234.56' y regresa Decimal (o None)."""
    m = re.search(
        etiqueta_regex + r'[^\n$\d\-(]*(-?\s*\$?\s*-?\(?\s*[\d,]+\.\d{2}\)?)',
        texto, re.I)
    if not m:
        return None
    return _a_decimal(m.group(m.lastindex))


def _centavos(valor):
    return Decimal(valor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------
# Lectura de un aviso (texto de una página)
# ------------------------------------------------------------------

def es_pagina_aviso(texto):
    return bool(re.search(r'AVISO\s+DE\s+COBRO', texto or '', re.I)
                and re.search(r'Desglose\s+de\s+pago', texto or '', re.I))


def parsear_aviso(texto):
    """
    Extrae los datos de UN aviso de cobro a partir del texto de su
    primera página. Regresa un dict o lanza AvisoChubbError si falta
    algún dato imprescindible.
    """
    t = texto or ''

    m = re.search(
        r'^[ \t]*P[oó]liza:[ \t]*([A-Z0-9][A-Z0-9 \-]*?)[ \t]*(?=Vigencia|$)',
        t, re.M | re.I)
    poliza = normalizar_poliza(m.group(1)) if m else ''

    m = re.search(
        r'Vigencia:\s*Del\s+(\d{1,2}/[A-Za-zÁÉÍÓÚáéíóú0-9]+/\d{4})'
        r'(?:\s+\d{1,2}:\d{2}\s*horas?)?\s+al\s+'
        r'(\d{1,2}/[A-Za-zÁÉÍÓÚáéíóú0-9]+/\d{4})', t, re.I)
    vig_desde = _fecha(m.group(1)) if m else None
    vig_hasta = _fecha(m.group(2)) if m else None

    m = re.search(r'Serie\s+del\s+aviso\s+(\d+)\s*/\s*(\d+)(?:[ \t]+(\d+))?', t, re.I)
    serie_k = int(m.group(1)) if m else None
    serie_n = int(m.group(2)) if m else None
    serie_id = m.group(3) if m and m.group(3) else ''

    # Hay dos presentaciones del aviso:
    #  - suelto:     "Serie del aviso 1 / 4 210672198" y "Endoso:" vacío
    #  - dentro del PDF de la póliza: "Serie del aviso 1/12 Endoso: 225710887"
    # En ambas, ese número identifica al documento (póliza o endoso) al
    # que pertenecen los avisos.
    m = re.search(r'\bEndoso:[ \t]*(\S*)', t, re.I)
    endoso = (m.group(1).strip() if m else '')
    if not re.search(r'\d', endoso):
        endoso = ''
    if endoso and not serie_id:
        serie_id = endoso

    neta = _monto(t, r'Prima\s+Neta')
    descuentos = _monto(t, r'Otros\s+descuentos')
    financiamiento = _monto(t, r'Financiamiento\s+por\s+pago\s+fraccionado')
    gastos = _monto(t, r'Gastos\s+de\s+expedici[oó]n')
    iva = _monto(t, r'I\.V\.A\.(?:\s*\(\s*[\d.]+\s*\)\s*%)?')
    total = _monto(t, r'Total\s+a\s+pagar:?')

    m = re.search(r'I\.V\.A\.\s*\(\s*([\d.]+)\s*\)\s*%', t, re.I)
    iva_pct = Decimal(m.group(1)) if m else None

    m = re.search(r'l[ií]mite\s+de\s+pago:\s*(\d{1,2}/[A-Za-zÁÉÍÓÚáéíóú0-9]+/\d{4})', t, re.I)
    fecha_limite = _fecha(m.group(1)) if m else None

    m = re.search(r'Referencia:\s*(\S+)', t, re.I)
    referencia = m.group(1) if m else ''

    faltan = []
    if not poliza:
        faltan.append('número de póliza')
    if not vig_desde or not vig_hasta:
        faltan.append('vigencia')
    if serie_k is None or serie_n is None:
        faltan.append('serie del aviso (k / N)')
    if neta is None:
        faltan.append('prima neta')
    if total is None:
        faltan.append('total a pagar')
    if iva is None:
        faltan.append('I.V.A.')
    if faltan:
        raise AvisoChubbError('no se pudo leer: ' + ', '.join(faltan))

    return {
        'poliza': poliza,
        'vigencia_desde': vig_desde,
        'vigencia_hasta': vig_hasta,
        'serie_k': serie_k,
        'serie_n': serie_n,
        'serie_id': serie_id,
        'endoso': endoso,
        'prima_neta': _centavos(neta),
        'otros_descuentos': _centavos(descuentos or 0),
        'financiamiento': _centavos(financiamiento or 0),
        'gastos_expedicion': _centavos(gastos or 0),
        'iva': _centavos(iva),
        'iva_pct': iva_pct,
        'total': _centavos(total),
        'fecha_limite': fecha_limite,
        'referencia': referencia,
    }


# ------------------------------------------------------------------
# Lectura de PDFs completos
# ------------------------------------------------------------------

def leer_avisos_pdf(contenido, nombre_archivo='aviso.pdf'):
    """
    Lee un PDF (uno o varios avisos). Regresa la lista de avisos con:
      - los datos del aviso (ver parsear_aviso)
      - 'archivo': nombre del PDF de origen
      - 'paginas': índices (base 0) de la(s) página(s) del aviso (un aviso es
        una sola página; las demás páginas del PDF, p. ej. las del resto
        de la póliza, se ignoran)
      - '_fuente': bytes del PDF de origen (para separar la página)
    """
    import pdfplumber  # import local: solo se necesita al leer PDFs

    real = extract_real_pdf(contenido)
    if real is None:
        raise AvisoChubbError(f'"{nombre_archivo}" no es un PDF válido.')

    avisos = []
    try:
        with pdfplumber.open(io.BytesIO(real)) as pdf:
            for idx, pagina in enumerate(pdf.pages):
                texto = pagina.extract_text() or ''
                if es_pagina_aviso(texto):
                    try:
                        datos = parsear_aviso(texto)
                    except AvisoChubbError as e:
                        raise AvisoChubbError(
                            f'"{nombre_archivo}", página {idx + 1}: {e}.')
                    datos['archivo'] = nombre_archivo
                    datos['paginas'] = [idx]
                    datos['_fuente'] = real
                    avisos.append(datos)
    except AvisoChubbError:
        raise
    except Exception as e:  # PDF corrupto, protegido, etc.
        raise AvisoChubbError(f'No se pudo abrir "{nombre_archivo}": {e}')

    if not avisos:
        raise AvisoChubbError(
            f'"{nombre_archivo}" no parece un aviso de cobro de Chubb '
            '(no se encontró "AVISO DE COBRO" con su desglose de pago). '
            'Si es un PDF escaneado, no se puede leer.')
    return avisos


def leer_avisos(archivos):
    """archivos: lista de (nombre, bytes). Regresa todos los avisos
    ordenados por número de aviso."""
    if not archivos:
        raise AvisoChubbError('No se recibió ningún aviso de cobro.')
    todos = []
    for nombre, contenido in archivos:
        todos.extend(leer_avisos_pdf(contenido, nombre))
        if len(todos) > MAX_AVISOS:
            raise AvisoChubbError(
                f'Demasiados avisos (máximo {MAX_AVISOS}).')
    todos.sort(key=lambda a: (a['serie_k'], a['archivo']))
    return todos


def pdf_de_aviso(aviso):
    """Bytes de un PDF que contiene SOLO las páginas de ese aviso. Si el
    PDF de origen ya es de un solo aviso, se regresa tal cual."""
    import pikepdf

    fuente = aviso['_fuente']
    with pikepdf.Pdf.open(io.BytesIO(fuente)) as origen:
        if len(origen.pages) == len(aviso['paginas']):
            return fuente
        nuevo = pikepdf.Pdf.new()
        for idx in aviso['paginas']:
            nuevo.pages.append(origen.pages[idx])
        salida = io.BytesIO()
        nuevo.save(salida)
        return salida.getvalue()


# ------------------------------------------------------------------
# Validación
# ------------------------------------------------------------------

def _tol_suma(n):
    """Chubb redondea cada aviso al centavo, así que la suma de N avisos
    puede diferir de la prima de la póliza en unos centavos."""
    return Decimal(max(0.05, 0.01 * n)).quantize(Decimal('0.01'))


def validar_avisos(avisos, *, poliza_numero=None, endoso_numero=None,
                   es_endoso=False, n_esperado=None, prima_neta=None,
                   prima_total=None, fecha_inicio=None, fecha_termino=None):
    """
    Valida el conjunto de avisos contra los datos de la póliza/endoso.
    Regresa (errores, advertencias): listas de textos. Si hay errores NO
    se deben generar los recibos.
    """
    errores, advertencias = [], []
    if not avisos:
        return ['No se encontró ningún aviso de cobro.'], []

    # 1) Cada aviso debe cuadrar consigo mismo (si no, la lectura falló).
    for a in avisos:
        base = a['prima_neta'] + a['financiamiento'] + a['gastos_expedicion'] + a['iva']
        ok = any(abs(base + sgn * a['otros_descuentos'] - a['total']) <= Decimal('0.05')
                 for sgn in (1, -1))
        if not ok:
            errores.append(
                f"Aviso {a['serie_k']}/{a['serie_n']}: los montos no cuadran "
                f"(prima neta + financiamiento + gastos + IVA = {base:,.2f}, "
                f"pero el total dice {a['total']:,.2f}). Revisa el PDF.")

    # 2) Todos de la misma póliza y de la misma serie.
    polizas = {a['poliza'] for a in avisos}
    if len(polizas) > 1:
        errores.append('Los avisos son de pólizas distintas: ' + ', '.join(sorted(polizas)) + '.')
    ns = {a['serie_n'] for a in avisos}
    if len(ns) > 1:
        errores.append('Los avisos tienen distinto número de pagos (' +
                       ', '.join(str(n) for n in sorted(ns)) + ').')
    ids = {a['serie_id'] for a in avisos if a['serie_id']}
    if len(ids) > 1:
        errores.append('Los avisos pertenecen a series distintas (' +
                       ', '.join(sorted(ids)) + '); parecen ser de documentos distintos.')

    n = max(ns) if ns else len(avisos)

    # 3) Debe ser la póliza que se está generando.
    if poliza_numero and polizas and len(polizas) == 1:
        if normalizar_poliza(poliza_numero) not in polizas:
            errores.append(
                f"Los avisos son de la póliza {next(iter(polizas))}, pero estás "
                f"generando recibos de la póliza {poliza_numero}.")

    # 4) Identificador del documento (póliza o endoso): el número que
    #    Chubb imprime junto a la serie del aviso. Debe coincidir con el
    #    "endoso" capturado de la póliza/endoso que se está generando.
    #    En un endoso es el dato que distingue sus avisos de los de la
    #    póliza base, así que ahí un desacuerdo bloquea; en la póliza base
    #    (cuyo número de póliza ya coincidió) solo se advierte.
    ids_aviso = {normalizar_poliza(a['serie_id']) for a in avisos if a['serie_id']}
    esperado = normalizar_poliza(endoso_numero) if endoso_numero else ''
    if esperado and ids_aviso:
        if esperado not in ids_aviso:
            mensaje = (f"Los avisos son del documento {', '.join(sorted(ids_aviso))}, "
                       f"pero estás generando los del {'endoso' if es_endoso else 'documento'} "
                       f"{endoso_numero}.")
            (errores if es_endoso else advertencias).append(mensaje)
    elif es_endoso and not esperado:
        advertencias.append(
            'El endoso no tiene número capturado; no se pudo verificar que los avisos sean de este endoso.')
    elif es_endoso and not ids_aviso:
        advertencias.append(
            'Los avisos no indican número de endoso; verifica que sean los del endoso correcto.')

    # 5) Completos y sin repetir: 1..N.
    ks = [a['serie_k'] for a in avisos]
    repetidos = sorted({k for k in ks if ks.count(k) > 1})
    if repetidos:
        errores.append('Hay avisos repetidos: ' + ', '.join(str(k) for k in repetidos) + '.')
    faltan = [k for k in range(1, n + 1) if k not in ks]
    if faltan:
        errores.append('Faltan los avisos: ' + ', '.join(str(k) for k in faltan) +
                       f' (de {n}).')
    fuera = sorted({k for k in ks if k < 1 or k > n})
    if fuera:
        errores.append('Hay avisos fuera del rango 1-' + str(n) + ': ' +
                       ', '.join(str(k) for k in fuera) + '.')

    # 6) Mismo número de recibos que la póliza/endoso.
    if n_esperado is not None and int(n_esperado) != n:
        errores.append(
            f'Los avisos son de {n} pago(s), pero la póliza/endoso tiene {int(n_esperado)} '
            f'recibo(s). Corrige la forma de pago o sube los avisos correctos.')

    # 7) Sumas contra la prima de la póliza/endoso.
    suma_total = sum((a['total'] for a in avisos), Decimal('0'))
    suma_neta = sum((a['prima_neta'] for a in avisos), Decimal('0'))
    tol = _tol_suma(n)
    if prima_total is not None:
        dif = abs(abs(suma_total) - abs(Decimal(str(prima_total))))
        if dif > tol:
            errores.append(
                f'La suma de los avisos ({suma_total:,.2f}) no coincide con la prima total '
                f'({abs(Decimal(str(prima_total))):,.2f}); diferencia {dif:,.2f}.')
    if prima_neta is not None:
        dif = abs(abs(suma_neta) - abs(Decimal(str(prima_neta))))
        if dif > tol:
            errores.append(
                f'La suma de prima neta de los avisos ({suma_neta:,.2f}) no coincide con la '
                f'prima neta ({abs(Decimal(str(prima_neta))):,.2f}); diferencia {dif:,.2f}.')

    # 8) Fechas: continuidad y contra la vigencia de la póliza/endoso.
    ordenados = sorted(avisos, key=lambda a: a['serie_k'])
    for a, b in zip(ordenados, ordenados[1:]):
        if a['vigencia_hasta'] != b['vigencia_desde']:
            advertencias.append(
                f"El aviso {a['serie_k']} termina el {a['vigencia_hasta']:%d/%m/%Y} y el "
                f"{b['serie_k']} empieza el {b['vigencia_desde']:%d/%m/%Y}.")
    if fecha_inicio and ordenados and ordenados[0]['vigencia_desde'] != fecha_inicio:
        advertencias.append(
            f"El primer aviso empieza el {ordenados[0]['vigencia_desde']:%d/%m/%Y} pero la "
            f"vigencia capturada inicia el {fecha_inicio:%d/%m/%Y}.")
    if fecha_termino and ordenados and ordenados[-1]['vigencia_hasta'] != fecha_termino:
        advertencias.append(
            f"El último aviso termina el {ordenados[-1]['vigencia_hasta']:%d/%m/%Y} pero la "
            f"vigencia capturada termina el {fecha_termino:%d/%m/%Y}.")

    return errores, advertencias


def resumen_avisos(avisos):
    """Estructura serializable (JSON) para mostrar la vista previa."""
    filas = []
    for a in sorted(avisos, key=lambda x: x['serie_k']):
        filas.append({
            'numero': f"{a['serie_k']} / {a['serie_n']}",
            'vigencia_desde': a['vigencia_desde'].isoformat(),
            'vigencia_hasta': a['vigencia_hasta'].isoformat(),
            'prima_neta': float(a['prima_neta']),
            'financiamiento': float(a['financiamiento']),
            'gastos_expedicion': float(a['gastos_expedicion']),
            'iva': float(a['iva']),
            'total': float(a['total']),
            'fecha_limite': a['fecha_limite'].isoformat() if a['fecha_limite'] else None,
            'archivo': a['archivo'],
        })
    suma = lambda campo: float(sum((a[campo] for a in avisos), Decimal('0')))
    iva_pcts = {a['iva_pct'] for a in avisos if a['iva_pct'] is not None}
    return {
        'filas': filas,
        'n': len(avisos),
        'poliza': avisos[0]['poliza'] if avisos else '',
        'endoso': next((a['endoso'] for a in avisos if a['endoso']), ''),
        'serie_id': next((a['serie_id'] for a in avisos if a['serie_id']), ''),
        'suma_prima_neta': suma('prima_neta'),
        'suma_financiamiento': suma('financiamiento'),
        'suma_gastos_expedicion': suma('gastos_expedicion'),
        'suma_iva': suma('iva'),
        'suma_total': suma('total'),
        'iva_pct': float(next(iter(iva_pcts))) if len(iva_pcts) == 1 else None,
    }
