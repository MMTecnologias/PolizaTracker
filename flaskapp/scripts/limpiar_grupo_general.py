# flaskapp/scripts/limpiar_grupo_general.py
"""
Script de UNA SOLA VEZ: busca el grupo "General" y le quita el grupo
(deja grupo_id vacío/NULL) a todos los clientes que están en él.

Contexto: el grupo "General" se estaba usando como un "cajón de sastre"
donde terminaron mezclados clientes de familias/empresas totalmente
distintas entre sí -- eso es un problema real con el Portal del
Asegurado, porque cualquiera que entre y esté en ese grupo vería las
pólizas de TODOS los demás que también están ahí, sin relación real
entre ellos. Este script es el primer paso para limpiar eso: los deja
sin grupo, listos para asignarlos correctamente después.

REQUISITO PREVIO: correr primero la migración
flaskapp/migracion_grupo_id_nullable.sql contra la base de datos --
el campo grupo_id no admitía NULL hasta ahora.

USO (parado en la carpeta flaskapp/):

    Modo de prueba, no guarda nada, solo reporta:
        python scripts/limpiar_grupo_general.py

    Modo real, quita el grupo de verdad:
        python scripts/limpiar_grupo_general.py --aplicar
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from app.models import Cliente, Grupo


def limpiar(aplicar=False):
    with app.app_context():
        grupo_general = Grupo.query.filter(
            Grupo.grupo.ilike('general')).first()

        if not grupo_general:
            print("No se encontró ningún grupo llamado 'General'. "
                  "Nada que hacer.")
            return

        print(f"Grupo encontrado: id={grupo_general.id} "
              f"nombre='{grupo_general.grupo}'")

        clientes = Cliente.query.filter(
            Cliente.grupo_id == grupo_general.id).all()

        if not clientes:
            print("Ningún cliente está en ese grupo. Nada que hacer.")
            return

        print(f"\nClientes en el grupo '{grupo_general.grupo}': {len(clientes)}\n")
        for c in clientes:
            print(f"  id={c.id}  {c.nombre} {c.apellido}  "
                  f"(RFC: {c.rfc or 'N/D'})")
            if aplicar:
                c.grupo_id = None

        if aplicar:
            db.session.commit()
            print(f"\n✅ Se quitó el grupo a {len(clientes)} cliente(s). "
                  f"Cambios guardados.")
        else:
            print(f"\n⚠️  Esto fue un DRY-RUN — no se guardó nada todavía.")
            print("    Si la lista se ve bien, vuelve a correr con --aplicar")


if __name__ == '__main__':
    aplicar = '--aplicar' in sys.argv
    limpiar(aplicar=aplicar)
