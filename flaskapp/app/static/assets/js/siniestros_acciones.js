/* Siniestros · acciones de Activos: detalle (panel), actualizar estatus, bitácora, pagos, montos,
   derivados, comunicación y cierre. Escucha el evento "siniestros:accion" {a, id, f} que disparan
   las tablas, y avisa con "siniestros:recargar" cuando algo cambia para refrescar Activos. */
(function () {
   'use strict';
   const $ = s => document.querySelector(s), $$ = s => [].slice.call(document.querySelectorAll(s));
   const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
   const money = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
   function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3000); }
   async function http(method, path, body) {
      const fd = body instanceof FormData;
      const r = await fetch('/siniestros/api/' + path, { method, headers: body && !fd ? { 'Content-Type': 'application/json' } : {}, body: body ? (fd ? body : JSON.stringify(body)) : undefined, credentials: 'same-origin' });
      let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
      if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
      return j;
   }
   function fmtDato(x) {
      const v = x.valor; if (!v) return '';
      if (x.tipo === 'Fecha') { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : v; }
      if (x.tipo === 'Fecha y hora') { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] : v; }
      if (x.tipo === 'Monto') return money(v);
      return v;
   }
   const chip = (c, t) => '<span class="chip ' + c + '">' + esc(t) + '</span>';
   const avisar = () => window.dispatchEvent(new Event('siniestros:recargar'));

   /* ---------- modal de formulario genérico ---------- */
   const mq = document.createElement('div');
   mq.className = 'mq-back'; mq.id = 'sa-modal'; mq.style.zIndex = 2100;
   mq.innerHTML = '<div class="mq-modal"><header><h5 id="sa-tit"></h5><span data-sa-x>&times;</span></header><div class="cuerpo" id="sa-body"></div><div class="aviso-val" id="sa-av" style="padding:0 20px"></div><footer><button class="btn" data-sa-x>Cancelar</button><button class="btn btn-primary" id="sa-ok">Guardar</button></footer></div>';
   document.body.appendChild(mq);
   const cerrarForm = () => mq.classList.remove('on');
   mq.addEventListener('click', e => { if (e.target === mq || e.target.hasAttribute('data-sa-x')) cerrarForm(); });

   function form(titulo, campos, okTxt, fn, opts) {
      opts = opts || {};
      $('#sa-tit').textContent = titulo; $('#sa-av').textContent = '';
      $('#sa-body').innerHTML = campos.map(c => {
         if (c.t === 'info') return '<div class="sa-info ' + (c.cls || '') + '">' + c.h + '</div>';
         let h = '<label>' + esc(c.l) + (c.req ? ' *' : '') + '</label>';
         const v = c.v == null ? '' : c.v;
         if (c.t === 'text' || c.t === 'date' || c.t === 'datetime-local') h += '<input class="form-control" type="' + c.t + '" data-k="' + c.k + '" value="' + esc(v) + '" placeholder="' + esc(c.ph || '') + '"' + (c.max ? ' max="' + c.max + '"' : '') + '>';
         else if (c.t === 'number') h += '<input class="form-control" type="number" min="0" step="0.01" data-k="' + c.k + '" value="' + esc(v) + '" placeholder="' + esc(c.ph || '0.00') + '">';
         else if (c.t === 'area') h += '<textarea class="form-control" rows="' + (c.rows || 3) + '" data-k="' + c.k + '" placeholder="' + esc(c.ph || '') + '">' + esc(v) + '</textarea>';
         else if (c.t === 'select') h += '<select class="custom-select" data-k="' + c.k + '">' + (c.vacio ? '<option value="">' + esc(c.vacio) + '</option>' : '') + c.o.map(o => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') + '</select>';
         else if (c.t === 'file') h += '<input class="form-control" type="file" data-k="' + c.k + '" accept="' + (c.accept || '') + '" style="height:auto;padding:6px">';
         if (c.hint) h += '<small style="color:#888">' + esc(c.hint) + '</small>';
         return h;
      }).join('');
      const ok = $('#sa-ok'); ok.textContent = okTxt; ok.style.background = opts.peligro ? '#b03a2e' : ''; ok.style.borderColor = opts.peligro ? '#b03a2e' : '';
      mq.classList.add('on');
      const prim = $('#sa-body [data-k]'); if (prim) setTimeout(() => prim.focus(), 50);
      if (opts.onChange) $$('#sa-body [data-k]').forEach(el => el.addEventListener('change', () => opts.onChange(el)));
      ok.onclick = async () => {
         const o = {};
         campos.forEach(c => { if (c.t === 'info') return; const el = $('#sa-body [data-k="' + c.k + '"]'); o[c.k] = c.t === 'file' ? (el.files[0] || null) : el.value.trim(); });
         for (const c of campos) if (c.req && !o[c.k]) { $('#sa-av').textContent = '«' + c.l + '» es obligatorio.'; return; }
         ok.disabled = true;
         try { await fn(o); cerrarForm(); } catch (e) { $('#sa-av').textContent = e.message; } finally { ok.disabled = false; }
      };
   }

   /* ---------- panel de detalle ---------- */
   const panel = document.createElement('div');
   panel.id = 'sa-panel'; panel.className = 'sa-panel';
   panel.innerHTML = '<div class="sa-fondo" data-sa-p></div><aside class="sa-cuerpo"><div class="sa-cab" id="sa-cab"></div><div class="sa-acc" id="sa-acc"></div><div class="sa-tabs" id="sa-tabs"></div><div class="sa-cont" id="sa-cont"></div></aside>';
   document.body.appendChild(panel);
   let D = null, TAB = 'info', SOLO = false;
   const cerrarPanel = () => { panel.classList.remove('on'); D = null; };
   panel.addEventListener('click', e => { if (e.target.hasAttribute('data-sa-p') || e.target.closest('[data-sa-cp]')) cerrarPanel(); });
   document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mq.classList.contains('on') && panel.classList.contains('on')) cerrarPanel(); });

   const AC = { estatus: 'Actualizar estatus', nota: 'Agregar a bitácora', pago: 'Registrar pago', derivado: 'Crear derivado', comunicacion: 'Enviar comunicación', cerrar: 'Cerrar siniestro', reabrir: 'Reabrir siniestro' };
   function cabecera() {
      const e = D.estatus, c = e.tipo === 'aseguradora' ? 'chip-aseg' : e.tipo === 'pendiente' ? 'chip-pend' : 'chip-otro';
      const est = D.estado === 'Cerrado' ? chip(D.resultado === 'Procedente' ? 'chip-ok' : D.resultado === 'Rechazado' ? 'chip-bad' : 'chip-gris', 'Cerrado · ' + D.resultado) : chip(c, e.nombre);
      $('#sa-cab').innerHTML = '<div><div class="sa-folio">' + esc(D.folio) + '</div><div class="sa-sub">' + esc(D.proceso.nombre) + (D.tipo ? ' · ' + esc(D.tipo) : '') + ' · ' + esc(D.cliente.nombre) + '</div><div style="margin-top:6px">' + est +
         (D.origen ? ' ' + chip('chip-der', 'Derivado de ' + D.origen.folio) : '') + '</div></div><button class="sa-x" data-sa-cp title="Cerrar">&times;</button>';
      const abierto = D.estado === 'Activo';
      const btn = (k, off, tt) => '<button class="sa-btn sa-b' + (off ? ' off' : '') + '" data-ac="' + k + '"' + (tt ? ' title="' + esc(tt) + '"' : '') + '>' + AC[k] + '</button>';
      $('#sa-acc').innerHTML = (abierto ? btn('estatus') + btn('pago') + btn('derivado', D.proceso.grupo === 'VIDA', 'VIDA no genera derivados') : '') + btn('nota') + btn('comunicacion') + (abierto ? '' : btn('reabrir')) +
         (abierto ? btn('cerrar', D.derivados_abiertos > 0, D.derivados_abiertos ? 'Tiene ' + D.derivados_abiertos + ' derivado(s) abierto(s)' : '') : '');
      const tabs = [['info', 'Información'], ['pagos', 'Pagos (' + D.pagos.length + ')'], ['familia', 'Familia (' + D.familia.length + ')'], ['bit', 'Bitácora (' + D.bitacora.length + ')']];
      $('#sa-tabs').innerHTML = tabs.map(t => '<a data-t="' + t[0] + '" class="' + (t[0] === TAB ? 'activa' : '') + '">' + t[1] + '</a>').join('');
   }
   const fila = (k, v) => '<div class="sa-f"><small>' + k + '</small><span>' + (v === '' || v == null ? '—' : v) + '</span></div>';
   function pestana() {
      const m = D.montos, ab = D.estado === 'Activo';
      let h = '';
      if (TAB === 'info') {
                  h = '<div class="sa-grid">' + fila('Cliente', esc(D.cliente.nombre)) + fila('Teléfono', esc(D.cliente.telefono)) + fila('Correo', esc(D.cliente.correo)) +
            fila('Aseguradora', esc(D.aseguradora)) + fila('Póliza', esc(D.poliza.numero) + ' ' + chip(D.poliza.status === 'Vigente' ? 'chip-ok' : 'chip-gris', D.poliza.status)) + fila('Vigencia', esc(D.poliza.inicio) + ' – ' + esc(D.poliza.fin)) +
            fila('Apertura', esc(D.apertura)) + fila('Fecha límite', esc(D.limite)) + fila('Plazo', ab ? '<span class="plazo p-' + D.plazo_nivel + '">' + (D.plazo_nivel !== 'none' ? '<i></i>' : '') + esc(D.plazo) + '</span>' : '—') +
            fila('Última actualización', esc(D.ultima)) + fila(D.estado === 'Cerrado' ? 'Cierre' : 'Estado', D.estado === 'Cerrado' ? esc(D.cierre) : 'Activo') + '</div>' +
            (D.datos.length || ab ? '<div class="sa-sec"><h6>Datos del siniestro</h6>' + (ab ? '<button class="sa-btn" data-ac="datos">Editar datos</button>' : '') + '</div><div class="sa-grid">' + D.datos.map(x => fila(esc(x.campo), esc(fmtDato(x)))).join('') + '</div>' : '') +
            '<div class="sa-sec"><h6>Montos</h6>' + (ab ? '<button class="sa-btn" data-ac="montos">Editar montos</button>' : '') + '</div>' +
            '<div class="sa-montos">' + [['Reclamado', m.reclamado], ['Aprobado', m.aprobado], ['Deducible', m.deducible], ['Coaseguro', m.coaseguro], ['Pagado', m.pagado], ['Pendiente por pagar', m.pendiente]].map(x => '<div class="' + (x[0].startsWith('Pend') && x[1] > 0 ? 'pend' : '') + '"><small>' + x[0] + '</small><b>' + money(x[1]) + '</b></div>').join('') + '</div>' +
            (m.aprobado == null ? '<p class="sa-nota">Captura el monto aprobado para calcular el pendiente por pagar.</p>' : '');
      } else if (TAB === 'pagos') {
         h = '<div class="sa-sec"><h6>Pagos del siniestro</h6>' + (ab ? '<button class="sa-btn pri" data-ac="pago">Registrar pago</button>' : '') + '</div>';
         h += D.pagos.length ? '<table class="sa-tb"><thead><tr><th>Fecha</th><th>Concepto</th><th>Beneficiario</th><th style="text-align:right">Monto</th><th>Estado</th><th></th></tr></thead><tbody>' +
            D.pagos.map(p => '<tr' + (p.estado === 'Cancelado' ? ' style="opacity:.55"' : '') + '><td class="mono">' + (p.fecha ? esc(p.fecha) : '<span style="color:#999">Sin fecha</span>') + '</td><td>' + esc(p.concepto) + '</td><td>' + esc(p.beneficiario) + '</td><td class="mono" style="text-align:right">' + money(p.monto) + '</td><td>' + chip(p.estado === 'Pagado' ? 'chip-ok' : p.estado === 'Pendiente' ? 'chip-gris' : 'chip-bad', p.estado === 'Pendiente' ? 'Pendiente de pago' : p.estado) + (p.motivo ? '<br><small>' + esc(p.motivo) + '</small>' : '') + '</td><td>' +
               (p.comprobante ? '<a href="/siniestros/api/pagos/' + p.id + '/comprobante" target="_blank">Comprobante</a> ' : '') + (ab && p.estado === 'Pendiente' ? '<a href="#" data-mp="' + p.id + '" data-m="' + p.monto + '">Marcar pagado</a> ' : '') + (ab && p.estado !== 'Cancelado' ? '<a href="#" data-cp="' + p.id + '" data-m="' + p.monto + '">Cancelar</a>' : '') + '</td></tr>').join('') + '</tbody></table>' : '<p class="sa-vacio">Todavía no hay pagos registrados.</p>';
         h += '<div class="sa-montos" style="margin-top:12px"><div><small>Aprobado</small><b>' + money(m.aprobado) + '</b></div><div><small>Pagado</small><b>' + money(m.pagado) + '</b></div><div><small>Pagos pendientes de pago</small><b>' + money(m.por_pagar) + '</b></div><div class="' + (m.pendiente > 0 ? 'pend' : '') + '"><small>Pendiente</small><b>' + money(m.pendiente) + '</b></div></div>';
      } else if (TAB === 'familia') {
         const t = D.familia_totales;
         h = D.familia.length > 1 ? '<table class="sa-tb"><thead><tr><th>Siniestro</th><th>Proceso</th><th>Estatus</th><th style="text-align:right">Pagado</th></tr></thead><tbody>' +
            D.familia.map(f => '<tr' + (f.actual ? ' class="actual"' : '') + '><td style="padding-left:' + (8 + f.nivel * 22) + 'px">' + (f.nivel ? '↳ ' : '') + '<a href="#" data-ver="' + f.id + '"><b>' + esc(f.folio) + '</b></a>' + (f.actual ? ' <small>(este)</small>' : '') + '</td><td>' + esc(f.proceso) + '</td><td>' + (f.estado === 'Cerrado' ? chip('chip-gris', 'Cerrado · ' + f.resultado) : esc(f.estatus)) + '</td><td class="mono" style="text-align:right">' + money(f.pagado) + '</td></tr>').join('') +
            '</tbody></table><div class="sa-montos" style="margin-top:12px"><div><small>Reclamado (familia)</small><b>' + money(t.reclamado) + '</b></div><div><small>Aprobado (familia)</small><b>' + money(t.aprobado) + '</b></div><div><small>Pagado (familia)</small><b>' + money(t.pagado) + '</b></div><div class="' + (t.pendiente > 0 ? 'pend' : '') + '"><small>Pendiente (familia)</small><b>' + money(t.pendiente) + '</b></div></div>'
            : '<p class="sa-vacio">Este siniestro no tiene derivados ni viene de otro.</p>';
      } else {
         h = '<div class="sa-sec"><h6>Bitácora (no se puede editar)</h6><button class="sa-btn" data-ac="nota">Agregar nota</button></div><div class="sa-bit">' +
            D.bitacora.map(b => '<div class="sa-b-i"><div class="sa-b-h"><b>' + esc(b.accion) + '</b><span>' + esc(b.fecha) + ' · ' + esc(b.usuario) + '</span></div><div>' + esc(b.detalle) + '</div></div>').join('') + '</div>';
      }
      $('#sa-cont').innerHTML = h;
   }
   $('#sa-tabs').addEventListener('click', e => { const t = e.target.dataset.t; if (!t) return; TAB = t; cabecera(); pestana(); });
   async function abrirDetalle(id, tab) {
      try { D = await http('GET', 'siniestros/' + id); } catch (e) { toast(e.message); return; }
      TAB = tab || 'info'; panel.classList.add('on'); cabecera(); pestana();
   }
   const refrescar = async (tab) => { if (!D) return; const id = D.id; D = await http('GET', 'siniestros/' + id); if (tab) TAB = tab; cabecera(); pestana(); avisar(); };

   panel.addEventListener('click', e => {
      const a = e.target.closest('[data-ac]');
      if (a && !a.classList.contains('off')) { ACCIONES[a.dataset.ac](); return; }
      if (a) { toast(a.title || 'Acción no disponible'); return; }
      const mp = e.target.closest('[data-mp]');
      if (mp) { e.preventDefault(); marcarPagado(+mp.dataset.mp, +mp.dataset.m); return; }
      const cp = e.target.closest('[data-cp]');
      if (cp) { e.preventDefault(); cancelarPago(+cp.dataset.cp, +cp.dataset.m); return; }
      const v = e.target.closest('[data-ver]');
      if (v) { e.preventDefault(); abrirDetalle(+v.dataset.ver, 'info'); }
   });

   /* ---------- acciones ---------- */
   const ACCIONES = {
      async estatus() {
         const j = await http('GET', 'siniestros/' + D.id + '/estatus-opciones');
         const op = j.items.filter(x => x.id !== D.estatus.id);
         if (!op.length) { toast('No hay otros estatus activos en este proceso. Agrégalos en Plantillas › Estatus.'); return; }
         form('Actualizar estatus · ' + D.folio, [
            { t: 'info', h: 'Estatus actual: <b>' + esc(D.estatus.nombre) + '</b>' },
            { k: 'estatus_id', l: 'Nuevo estatus', t: 'select', o: op.map(x => ({ v: x.id, t: x.nombre })), req: 1 },
            { k: 'comentario', l: 'Comentario', t: 'area', req: 1, ph: 'Qué pasó, con quién se habló, qué sigue…' },
            { k: 'fecha_limite', l: 'Nuevo plazo (opcional)', t: 'datetime-local', hint: 'Déjalo vacío para conservar el plazo actual.' }
         ], 'Actualizar', async o => { await http('POST', 'siniestros/' + D.id + '/estatus', { estatus_id: +o.estatus_id, comentario: o.comentario, fecha_limite: o.fecha_limite || null }); toast('Estatus actualizado y registrado en bitácora.'); await refrescar('bit'); });
      },
      reabrir() { const r = { id: D.id, folio: D.folio, proceso_clave: D.proceso.clave }; cerrarPanel(); window.dispatchEvent(new CustomEvent('siniestros:reabrir', { detail: r })); },
      nota() {
         form('Agregar a bitácora · ' + D.folio, [{ k: 'texto', l: 'Nota', t: 'area', rows: 4, req: 1, ph: 'Llamada, acuerdo, documento recibido…' }], 'Guardar nota',
            async o => { await http('POST', 'siniestros/' + D.id + '/nota', o); toast('Nota agregada a la bitácora.'); await refrescar('bit'); });
      },
      pago() {
         form('Registrar pago · ' + D.folio, [
            { t: 'info', h: 'Los pagos <b>no se editan</b>: si te equivocas, se cancela con motivo y se registra otro.' },
            { k: 'concepto', l: 'Concepto', t: 'select', o: D.conceptos.map(c => ({ v: c, t: c })), req: 1 },
            { k: 'monto', l: 'Monto', t: 'number', req: 1 },
            { k: 'estado', l: 'Estado del pago', t: 'select', o: [{ v: 'Pagado', t: 'Pagado' }, { v: 'Pendiente', t: 'Pendiente de pago' }], req: 1, hint: 'Si queda pendiente, después lo marcas como pagado desde aquí o desde la pestaña Pagos.' },
            { k: 'fecha_pago', l: 'Fecha de pago (sólo si ya está pagado)', t: 'date', v: hoy(), max: hoy() },
            { k: 'beneficiario', l: 'Beneficiario' + (D.proceso.clave === 'VI' ? '' : ' (opcional)'), t: 'text', req: D.proceso.clave === 'VI', hint: D.proceso.clave === 'VI' ? 'En VIDA se registra un pago por beneficiario.' : '' },
            { k: 'comprobante', l: 'Comprobante (opcional)', t: 'file', accept: '.pdf,.jpg,.jpeg,.png', hint: 'PDF, JPG o PNG · máximo 10 MB' }
         ], 'Registrar pago', async o => {
            const fd = new FormData(); ['concepto', 'monto', 'estado', 'fecha_pago', 'beneficiario'].forEach(k => fd.append(k, o[k] || '')); if (o.comprobante) fd.append('comprobante', o.comprobante);
            await http('POST', 'siniestros/' + D.id + '/pagos', fd); toast(o.estado === 'Pendiente' ? 'Pago registrado como pendiente de pago.' : 'Pago registrado.'); await refrescar('pagos');
         });
      },
      async datos() {
         const j = await http('GET', 'siniestros/' + D.id + '/datos');
         const T = { 'Texto largo': 'area', 'Número': 'number', 'Monto': 'number', 'Fecha': 'date', 'Fecha y hora': 'datetime-local' };
         const campos = j.campos.map(c => c.tipo_dato === 'Lista' || c.tipo_dato === 'Sí / No'
            ? { k: String(c.id), l: c.nombre, t: 'select', vacio: '—', v: c.valor, req: c.obligatorio, o: (c.tipo_dato === 'Lista' ? c.opciones : ['Sí', 'No']).map(x => ({ v: x, t: x })) }
            : { k: String(c.id), l: c.nombre, t: T[c.tipo_dato] || 'text', v: c.valor, req: c.obligatorio });
         form('Editar datos · ' + D.folio, [{ t: 'info', h: 'Corrige cualquier dato capturado. Cada cambio queda en la bitácora con el valor anterior y el nuevo.' }, ...campos], 'Guardar cambios',
            async o => { await http('PUT', 'siniestros/' + D.id + '/datos', { campos: o }); toast('Datos actualizados y registrados en bitácora.'); await refrescar(); });
      },
      montos() {
         const m = D.montos;
         form('Montos · ' + D.folio, [
            { k: 'monto_reclamado', l: 'Monto reclamado', t: 'number', v: m.reclamado }, { k: 'monto_aprobado', l: 'Monto aprobado', t: 'number', v: m.aprobado },
            { k: 'deducible', l: 'Deducible', t: 'number', v: m.deducible }, { k: 'coaseguro', l: 'Coaseguro', t: 'number', v: m.coaseguro },
            { t: 'info', h: 'Pendiente por pagar = aprobado − pagos vigentes. Los cambios quedan en bitácora.' }
         ], 'Guardar montos', async o => { await http('PUT', 'siniestros/' + D.id + '/montos', o); toast('Montos guardados.'); await refrescar(); });
      },
      async derivado() {
         const j = await http('GET', 'siniestros/' + D.id + '/derivados/opciones');
         if (j.bloqueo) { form('No se puede crear el derivado', [{ t: 'info', cls: 'sa-err', h: esc(j.bloqueo) }], 'Entendido', async () => { }); return; }
         if (!j.permitido) { toast(j.motivo || 'No se pueden crear derivados desde este siniestro.'); return; }
         const tiposDe = id => (j.procesos.find(p => p.id === +id) || { tipos: [] }).tipos;
         form('Crear siniestro derivado · ' + D.folio, [
            ...(j.aviso ? [{ t: 'info', cls: 'sa-warn', h: '⚠ ' + esc(j.aviso) + ' Puedes continuar.' }] : []),
            { t: 'info', h: 'El siniestro de origen <b>sigue abierto</b>. El derivado hereda póliza y aseguradora.' },
            { k: 'proceso_id', l: 'Proceso del derivado', t: 'select', o: j.procesos.map(p => ({ v: p.id, t: p.nombre })), req: 1 },
            { k: 'tipo_id', l: 'Tipo de siniestro (opcional)', t: 'select', vacio: 'Sin tipo', o: tiposDe(j.procesos[0].id).map(t => ({ v: t.id, t: t.nombre })) },
            { k: 'fecha_limite', l: 'Plazo (opcional)', t: 'datetime-local' },
            { k: 'comentario', l: 'Comentario (opcional)', t: 'area', rows: 2 }
         ], 'Crear derivado', async o => {
            const r = await http('POST', 'siniestros/' + D.id + '/derivado', { proceso_id: +o.proceso_id, tipo_id: o.tipo_id || null, fecha_limite: o.fecha_limite || null, comentario: o.comentario });
            toast('Derivado ' + r.folio + ' creado. Ya está en Activos.'); await refrescar('familia');
         }, { onChange: el => { if (el.dataset.k !== 'proceso_id') return; $('#sa-body [data-k="tipo_id"]').innerHTML = '<option value="">Sin tipo</option>' + tiposDe(el.value).map(t => '<option value="' + t.id + '">' + esc(t.nombre) + '</option>').join(''); } });
      },
      async comunicacion(pref) {
         const j = await http('GET', 'siniestros/' + D.id + '/comunicacion');
         if (!j.mensajes.length) { toast('No hay mensajes activos para este proceso. Agrégalos en Plantillas › Mensajes.'); return; }
         const ini = (pref === 'req' && j.mensajes.find(m => m.requisitos)) || j.mensajes[0];
         form('Enviar comunicación · ' + D.folio, [
            ...(pref === 'req' ? [{ t: 'info', h: '✔ Siniestro creado. Envía ahora al cliente la lista de documentos que debe entregar.' }] : []),
            { k: 'msg', l: 'Mensaje', t: 'select', v: ini.id, o: j.mensajes.map(m => ({ v: m.id, t: m.nombre })), req: 1 },
            { k: 'texto', l: 'Texto (puedes editarlo antes de enviar)', t: 'area', rows: 9, v: ini.texto },
            { t: 'info', h: '<div class="sa-envio"><button type="button" class="sa-btn" id="sa-cop">Copiar</button> <button type="button" class="sa-btn" id="sa-wa">WhatsApp' + (j.telefono ? '' : ' (sin teléfono)') + '</button> <button type="button" class="sa-btn" id="sa-mail">Correo' + (j.correo ? '' : ' (sin correo)') + '</button></div><small>El correo sale a nombre de ' + esc(j.remitente || 'tu usuario') + '. Cada envío queda registrado en la bitácora.</small>' }
         ], 'Cerrar', async () => { }, {
            onChange: el => { if (el.dataset.k === 'msg') $('#sa-body [data-k="texto"]').value = j.mensajes.find(m => m.id === +el.value).texto; }
         });
         const reg = (canal) => { const m = j.mensajes.find(x => x.id === +$('#sa-body [data-k="msg"]').value); http('POST', 'siniestros/' + D.id + '/comunicacion/registrar', { mensaje: m.nombre, canal }).then(() => refrescar()).catch(e => toast(e.message)); };
         const txt = () => $('#sa-body [data-k="texto"]').value;
         $('#sa-cop').onclick = () => { const f = () => { toast('Texto copiado.'); reg('Copiado'); }; if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt()).then(f).catch(() => { $('#sa-body [data-k="texto"]').select(); document.execCommand('copy'); f(); }); else { $('#sa-body [data-k="texto"]').select(); document.execCommand('copy'); f(); } };
         $('#sa-wa').onclick = () => { if (!j.telefono) { toast('El cliente no tiene teléfono móvil registrado.'); return; } let t = String(j.telefono).replace(/\D/g, ''); if (t.length === 10) t = '52' + t; window.open('https://wa.me/' + t + '?text=' + encodeURIComponent(txt()), '_blank'); reg('WhatsApp'); };
         $('#sa-mail').onclick = async () => {
            if (!j.correo) { toast('El cliente no tiene correo registrado.'); return; }
            if (!j.remitente) { toast('Tu usuario no tiene correo registrado.'); return; }
            const m = j.mensajes.find(x => x.id === +$('#sa-body [data-k="msg"]').value), b = $('#sa-mail');
            b.disabled = true; b.textContent = 'Enviando…';
            try {
               const r = await http('POST', 'siniestros/' + D.id + '/comunicacion/correo', { mensaje: m.nombre, texto: txt(), asunto: 'Siniestro ' + D.folio + ' · ' + m.nombre });
               toast(r.simulado ? 'Modo prueba: el servidor no tiene correo configurado, no se envió.' : 'Correo enviado a ' + r.para + (r.copia ? ' (copia a ' + j.remitente + ')' : ''));
               await refrescar();
            } catch (e) { toast(e.message); }
            b.disabled = false; b.textContent = 'Correo';
         };
      },
      async cerrar() {
         const j = await http('GET', 'siniestros/' + D.id + '/cerrar-opciones');
         if (j.derivados_abiertos) { toast('No se puede cerrar: tiene ' + j.derivados_abiertos + ' derivado(s) abierto(s).'); return; }
         if (!j.estatus.length) { toast('Este proceso no tiene estatus finales activos. Agrégalos en Plantillas › Estatus.'); return; }
         form('Cerrar siniestro · ' + D.folio, [
            { t: 'info', h: 'Al cerrarlo sale de Activos y pasa al Historial. Se puede reabrir desde ahí.' },
            { k: 'resultado', l: 'Resultado', t: 'select', o: j.resultados.map(r => ({ v: r, t: r })), req: 1 },
            { k: 'estatus_id', l: 'Estatus final', t: 'select', o: j.estatus.map(x => ({ v: x.id, t: x.nombre })), req: 1 },
            { k: 'comentario', l: 'Comentario de cierre', t: 'area', req: 1 }
         ], 'Cerrar siniestro', async o => { await http('POST', 'siniestros/' + D.id + '/cerrar', { resultado: o.resultado, estatus_id: +o.estatus_id, comentario: o.comentario }); toast('Siniestro cerrado. Quedó en el Historial.'); cerrarPanel(); avisar(); }, { peligro: true });
      }
   };
   function marcarPagado(pid, monto) {
      form('Marcar como pagado · ' + money(monto), [
         { k: 'fecha_pago', l: 'Fecha en que se pagó', t: 'date', v: hoy(), max: hoy(), req: 1 },
         { k: 'comprobante', l: 'Comprobante (opcional)', t: 'file', accept: '.pdf,.jpg,.jpeg,.png', hint: 'PDF, JPG o PNG · máximo 10 MB' }
      ], 'Marcar como pagado', async o => {
         const fd = new FormData(); fd.append('fecha_pago', o.fecha_pago || ''); if (o.comprobante) fd.append('comprobante', o.comprobante);
         await http('POST', 'pagos/' + pid + '/pagar', fd); toast('Pago marcado como pagado. Quedó en bitácora.'); await refrescar('pagos');
      });
   }
   function cancelarPago(pid, monto) {
      form('Cancelar pago por ' + money(monto), [{ k: 'motivo', l: 'Motivo de la cancelación', t: 'area', req: 1 }], 'Cancelar pago',
         async o => { await http('POST', 'pagos/' + pid + '/cancelar', o); toast('Pago cancelado. El registro se conserva.'); await refrescar('pagos'); }, { peligro: true });
   }
   Object.keys(ACCIONES).forEach(k => { const f = ACCIONES[k]; ACCIONES[k] = (...a) => Promise.resolve(f(...a)).catch(e => toast(e.message)); });

   /* ---------- entrada desde las tablas ---------- */
   window.addEventListener('siniestros:accion', async e => {
      const { a, id, pref } = e.detail;
      if (a === 'ver') { abrirDetalle(id, 'info'); return; }
      await abrirDetalle(id, a === 'pago' || a === 'pagar' ? 'pagos' : a === 'bitacora' ? 'bit' : 'info');
      if (!D) return;
      if (a === 'pagar') { marcarPagado(e.detail.pid, e.detail.monto); return; }
      const k = { estatus: 'estatus', bitacora: 'nota', pago: 'pago', derivado: 'derivado', comunicacion: 'comunicacion', cerrar: 'cerrar' }[a];
      if (k) { if (k === 'cerrar' && D.derivados_abiertos) { toast('No se puede cerrar: tiene ' + D.derivados_abiertos + ' derivado(s) abierto(s).'); return; } ACCIONES[k](pref); }
   });
})();
