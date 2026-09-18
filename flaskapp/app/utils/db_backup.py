# app/utils/db_backup.py
"""
Respaldo de la base de datos vía mysqldump, guardado en
DB_BACKUP_PATH (config.py) con la fecha/hora en el nombre, y poda
automática de respaldos más viejos que DB_BACKUP_RETENTION_DAYS.

Requiere que 'mysqldump' esté disponible -- por default se asume que
está en el PATH del sistema (viene con MySQL Server / MySQL
Workbench). Si no lo encuentra ahí, se puede definir la ruta completa
al ejecutable con MYSQLDUMP_PATH en config.py, por ejemplo:

    MYSQLDUMP_PATH = r'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe'
"""
import os
import subprocess
from datetime import datetime, timedelta
from urllib.parse import urlparse, unquote


class RespaldoBDError(Exception):
    pass


def _parsear_conexion(uri):
    """
    Convierte SQLALCHEMY_DATABASE_URI (ej.
    'mysql+mysqlconnector://usuario:contraseña@host:puerto/basedatos')
    en sus partes: host, puerto, usuario, contraseña, basedatos.
    """
    partes = urlparse(uri)
    if not partes.hostname or not partes.path or partes.path == '/':
        raise RespaldoBDError(
            'No se pudo interpretar SQLALCHEMY_DATABASE_URI -- revisa el formato en config.py')
    return {
        'host': partes.hostname,
        'puerto': partes.port or 3306,
        'usuario': unquote(partes.username or ''),
        'password': unquote(partes.password or ''),
        'basedatos': partes.path.lstrip('/'),
    }


def get_backup_folder(app):
    folder = app.config.get('DB_BACKUP_PATH')
    if not folder:
        folder = os.path.join(app.root_path, 'static', 'backups_bd_local')
    os.makedirs(folder, exist_ok=True)
    return folder


def hacer_respaldo(app):
    """
    Corre mysqldump y guarda el .sql resultante. Devuelve la ruta del
    archivo creado. Lanza RespaldoBDError si algo falla.
    """
    uri = app.config.get('SQLALCHEMY_DATABASE_URI')
    if not uri:
        raise RespaldoBDError('SQLALCHEMY_DATABASE_URI no está configurado')

    conexion = _parsear_conexion(uri)
    mysqldump_bin = app.config.get('MYSQLDUMP_PATH', 'mysqldump')

    folder = get_backup_folder(app)
    timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
    nombre_archivo = f"backup_{conexion['basedatos']}_{timestamp}.sql"
    ruta_destino = os.path.join(folder, nombre_archivo)

    comando = [
        mysqldump_bin,
        f"--host={conexion['host']}",
        f"--port={conexion['puerto']}",
        f"--user={conexion['usuario']}",
        f"--password={conexion['password']}",
        '--single-transaction',
        '--routines',
        '--events',
        conexion['basedatos'],
    ]

    try:
        with open(ruta_destino, 'wb') as salida:
            resultado = subprocess.run(
                comando, stdout=salida, stderr=subprocess.PIPE, timeout=600)
    except FileNotFoundError:
        raise RespaldoBDError(
            f"No se encontró '{mysqldump_bin}'. Si MySQL no está en el PATH del sistema, "
            "define MYSQLDUMP_PATH en config.py con la ruta completa al ejecutable.")
    except subprocess.TimeoutExpired:
        raise RespaldoBDError('mysqldump tardó demasiado (más de 10 minutos) y se canceló.')

    if resultado.returncode != 0:
        # Si falló, no dejamos un .sql vacío/corrupto tirado
        if os.path.exists(ruta_destino):
            os.remove(ruta_destino)
        error_msg = resultado.stderr.decode('utf-8', errors='replace').strip()
        raise RespaldoBDError(f'mysqldump terminó con error: {error_msg}')

    if not os.path.exists(ruta_destino) or os.path.getsize(ruta_destino) == 0:
        raise RespaldoBDError('El respaldo se generó vacío -- algo salió mal.')

    podar_respaldos_viejos(app)
    return ruta_destino


def podar_respaldos_viejos(app):
    """Borra respaldos con más de DB_BACKUP_RETENTION_DAYS días."""
    dias = app.config.get('DB_BACKUP_RETENTION_DAYS', 30)
    folder = get_backup_folder(app)
    limite = datetime.now() - timedelta(days=dias)

    for nombre in os.listdir(folder):
        if not nombre.startswith('backup_') or not nombre.endswith('.sql'):
            continue
        ruta = os.path.join(folder, nombre)
        try:
            modificado = datetime.fromtimestamp(os.path.getmtime(ruta))
            if modificado < limite:
                os.remove(ruta)
        except OSError:
            pass
