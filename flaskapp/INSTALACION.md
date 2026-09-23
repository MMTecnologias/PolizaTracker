# Instalación de PolizaTracker (Windows)

Requisitos para correr el sistema en una máquina nueva. Lo que se instala con
`pip` está en `requirements.txt`; lo de esta guía son **programas aparte** que
`pip` no puede instalar.

## 1. Programas

| Programa | Para qué | Obligatorio |
|---|---|---|
| Git | Clonar el repo | Sí |
| Python 3.12 | Correr Flask (evitar 3.13: algunas versiones fijas del requirements son anteriores) | Sí |
| MySQL Server 8.x + Workbench | Base de datos | Sí |
| Ollama + modelo `llama3.1:8b` | Extraer datos al subir el PDF de una póliza | Solo para subir PDFs |
| Tesseract OCR **con idioma español** | Leer PDFs que son imagen (escaneados o impresos desde el navegador) | Solo para PDFs imagen |

### Ollama
Instalar **solo** `llama3.1:8b` (es el que usa producción). El sistema prefiere
`qwen2.5:7b` si está instalado, y la extracción se comportaría distinto.

```powershell
winget install -e --id Ollama.Ollama
ollama pull llama3.1:8b
```

### Tesseract OCR
```powershell
winget install -e --id UB-Mannheim.TesseractOCR
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --list-langs
```
La lista debe incluir `spa`. Si no, descargar `spa.traineddata` de
https://github.com/tesseract-ocr/tessdata y copiarlo a
`C:\Program Files\Tesseract-OCR\tessdata\`.

Sin Tesseract el sistema funciona, pero al subir un PDF imagen muestra un
mensaje pidiendo el PDF original de la aseguradora.

## 2. Entorno de Python

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r flaskapp\requirements.txt
```

En el **servidor de producción** el entorno se llama `.venv` (con punto) y es el
que usa el servicio `ggSoft`: las dependencias se instalan ahí, no en otro.

## 3. `flaskapp\app\config.py`

No está en git (lleva credenciales). Llaves que usa el sistema:

```python
SECRET_KEY = '...'   # generar: python -c "import secrets; print(secrets.token_hex(32))"
SQLALCHEMY_DATABASE_URI = 'mysql+mysqlconnector://USUARIO:PASSWORD@localhost:3306/BASE'
MYSQLDUMP_PATH = r'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe'
DB_BACKUP_RETENTION_DAYS = 7
TESSERACT_CMD = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Opcionales (si faltan se usan carpetas dentro de app\static\):
# DOCUMENTOS_BASE_PATH = r'...'
# DB_BACKUP_PATH = r'...'

# Solo producción. En local va comentado o todo da 404:
# PORTAL_DOMINIO = '...'

# Sin MAIL_USERNAME el portal no manda correos reales (modo desarrollo).
```

Si la contraseña de MySQL tiene `@ : / #`, hay que escribirla codificada en la URI.

## 4. Base de datos

Las migraciones `flaskapp\migracion_*.sql` se corren en orden de fecha sobre
una base anterior a ellas.

## 5. Arrancar

```powershell
.\venv\Scripts\Activate.ps1
cd flaskapp
python run.py
```

En producción no se arranca a mano: `C:\nssm-2.24\win64\nssm.exe restart ggSoft`.
