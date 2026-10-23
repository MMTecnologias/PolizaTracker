/* Siniestros · Nuevo siniestro: 1) buscar póliza y validar  2) proceso, tipo y datos del catálogo  3) crear.
   Se abre con el evento "siniestros:nuevo". Al crear dispara "siniestros:recargar" y abre el detalle. */
(function () {
   'use strict';
   const $ = s => document.querySelector(s);
   const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
   const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
   const ahora = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
   function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3200); }
   async function http(method, path, body) {
      const r = await fetch('/siniestros/api/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
      let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
      if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
      return j;
   }

   const mq = document.createElement('div');
   mq.className = 'mq-back'; mq.id = 'sn-modal'; mq.style.zIndex = 2050;
   mq.innerHTML = '<div class="mq-modal sn-modal"><header><h5>Nuevo siniestro</h5><span data-sn-x>&times;</span></header><div class="cuerpo">' +
      '<div class="sn-paso"><b>1</b> Busca la póliza</div>' +
      '<input class="form-control" id="sn-q" placeholder="Número de póliza, nombre del cliente o RFC" autocomplete="off">' +
      '<div id="sn-res" class="sn-res"></div><div id="sn-poliza"></div><div id="sn-form"></div></div>' +
      '<div class="aviso-val" id="sn-av" style="padding:0 20px"></div>' +
      '<footer><button class="btn" data-sn-x>Cancelar</button><button class="btn btn-primary" id="sn-ok" disabled>Crear siniestro</button></footer></div>';
   document.body.appendChild(mq);
   let P = null, V = null, F = null, timer = null;
   const cerrar = () => mq.classList.remove('on');
   mq.addEventListener('click', e => { if (e.target === mq || e.target.hasAttribute('data-sn-x')) cerrar(); });

   function abrir() {
      P = V = F = null; $('#sn-ok').textContent = 'Crear siniestro'; $('#sn-q').value = ''; $('#sn-res').innerHTML = ''; $('#sn-poliza').innerHTML = ''; $('#sn-form').innerHTML = ''; $('#sn-av').textContent = '';
      $('#sn-ok').disabled = true; mq.classList.add('on'); setTimeout(() => $('#sn-q').focus(), 60);
   }
   window.addEventListener('siniestros:nuevo', abrir);

   $('#sn-q').addEventListener('input', () => {
      clearTimeout(timer); const q = $('#sn-q').value.trim();
      if (q.length < 2) { $('#sn-res').innerHTML = ''; return; }
      timer = setTimeout(async () => {
         try {
            const j = await http('GET', 'polizas/buscar?q=' + encodeURIComponent(q));
            $('#sn-res').innerHTML = j.items.length ? j.items.map(p => '<div class="sn-r' + (p.bloqueo ? ' sn-no' : '') + '" data-id="' + p.id + '"><b>' + esc(p.poliza) + '</b> · ' + esc(p.cliente) + '<small>' + esc(p.aseguradora) + ' · ' + esc(p.ramo) + ' · ' + esc(p.subramo) + ' · vigencia ' + esc(p.inicio) + ' – ' + esc(p.fin) + '</small>' +
               (p.bloqueo ? '<span class="sn-tag bad">No procede: ' + esc(p.bloqueo) + '</span>' : '<span class="sn-tag ok">Procede</span>' + (p.aviso ? '<span class="sn-tag warn">' + esc(p.aviso) + '</span>' : '')) + '</div>').join('') : '<div class="sn-vacio">Sin resultados</div>';
         } catch (e) { $('#sn-res').innerHTML = '<div class="sn-vacio">' + esc(e.message) + '</div>'; }
      }, 250);
   });
   $('#sn-res').addEventListener('click', async e => {
      const r = e.target.closest('.sn-r'); if (!r) return;
      $('#sn-res').innerHTML = ''; $('#sn-form').innerHTML = ''; $('#sn-ok').disabled = true; $('#sn-av').textContent = '';
      try { V = await http('GET', 'polizas/' + r.dataset.id + '/validar'); } catch (er) { $('#sn-av').textContent = er.message; return; }
      F = null; P = V.poliza; $('#sn-q').value = P.poliza + ' · ' + P.cliente;
      tarjeta();
      if (!V.bloqueo) formulario();
   });

   function tarjeta() {
      const p = P;
      const val = V.bloqueo ? '<div class="sn-val bad">⛔ ' + esc(V.bloqueo) + '<br><small>No se puede abrir el siniestro. Avisa al cliente o revisa la póliza.</small></div>'
         : '<div class="sn-val ok">✔ Póliza ' + esc(p.status.toLowerCase()) + ' y recibo del periodo al corriente.</div>' + (V.aviso ? '<div class="sn-val warn">⚠ ' + esc(V.aviso) + ' Puedes continuar.</div>' : '');
      $('#sn-poliza').innerHTML = '<div class="sn-card"><div><small>Cliente / empresa</small><b>' + esc(p.cliente) + '</b></div><div><small>Póliza</small><b>' + esc(p.poliza) + '</b></div><div><small>Aseguradora</small><b>' + esc(p.aseguradora) + '</b></div>' +
         '<div><small>Ramo</small><b>' + esc(p.ramo) + ' · ' + esc(p.subramo) + '</b></div><div><small>Vigencia</small><b>' + esc(p.inicio) + ' – ' + esc(p.fin) + '</b></div><div><small>Siniestros activos</small><b>' + V.activos + '</b></div></div>' + val +
         '<p class="sn-nota">Estos datos vienen de la póliza; no se vuelven a capturar.</p>' + activosHTML();
   }

   function activosHTML() {
      if (!V.lista_activos.length) return '';
      return '<div class="sn-dup"><b>Esta póliza ya tiene ' + V.lista_activos.length + ' siniestro(s) activo(s)</b> (puede haber varios, de distinto afectado):<table>' +
         V.lista_activos.map(x => '<tr><td><b>' + esc(x.folio) + '</b></td><td>' + esc(x.proceso) + (x.tipo ? ' · ' + esc(x.tipo) : '') + '</td><td>' + esc(x.afectado || '—') + '</td><td>' + esc(x.estatus) + '</td><td>' + esc(x.apertura) + '</td></tr>').join('') + '</table></div>';
   }
   const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
   function posibleDuplicado(campos) {
      const nombre = F.cfg.campos.filter(c => c.nombre === 'Nombre del paciente / afectado' || c.nombre === 'Beneficiario').map(c => norm(campos[c.id])).find(v => v);
      return V.lista_activos.filter(x => x.proceso_id === F.proceso.id && (x.tipo_id || null) === (F.tipo || null) && norm(x.afectado) && norm(x.afectado) === nombre);
   }
   function formulario() {
      F = { proceso: V.procesos[0], tipo: null, confirmaDup: false };
      $('#sn-form').innerHTML = '<div class="sn-paso"><b>2</b> Datos del siniestro</div><div class="sn-g2"><div><label>Proceso *</label><select class="custom-select" id="sn-proc">' + V.procesos.map(p => '<option value="' + p.id + '">' + esc(p.nombre) + '</option>').join('') + '</select></div>' +
         '<div id="sn-tipo-w"><label>Tipo de siniestro *</label><select class="custom-select" id="sn-tipo"></select></div></div><div id="sn-campos"></div><div id="sn-extra"></div>';
      $('#sn-proc').onchange = () => { F.proceso = V.procesos.find(p => p.id === +$('#sn-proc').value); tiposYCampos(); };
      $('#sn-tipo').onchange = cargarCampos;
      tiposYCampos();
   }
   function tiposYCampos() {
      const t = F.proceso.tipos;
      $('#sn-tipo-w').style.display = t.length ? '' : 'none';
      $('#sn-tipo').innerHTML = '<option value="">Elige el tipo…</option>' + t.map(x => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join('');
      cargarCampos();
   }
   const INP = c => {
      const k = 'data-c="' + c.id + '"';
      if (c.tipo_dato === 'Texto largo') return '<textarea class="form-control" rows="3" ' + k + '></textarea>';
      if (c.tipo_dato === 'Número' || c.tipo_dato === 'Monto') return '<input class="form-control" type="number" min="0" step="' + (c.tipo_dato === 'Monto' ? '0.01' : '1') + '" ' + k + '>';
      if (c.tipo_dato === 'Fecha') return '<input class="form-control" type="date" ' + k + (c.nombre === 'Fecha recibido' ? ' value="' + hoy() + '"' : '') + '>';
      if (c.tipo_dato === 'Fecha y hora') return '<input class="form-control" type="datetime-local" ' + k + '>';
      if (c.tipo_dato === 'Sí / No') return '<select class="custom-select" ' + k + '><option value="">—</option><option>Sí</option><option>No</option></select>';
      if (c.tipo_dato === 'Lista') return '<select class="custom-select" ' + k + '><option value="">Elige…</option>' + c.opciones.map(o => '<option>' + esc(o) + '</option>').join('') + '</select>';
      return '<input class="form-control" type="text" ' + k + '>';
   };
   async function cargarCampos() {
      const tid = +$('#sn-tipo').value || 0, hayTipos = F.proceso.tipos.length;
      $('#sn-ok').disabled = true;
      if (hayTipos && !tid) { $('#sn-campos').innerHTML = '<p class="sn-nota">Elige el tipo para ver los datos y requisitos.</p>'; $('#sn-extra').innerHTML = ''; return; }
      try {
         F.tipo = tid || null;
         F.cfg = await http('GET', 'nuevo/campos?proceso_id=' + F.proceso.id + '&tipo_id=' + tid + '&aseguradora_id=' + aseId());
      } catch (e) { $('#sn-av').textContent = e.message; return; }
      $('#sn-av').textContent = '';
      $('#sn-campos').innerHTML = '<div class="sn-g2">' + F.cfg.campos.map(c => '<div' + (c.tipo_dato === 'Texto largo' ? ' style="grid-column:1/-1"' : '') + '><label>' + esc(c.nombre) + (c.obligatorio ? ' *' : '') + '</label>' + INP(c) + '</div>').join('') + '</div>';
      const reqs = F.cfg.requisitos.length ? '<div class="sn-req"><b>Requisitos que se pedirán al cliente</b><ul>' + F.cfg.requisitos.map(r => '<li>' + esc(r.nombre) + (r.obligatorio ? '' : ' <small>(opcional)</small>') + '</li>').join('') + '</ul></div>'
         : (tid ? '<p class="sn-nota">No hay plantilla de requisitos para esta aseguradora y tipo (se configura en Plantillas).</p>' : '');
      $('#sn-extra').innerHTML = reqs + '<div class="sn-g2"><div><label>Plazo de atención (provisional)</label><input class="form-control" type="datetime-local" id="sn-plazo" value="' + esc(F.cfg.plazo) + '"><small style="color:#888">' + esc(F.cfg.plazo_texto) + (F.cfg.plazo_nota ? ' · ' + esc(F.cfg.plazo_nota) : '') + '</small></div><div><label>Comentario inicial (opcional)</label><input class="form-control" id="sn-com" placeholder="Queda en la bitácora"></div></div>';
      $('#sn-ok').disabled = false;
   }
   const aseId = () => P.aseguradora_id || 0;

   $('#sn-form').addEventListener('input', () => { if (F) { F.confirmaDup = false; $('#sn-ok').textContent = 'Crear siniestro'; } });
   $('#sn-ok').onclick = async () => {
      const campos = {}; document.querySelectorAll('#sn-campos [data-c]').forEach(el => { campos[el.dataset.c] = el.value.trim(); });
      for (const c of F.cfg.campos) if (c.obligatorio && !campos[c.id]) { $('#sn-av').textContent = '«' + c.nombre + '» es obligatorio.'; return; }
      const dup = posibleDuplicado(campos);
      if (dup.length && !F.confirmaDup) {
         $('#sn-av').innerHTML = '⚠ <b>Posible duplicado:</b> ya existe ' + dup.map(x => esc(x.folio)).join(', ') + ' activo con el mismo proceso, tipo y afectado. Si es un trámite distinto, vuelve a pulsar «Crear siniestro» para confirmar.';
         F.confirmaDup = true; $('#sn-ok').textContent = 'Crear de todos modos'; return;
      }
      $('#sn-ok').disabled = true; $('#sn-av').textContent = '';
      try {
         const r = await http('POST', 'siniestros', { poliza_id: P.id, proceso_id: F.proceso.id, tipo_id: F.tipo, campos, fecha_limite: $('#sn-plazo').value || null, comentario: $('#sn-com').value });
         cerrar(); toast('Siniestro ' + r.folio + ' creado. Ya está en Activos.');
         window.dispatchEvent(new Event('siniestros:recargar'));
         window.dispatchEvent(new CustomEvent('siniestros:accion', { detail: { a: 'comunicacion', id: r.id, pref: 'req' } }));
      } catch (e) { $('#sn-av').textContent = e.message; $('#sn-ok').disabled = false; }
   };
})();
