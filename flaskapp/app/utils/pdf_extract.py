# app/utils/pdf_extract.py
"""
Algunas aseguradoras (confirmado con Mapfre, generador OpenText Exstream)
entregan el "PDF" desde su plataforma como la respuesta cruda
multipart/form-data de su API, no como un PDF suelto. El usuario la
descarga y la guarda con extensión .pdf, pero el archivo en realidad
tiene esta forma:

    --Boundary_xxx
    Content-Type: application/json
    ...JSON de status del job...
    --Boundary_xxx
    Content-Type: application/octet-stream
    ...
    %PDF-1.7
    ...contenido real del PDF...
    %%EOF
    --Boundary_xxx--

extract_real_pdf() detecta ese envoltorio y regresa únicamente los bytes
del PDF real (desde "%PDF" hasta el "%%EOF" que le corresponde). Si el
archivo ya es un PDF normal, lo regresa sin tocar. Si no encuentra un
PDF en ningún lado, regresa None.
"""


def extract_real_pdf(content: bytes):
    if not content:
        return None

    if content.startswith(b'%PDF'):
        return content

    start = content.find(b'%PDF')
    if start == -1:
        return None

    end = content.rfind(b'%%EOF')
    if end == -1:
        # No se encontró el marcador de fin explícito; se toma todo lo
        # que sigue a partir del header, es mejor que rechazar de plano.
        return content[start:]

    end += len(b'%%EOF')
    return content[start:end]
