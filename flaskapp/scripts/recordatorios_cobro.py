# flaskapp/scripts/recordatorios_cobro.py
"""
Simula (por defecto) o ejecuta el envío de recordatorios de aviso de cobro.
USO (desde flaskapp/):
    python scripts/recordatorios_cobro.py              # solo simula
    python scripts/recordatorios_cobro.py --fecha 2026-11-05
    python scripts/recordatorios_cobro.py --enviar     # manda de verdad
    --limite N   maximo N correos;  --todos  ignora restriccion de portal (pruebas)
"""
import sys, os, argparse
from datetime import date
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app
from app.utils.recordatorios_cobro import enviar_recordatorios

ap = argparse.ArgumentParser()
ap.add_argument('--enviar', action='store_true')
ap.add_argument('--fecha')
ap.add_argument('--limite', type=int, help='maximo de correos a enviar (para pruebas)')
ap.add_argument('--todos', action='store_true', help='ignora la restriccion de portal (solo pruebas)')
a = ap.parse_args()
hoy = date.fromisoformat(a.fecha) if a.fecha else None
if a.todos:
    app.config['RECORDATORIOS_COBRO_SOLO_PORTAL'] = False
with app.app_context():
    r = enviar_recordatorios(hoy=hoy, dry_run=not a.enviar, log=print, limite=a.limite)
    for d in r['detalle']:
        print(d)
    print({k: v for k, v in r.items() if k != 'detalle'})
