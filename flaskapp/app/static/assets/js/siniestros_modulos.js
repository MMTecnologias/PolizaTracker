/* Siniestros · Historial, Pagos, Plantillas (requisitos, campos, tipos, estatus, mensajes) y Reportes.
   Misma mecánica que siniestros_tabla.js: se trae todo en JSON, se filtra/pagina en el navegador,
   las filas se ajustan al alto de pantalla y los exports replican Pólizas. */
(function () {
   'use strict';
   const $ = s => document.querySelector(s), $$ = s => [].slice.call(document.querySelectorAll(s));
   const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
   const money = n => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   const hoy = () => new Date().toISOString().slice(0, 10);
   function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2800); }

   async function http(method, path, body) {
      const r = await fetch('/siniestros/api/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
      let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
      if (!r.ok) { const e = new Error(j.error || ('Error ' + r.status)); e.status = r.status; throw e; }
      return j;
   }

   const D = { cat: null, hist: [], pagos: [], tipos: [], campos: [], estatus: [], plant: [], msgs: [], reqCat: [] };
   const PN = c => (D.cat.procesos.find(p => p.clave === c) || {}).nombre || c;
   const KEYS = () => D.cat.procesos.map(p => p.clave);
   const chip = (c, t) => '<span class="chip ' + c + '">' + esc(t) + '</span>';
   const EA = a => a ? chip('chip-ok', 'Activo') : chip('chip-gris', 'Inactivo');

   /* ---------------- exportar / imprimir (igual que Pólizas) ---------------- */
   let logoCache = null;
   function logoBase64() {
      if (logoCache) return Promise.resolve(logoCache);
      return fetch(document.querySelector('.logo-ggc').getAttribute('src')).then(r => r.blob()).then(b => new Promise((ok, no) => {
         const fr = new FileReader(); fr.onloadend = () => { logoCache = fr.result; ok(fr.result); }; fr.onerror = no; fr.readAsDataURL(b);
      }));
   }
   async function construirPdf(cfg, rows) {
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('La librería jsPDF no cargó (revisa si el CDN está bloqueado).');
      const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
      if (typeof doc.autoTable !== 'function') throw new Error('El plugin jspdf-autotable no cargó.');
      let x = 14;
      try { const l = await logoBase64(), w = 12, h = w * (1024 / 615); doc.addImage(l, 'PNG', 14, 8, w, h); x = 14 + w + 6; } catch (e) { /* sin logo */ }
      doc.setFontSize(14); doc.text(cfg.titulo, x, 18);
      doc.setFontSize(9); doc.setTextColor(120); doc.text('Generado: ' + new Date().toLocaleString('es-MX') + (cfg.sub ? '  ·  ' + cfg.sub : ''), x, 24); doc.setTextColor(0);
      doc.autoTable({ startY: 34, head: [cfg.cols.map(c => c[0])], body: rows.map(r => cfg.cols.map(([, f]) => String(f(r) == null ? '' : f(r)))), styles: { fontSize: 8 }, headStyles: { fillColor: [201, 74, 28] } });
      return doc;
   }
   const falla = (q, e) => { console.error('[siniestros] ' + q, e); toast('No se pudo ' + q + ': ' + (e && e.message ? e.message : e)); };
   function bindExport(botones, cfgFn) {
      botones.forEach(b => b.addEventListener('click', () => {
         const cfg = cfgFn(), rows = cfg.rows(), q = b.dataset.x;
         if (!rows.length) return toast('No hay registros para exportar');
         if (q === 'Exportar a Excel') {
            try {
               const ws = XLSX.utils.json_to_sheet(rows.map(r => Object.fromEntries(cfg.cols.map(([t, f]) => [t, f(r)]))));
               const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, cfg.hoja || 'Hoja1'); XLSX.writeFile(wb, cfg.archivo + '_' + hoy() + '.xlsx');
            } catch (e) { falla('generar el Excel', e); }
         } else if (q === 'Exportar PDF') {
            construirPdf(cfg, rows).then(d => d.save(cfg.archivo + '_' + hoy() + '.pdf')).catch(e => falla('generar el PDF', e));
         } else {
            construirPdf(cfg, rows).then(d => {
               d.autoPrint(); const url = d.output('bloburl'), f = document.createElement('iframe');
               f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; f.src = url; document.body.appendChild(f);
               f.onload = () => { try { f.contentWindow.focus(); } catch (e) { window.open(url, '_blank'); } };
            }).catch(e => falla('generar el PDF para imprimir', e));
         }
      }));
   }

   /* ---------------- motor de tabla (filtros, búsqueda, filas por alto de pantalla) ---------------- */
   function Tabla(o) {
      const s = { pg: 1, rows: [], per: 10, q: '', f: {} }, tb = $(o.tbody), pg = $(o.pag), tot = $(o.total), sc = tb.closest('.table-polizas__scroll');
      let data = [];
      const card = () => $('#card');
      function filtrar() {
         s.rows = data.filter(r => {
            if (s.q && o.buscar(r).toLowerCase().indexOf(s.q) < 0) return false;
            for (const k in s.f) if (s.f[k] !== '' && !o.filtros[k](r, s.f[k])) return false;
            return true;
         });
      }
      function html(sl) { return sl.length ? sl.map(o.fila).join('') : '<tr><td colspan="20" class="sin-res">' + (o.vacio || 'Sin resultados') + '</td></tr>'; }
      function pintar() {
         if (o.antes) o.antes(s.rows);
         const draw = () => {
            const n = Math.max(1, Math.ceil(s.rows.length / s.per)); if (s.pg > n) s.pg = n;
            const a = (s.pg - 1) * s.per; tb.innerHTML = html(s.rows.slice(a, a + s.per)); return n;
         };
         // Se parte de pocas filas y se agregan mientras la tarjeta quepa en la pantalla (así no aparece la
         // barra de scroll vertical a mitad del cálculo y las filas no se miden deformadas).
         s.per = 3; let n = draw(), g = 0;
         const sobra = () => window.innerHeight - 16 - card().getBoundingClientRect().bottom;
         if (sc.offsetParent !== null) {
            while (s.per < s.rows.length && g++ < 120) { const prev = s.per; s.per++; n = draw(); if (sobra() < 0) { s.per = prev; n = draw(); break; } }
         } else { s.per = 10; n = draw(); }
         tot.textContent = 'Total: ' + s.rows.length + ' ' + o.unidad;
         const sp = (c, t, p) => '<span class="paginationList__index ' + c + '"' + (p ? ' data-p="' + p + '"' : '') + '>' + t + '</span>';
         let h = ''; if (n > 1) {
            h += sp(s.pg === 1 ? 'noClickable' : '', '«', Math.max(1, s.pg - 1));
            for (let i = 1; i <= n; i++) { if (i === 1 || i === n || Math.abs(i - s.pg) <= 1) h += sp(i === s.pg ? 'paginationList__index--active' : '', i, i); else if (Math.abs(i - s.pg) === 2) h += sp('noClickable', '…'); }
            h += sp(s.pg === n ? 'noClickable' : '', '»', Math.min(n, s.pg + 1));
         }
         pg.innerHTML = h;
      }
      pg.addEventListener('click', e => { const p = e.target.getAttribute && e.target.getAttribute('data-p'); if (p) { s.pg = +p; pintar(); } });
      $(o.buscarId).addEventListener('input', e => { s.q = e.target.value.toLowerCase(); s.pg = 1; filtrar(); pintar(); });
      if (o.panel) {
         $(o.btnF).addEventListener('click', () => { const p = $(o.panel); p.style.display = p.style.display === 'none' ? 'flex' : 'none'; pintar(); });
         $(o.aplicar).addEventListener('click', () => { for (const k in o.ids) s.f[k] = $(o.ids[k]).value; s.pg = 1; filtrar(); pintar(); });
         $(o.limpiar).addEventListener('click', () => { for (const k in o.ids) { $(o.ids[k]).value = ''; s.f[k] = ''; } s.pg = 1; filtrar(); pintar(); });
      }
      window.addEventListener('resize', () => { if (sc.offsetParent !== null) pintar(); });
      const t = { state: s, set(d) { data = d; filtrar(); pintar(); }, pintar() { filtrar(); pintar(); } };
      bindExport([...$(o.buscarId).parentNode.querySelectorAll('[data-x]')], () => ({ titulo: o.titulo, archivo: o.archivo, hoja: o.titulo.slice(0, 30), cols: o.cols, rows: () => s.rows }));
      return t;
   }
   const ACC = items => '<div class="acc-btns">' + items.map(i => '<button class="btn btn-sm-mq" data-a="' + i[0] + '" data-id="' + i[1] + '">' + i[0] + '</button>').join(' ') + '</div>';
   const ACT = r => ACC([['Editar', r.id], [r.activo ? 'Desactivar' : 'Activar', r.id], ['Eliminar', r.id]]);

   /* ---------------- secciones generadas ---------------- */
   function mkSec(id, ph, nuevo, heads, filt) {
      const f = filt.map(x => '<div class="polizas-filtros__campo"><label>' + x[1] + '</label><select class="custom-select" id="' + id + '-f' + x[0] + '"><option value="">Todos</option>' + (x[2] || '') + '</select></div>').join('');
      return '<div class="polizas-toolbar"><input class="form-control my-2 polizas-toolbar__search" type="search" placeholder="' + ph + '" id="' + id + '-buscar"><button class="btn px-4 py-2 btn-primary" id="' + id + '-nuevo">+ ' + nuevo + '</button><button class="btn px-4 py-2" id="' + id + '-filtros">Filtros</button><button class="btn px-4 py-2" data-x="Exportar a Excel">Exportar a Excel</button><button class="btn px-4 py-2" data-x="Exportar PDF">Exportar PDF</button><button class="btn px-4 py-2" data-x="Imprimir">Imprimir</button></div><div class="polizas-total" id="' + id + '-total"></div><div class="polizas-filtros" id="' + id + '-panel" style="display:none">' + f + '<div class="polizas-filtros__acciones"><button class="btn px-3 py-2" id="' + id + '-aplicar">Aplicar</button><button class="btn" id="' + id + '-limpiar">Limpiar</button></div></div><div class="table-polizas__scroll"><table class="table"><thead class="tableHeader"><tr>' + heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody id="' + id + '-tbody"></tbody></table></div><div class="w-100 d-flex justify-content-center table-polizas__pagination"><div id="' + id + '-pag" class="paginationList"></div></div>';
   }
   const ESTOP = '<option>Activo</option><option>Inactivo</option>';
   $('#s-camp').innerHTML = mkSec('c', 'Buscar campo', 'Nuevo campo', ['Campo', 'Tipo de dato', 'Obligatorio', 'Procesos', 'Tipos de siniestro', 'Estado', 'Acciones'], [['pr', 'Proceso'], ['es', 'Estado', ESTOP]]);
   $('#s-tipo').innerHTML = mkSec('t', 'Buscar tipo de siniestro', 'Nuevo tipo', ['Proceso', 'Tipo de siniestro', 'Plantillas', 'Campos', 'Siniestros', 'Estado', 'Acciones'], [['pr', 'Proceso'], ['es', 'Estado', ESTOP]]);
   $('#s-est').innerHTML = mkSec('e', 'Buscar estatus', 'Nuevo estatus', ['Proceso', 'Orden', 'Estatus', 'Tipo', 'Siniestros activos', 'Estado', 'Acciones'], [['pr', 'Proceso'], ['es', 'Estado', ESTOP], ['tp', 'Tipo', '<option>Aseguradora</option><option>Pendiente</option><option>Otro</option><option>Final</option>']]);

   const act = a => a ? 'Activo' : 'Inactivo';
   const plazoChip = c => c === null ? chip('chip-gris', 'Sin meta') : c ? chip('chip-ok', '✓ Dentro') : chip('chip-bad', '✕ Fuera');
   const tH = Tabla({
      tbody: '#h-tbody', pag: '#h-pag', total: '#h-total', unidad: 'siniestros cerrados', buscarId: '#h-buscar', panel: '#h-panel', btnF: '#h-filtros', aplicar: '#h-aplicar', limpiar: '#h-limpiar',
      ids: { pr: '#h-fProceso', tp: '#h-fTipo', rs: '#h-fRes', as: '#h-fAseg', cp: '#h-fCierra', pl: '#h-fPlazo', d: '#h-fDesde', h: '#h-fHasta' }, titulo: 'Historial de Siniestros', archivo: 'historial_siniestros',
      buscar: r => r.folio + ' ' + r.cliente + ' ' + r.poliza,
      filtros: { pr: (r, v) => r.proceso_clave === v, tp: (r, v) => r.tipo === v, rs: (r, v) => r.resultado === v, as: (r, v) => r.aseguradora === v, cp: (r, v) => String(r.cerrado_por_id) === v, pl: (r, v) => v === 'si' ? r.cumple === true : r.cumple === false, d: (r, v) => r.cierre_iso >= v, h: (r, v) => r.cierre_iso <= v },
      cols: [['Folio', r => r.folio], ['Reaperturas', r => r.n_reap], ['Proceso', r => r.proceso], ['Tipo de siniestro', r => r.tipo], ['Cliente', r => r.cliente], ['Póliza', r => r.poliza], ['Aseguradora', r => r.aseguradora], ['Resultado', r => r.resultado], ['Apertura', r => r.apertura], ['Cierre', r => r.cierre], ['Cerrado por', r => r.cerrado_por], ['Tiempo total', r => r.tiempo], ['Plazo', r => r.cumple === null ? 'Sin meta' : r.cumple ? 'Dentro' : 'Fuera'], ['Monto total pagado', r => money(r.pagado)]],
      fila: r => '<tr><td><b>' + esc(r.folio) + '</b>' + (r.n_reap ? '<br><a href="#" class="reap-link" data-reap="' + r.id + '">Reabierto ' + r.n_reap + (r.n_reap === 1 ? ' vez' : ' veces') + '</a>' : '') + '</td><td>' + esc(r.proceso) + '</td><td>' + esc(r.tipo) + '</td><td>' + esc(r.cliente) + '</td><td>' + esc(r.poliza) + '</td><td>' + esc(r.aseguradora) + '</td><td>' + chip(r.resultado === 'Procedente' ? 'chip-ok' : r.resultado === 'Rechazado' ? 'chip-bad' : 'chip-gris', r.resultado) + '</td><td class="mono">' + esc(r.apertura) + '</td><td class="mono">' + esc(r.cierre) + '</td><td>' + esc(r.cerrado_por) + '</td><td class="mono">' + esc(r.tiempo) + '</td><td>' + plazoChip(r.cumple) + '</td><td class="mono" style="text-align:right">' + money(r.pagado) + '</td><td>' + ACC([['Ver', r.id], ['Reabrir', r.id]]) + '</td></tr>'
   });
   const estP = r => r.estado === 'Pendiente' ? 'Pendiente de pago' : r.estado;
   const sumTabla = (tit, filas) => '<div class="rs-bloque"><b>' + tit + '</b><table>' + (filas.length ? filas.map(f => '<tr><td>' + esc(f[0]) + '</td><td class="mono" style="text-align:right">' + money(f[1]) + '</td></tr>').join('') : '<tr><td style="color:#999">Sin pagos</td></tr>') + '</table></div>';
   const agrupa = (rows, k) => { const m = {}; rows.forEach(r => { m[r[k]] = (m[r[k]] || 0) + r.monto; }); return Object.keys(m).sort((a, b) => m[b] - m[a]).map(x => [x, m[x]]); };
   const tP = Tabla({
      tbody: '#p-tbody', pag: '#p-pag', total: '#p-total', unidad: 'pagos', buscarId: '#p-buscar', panel: '#p-panel', btnF: '#p-filtros', aplicar: '#p-aplicar', limpiar: '#p-limpiar',
      ids: { pr: '#p-fProceso', tp: '#p-fTipo', as: '#p-fAseg', cn: '#p-fConc', es: '#p-fEst', rg: '#p-fReg', d: '#p-fDesde', h: '#p-fHasta' }, titulo: 'Pagos de Siniestros', archivo: 'pagos_siniestros',
      buscar: r => r.folio + ' ' + r.cliente + ' ' + r.beneficiario,
      filtros: { pr: (r, v) => r.proceso_clave === v, tp: (r, v) => r.tipo === v, as: (r, v) => r.aseguradora === v, cn: (r, v) => r.concepto === v, es: (r, v) => r.estado === v, rg: (r, v) => String(r.registro_id) === v, d: (r, v) => r.fecha_iso !== '' && r.fecha_iso >= v, h: (r, v) => r.fecha_iso !== '' && r.fecha_iso <= v },
      cols: [['Fecha de pago', r => r.fecha], ['Folio', r => r.folio], ['Proceso', r => r.proceso], ['Tipo de siniestro', r => r.tipo], ['Cliente', r => r.cliente], ['Beneficiario', r => r.beneficiario], ['Aseguradora', r => r.aseguradora], ['Concepto', r => r.concepto], ['Monto', r => r.monto], ['Estado', r => estP(r) + (r.motivo ? ' (' + r.motivo + ')' : '')], ['Comprobante', r => r.comprobante ? 'Sí' : 'No'], ['Registró', r => r.registro]],
      antes: rows => {
         const g = e => rows.filter(r => r.estado === e), sm = l => l.reduce((a, b) => a + b.monto, 0), pa = g('Pagado'), pe = g('Pendiente'), ca = g('Cancelado');
         const card = (n, l) => '<div class="res-card"><small>' + n + '</small><b>' + l.length + '</b><span class="mono">' + money(sm(l)) + '</span></div>';
         $('#p-resumen').innerHTML = card('Pagados', pa) + card('Pendientes de pago', pe) + card('Cancelados', ca);
         $('#p-rs').innerHTML = sumTabla('Pagado por concepto', agrupa(pa, 'concepto')) + sumTabla('Pagado por aseguradora', agrupa(pa, 'aseguradora')) + sumTabla('Pendiente de pago por concepto', agrupa(pe, 'concepto'));
      },
      fila: r => '<tr' + (r.estado === 'Cancelado' ? ' style="opacity:.6"' : '') + '><td class="mono">' + esc(r.fecha) + '</td><td><b>' + esc(r.folio) + '</b></td><td>' + esc(r.proceso) + '</td><td>' + esc(r.tipo) + '</td><td>' + esc(r.cliente) + '</td><td>' + esc(r.beneficiario) + '</td><td>' + esc(r.aseguradora) + '</td><td>' + esc(r.concepto) + '</td><td class="mono" style="text-align:right">' + money(r.monto) + '</td><td>' + chip(r.estado === 'Pagado' ? 'chip-ok' : r.estado === 'Pendiente' ? 'chip-gris' : 'chip-bad', estP(r)) + (r.motivo ? '<br><small style="color:#888">' + esc(r.motivo) + '</small>' : '') + '</td><td>' + (r.comprobante ? '<a href="#" data-a="Comprobante" data-id="' + r.id + '">Ver comprobante</a>' : '<span style="color:#aaa">Sin comprobante</span>') + '</td><td>' + esc(r.registro) + '</td><td>' + ACC([['Ir al siniestro', r.siniestro_id]].concat(r.estado === 'Pendiente' && r.activo ? [['Marcar pagado', r.id]] : []).concat(r.estado !== 'Cancelado' ? [['Cancelar', r.id]] : [])) + '</td></tr>'
   });
   $('#p-det').addEventListener('toggle', () => tP.pintar());
   const tR = Tabla({
      tbody: '#r-tbody', pag: '#r-pag', total: '#r-total', unidad: 'plantillas', buscarId: '#r-buscar', panel: '#r-panel', btnF: '#r-filtros', aplicar: '#r-aplicar', limpiar: '#r-limpiar',
      ids: { pr: '#r-fProceso', as: '#r-fAseg', es: '#r-fEst' }, titulo: 'Plantillas de requisitos', archivo: 'plantillas_requisitos',
      buscar: r => r.aseguradora + ' ' + r.tipo + ' ' + PN(r.proceso),
      filtros: { pr: (r, v) => r.proceso === v, as: (r, v) => r.aseguradora === v, es: (r, v) => act(r.activo) === (v === 'Activa' ? 'Activo' : 'Inactivo') },
      cols: [['Proceso', r => PN(r.proceso)], ['Aseguradora', r => r.aseguradora], ['Tipo', r => r.tipo], ['Requisitos', r => r.requisitos.map(q => q.nombre + (q.obligatorio ? ' (obligatorio)' : ' (opcional)')).join('; ')], ['Estado', r => act(r.activo)], ['Última modificación', r => r.modificada]],
      fila: r => { const ob = r.requisitos.filter(q => q.obligatorio).length; return '<tr><td>' + esc(PN(r.proceso)) + '</td><td>' + esc(r.aseguradora) + '</td><td>' + esc(r.tipo) + '</td><td>' + r.requisitos.length + ' <small style="color:#888">(' + ob + ' obligatorios)</small></td><td>' + EA(r.activo) + '</td><td class="mono">' + esc(r.modificada) + '</td><td>' + ACC([['Editar', r.id], ['Duplicar', r.id], [r.activo ? 'Desactivar' : 'Activar', r.id], ['Eliminar', r.id]]) + '</td></tr>'; }
   });
   const tC = Tabla({
      tbody: '#c-tbody', pag: '#c-pag', total: '#c-total', unidad: 'campos', buscarId: '#c-buscar', panel: '#c-panel', btnF: '#c-filtros', aplicar: '#c-aplicar', limpiar: '#c-limpiar',
      ids: { pr: '#c-fpr', es: '#c-fes' }, titulo: 'Campos para crear siniestros', archivo: 'campos_siniestros',
      buscar: r => r.nombre + ' ' + r.tipos_nombres.join(' '), filtros: { pr: (r, v) => r.procesos.indexOf(v) >= 0, es: (r, v) => act(r.activo) === v },
      cols: [['Campo', r => r.nombre], ['Tipo de dato', r => r.tipo_dato], ['Obligatorio', r => r.obligatorio ? 'Sí' : 'No'], ['Procesos', r => r.procesos.length === KEYS().length ? 'Todos' : r.procesos.join(', ')], ['Tipos de siniestro', r => r.tipos_nombres.join(', ') || 'Todos los del proceso'], ['Estado', r => act(r.activo)]],
      fila: r => '<tr><td><b>' + esc(r.nombre) + '</b>' + (r.opciones ? '<br><small style="color:#888">' + esc(r.opciones) + '</small>' : '') + '</td><td>' + esc(r.tipo_dato) + '</td><td>' + (r.obligatorio ? chip('chip-bad', 'Obligatorio') : chip('chip-gris', 'Opcional')) + '</td><td>' + (r.procesos.length === KEYS().length ? 'Todos' : esc(r.procesos.join(', '))) + '</td><td>' + (r.tipos_nombres.length ? esc(r.tipos_nombres.join(', ')) : '<span style="color:#888">Todos los tipos del proceso</span>') + '</td><td>' + EA(r.activo) + '</td><td>' + ACT(r) + '</td></tr>'
   });
   const tT = Tabla({
      tbody: '#t-tbody', pag: '#t-pag', total: '#t-total', unidad: 'tipos', buscarId: '#t-buscar', panel: '#t-panel', btnF: '#t-filtros', aplicar: '#t-aplicar', limpiar: '#t-limpiar',
      ids: { pr: '#t-fpr', es: '#t-fes' }, titulo: 'Tipos de siniestro', archivo: 'tipos_siniestro',
      buscar: r => r.nombre + ' ' + PN(r.proceso), filtros: { pr: (r, v) => r.proceso === v, es: (r, v) => act(r.activo) === v },
      cols: [['Proceso', r => PN(r.proceso)], ['Tipo de siniestro', r => r.nombre], ['Plantillas', r => r.plantillas], ['Campos', r => r.campos], ['Siniestros', r => r.siniestros], ['Estado', r => act(r.activo)]],
      fila: r => '<tr><td>' + esc(PN(r.proceso)) + '</td><td><b>' + esc(r.nombre) + '</b></td><td class="mono">' + r.plantillas + '</td><td class="mono">' + r.campos + '</td><td class="mono">' + r.siniestros + '</td><td>' + EA(r.activo) + '</td><td>' + ACT(r) + '</td></tr>'
   });
   const tE = Tabla({
      tbody: '#e-tbody', pag: '#e-pag', total: '#e-total', unidad: 'estatus', buscarId: '#e-buscar', panel: '#e-panel', btnF: '#e-filtros', aplicar: '#e-aplicar', limpiar: '#e-limpiar',
      ids: { pr: '#e-fpr', es: '#e-fes', tp: '#e-ftp' }, titulo: 'Catálogo de estatus', archivo: 'catalogo_estatus',
      buscar: r => r.nombre + ' ' + PN(r.proceso), filtros: { pr: (r, v) => r.proceso === v, es: (r, v) => act(r.activo) === v, tp: (r, v) => r.tipo === v },
      cols: [['Proceso', r => PN(r.proceso)], ['Orden', r => r.orden], ['Estatus', r => r.nombre], ['Tipo', r => r.tipo], ['Siniestros activos', r => r.uso], ['Estado', r => act(r.activo)]],
      fila: r => '<tr><td>' + esc(PN(r.proceso)) + '</td><td class="mono">' + r.orden + '</td><td><b>' + esc(r.nombre) + '</b></td><td>' + chip(r.tipo === 'Final' ? 'chip-gris' : r.tipo === 'Pendiente' ? 'chip-bad' : r.tipo === 'Aseguradora' ? 'chip-ok' : 'chip-gris', r.tipo) + '</td><td class="mono">' + r.uso + '</td><td>' + EA(r.activo) + '</td><td>' + ACT(r) + '</td></tr>'
   });
   const tM = Tabla({
      tbody: '#m-tbody', pag: '#m-pag', total: '#m-total', unidad: 'mensajes', buscarId: '#m-buscar', filtros: {}, titulo: 'Mensajes', archivo: 'mensajes_siniestros',
      buscar: r => r.nombre + ' ' + r.uso, cols: [['Mensaje', r => r.nombre], ['Se usa en', r => r.uso], ['Procesos', r => r.procesos], ['Canal', r => r.canal], ['Estado', r => act(r.activo)], ['Texto', r => r.texto]],
      fila: r => '<tr><td><b>' + esc(r.nombre) + '</b></td><td>' + esc(r.uso) + '</td><td>' + esc(r.procesos === 'TODOS' ? 'Todos' : r.procesos) + '</td><td>' + esc(r.canal) + '</td><td>' + EA(r.activo) + '</td><td>' + ACC([['Vista previa', r.id], ['Editar', r.id], [r.activo ? 'Desactivar' : 'Activar', r.id], ['Eliminar', r.id]]) + '</td></tr>'
   });
   const TABLAS = { req: tR, camp: tC, tipo: tT, est: tE, msg: tM };

   /* ---------------- carga de datos ---------------- */
   const LOAD = {
      hist: () => http('GET', 'historial').then(j => { D.hist = j.items; $('#h-fTipo').innerHTML = '<option value="">Todos</option>' + j.tipos.map(x => '<option>' + esc(x) + '</option>').join(''); $('#h-fCierra').innerHTML = '<option value="">Todos</option>' + j.cierran.map(x => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join(''); tH.set(D.hist); }),
      pagos: () => http('GET', 'pagos').then(j => { D.pagos = j.items; $('#p-fTipo').innerHTML = '<option value="">Todos</option>' + j.tipos.map(x => '<option>' + esc(x) + '</option>').join(''); $('#p-fReg').innerHTML = '<option value="">Todos</option>' + j.registran.map(x => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join(''); tP.set(D.pagos); }),
      tipos: () => http('GET', 'tipos').then(j => { D.tipos = j.items; tT.set(D.tipos); }),
      campos: () => http('GET', 'campos').then(j => { D.campos = j.items; tC.set(D.campos); }),
      estatus: () => http('GET', 'estatus').then(j => { D.estatus = j.items; tE.set(D.estatus); }),
      plant: () => http('GET', 'plantillas').then(j => { D.plant = j.items; D.reqCat = j.catalogo; tR.set(D.plant); }),
      msgs: () => http('GET', 'mensajes').then(j => { D.msgs = j.items; tM.set(D.msgs); })
   };
   const SUBLOAD = { req: ['tipos', 'plant'], camp: ['tipos', 'campos'], tipo: ['tipos'], est: ['estatus'], msg: ['msgs'] };
   const fail = e => toast(e.message || 'Error al cargar');

   function llenarCombos() {
      const po = '<option value="">Todos</option>' + D.cat.procesos.map(p => '<option value="' + p.clave + '">' + esc(p.nombre) + '</option>').join('');
      ['#h-fProceso', '#p-fProceso', '#r-fProceso', '#c-fpr', '#t-fpr', '#e-fpr'].forEach(s => { $(s).innerHTML = po; });
      const ao = '<option value="">Todas</option>' + D.cat.aseguradoras.map(a => '<option value="' + esc(a.nombre) + '">' + esc(a.nombre) + '</option>').join('');
      ['#h-fAseg', '#p-fAseg', '#r-fAseg'].forEach(s => { $(s).innerHTML = ao; });
      $('#x-aseg').innerHTML = '<option value="">Todas</option>' + D.cat.aseguradoras.map(a => '<option value="' + a.id + '">' + esc(a.nombre) + '</option>').join('');
      $('#p-fConc').innerHTML = '<option value="">Todos</option>' + D.cat.conceptos.map(c => '<option>' + esc(c) + '</option>').join('');
      $('#x-proc').innerHTML = D.cat.procesos.map(p => '<option value="' + p.clave + '">' + esc(p.nombre) + '</option>').join('');
   }

   /* ---------------- pestañas ---------------- */
   const TIT = { activos: 'Tabla de Siniestros', historial: 'Historial de Siniestros', pagos: 'Pagos', plantillas: 'Plantillas', reportes: 'Reportes' };
   let SUB = 'req', VISTA = 'activos';
   function cargarSub() { Promise.all(SUBLOAD[SUB].map(k => LOAD[k]())).then(() => requestAnimationFrame(() => TABLAS[SUB].pintar())).catch(fail); }
   async function ir(v) {
      VISTA = v;
      $$('#tabsMod a').forEach(a => a.classList.toggle('activa', a.dataset.v === v));
      $$('.vista').forEach(d => d.classList.toggle('on', d.id === 'v-' + v));
      $('#pagActivos').classList.toggle('oculto', v !== 'activos');
      $('#tituloVista').textContent = TIT[v];
      if (v === 'activos') { window.dispatchEvent(new Event('siniestros:recargar')); window.dispatchEvent(new Event('resize')); return; }
      try {
         if (!D.cat) { D.cat = await http('GET', 'catalogos'); llenarCombos(); }
         if (v === 'historial') await LOAD.hist(); else if (v === 'pagos') await LOAD.pagos(); else if (v === 'plantillas') cargarSub(); else if (v === 'reportes') rep();
      } catch (e) { fail(e); }
   }
   $('#tabsMod').addEventListener('click', e => { if (e.target.dataset.v) ir(e.target.dataset.v); });
   $('#subTabs').addEventListener('click', e => {
      const s = e.target.dataset.s; if (!s) return; SUB = s;
      $$('#subTabs a').forEach(a => a.classList.toggle('activa', a.dataset.s === s));
      ['req', 'camp', 'tipo', 'est', 'msg'].forEach(x => { $('#s-' + x).style.display = x === s ? '' : 'none'; });
      cargarSub();
   });

   /* ---------------- modales genéricos ---------------- */
   const abrir = id => $(id).classList.add('on');
   const cerrar = () => $$('.mq-back').forEach(m => m.classList.remove('on'));
   document.addEventListener('click', e => { if ((e.target.hasAttribute && e.target.hasAttribute('data-cerrar')) || (e.target.classList && e.target.classList.contains('mq-back'))) cerrar(); });
   function conf(tit, msg, fn, okTxt, peligro) {
      $('#c-tit').textContent = tit; $('#c-msg').innerHTML = msg; const b = $('#c-ok'); b.textContent = okTxt || 'Eliminar';
      b.style.background = peligro === false ? '' : '#b03a2e'; b.style.borderColor = peligro === false ? '' : '#b03a2e'; abrir('#m-conf'); b.onclick = () => { cerrar(); fn(); };
   }
   function frm(tit, campos, vals, fn) {
      $('#g-tit').textContent = tit; $('#g-av').textContent = '';
      $('#g-body').innerHTML = campos.map(c => {
         const v = vals[c.k]; let h = '<label>' + c.l + (c.req ? ' *' : '') + '</label>';
         if (c.t === 'text') h += '<input class="form-control" data-k="' + c.k + '" value="' + esc(v || '') + '" placeholder="' + esc(c.ph || '') + '">';
         else if (c.t === 'area') h += '<textarea class="form-control" rows="3" data-k="' + c.k + '" placeholder="' + esc(c.ph || '') + '">' + esc(v || '') + '</textarea>';
         else if (c.t === 'select') h += '<select class="custom-select" data-k="' + c.k + '">' + c.o.map(o => { const ov = o.v !== undefined ? o.v : o, ot = o.t !== undefined ? o.t : o; return '<option value="' + esc(ov) + '"' + (String(ov) === String(v) ? ' selected' : '') + '>' + esc(ot) + '</option>'; }).join('') + '</select>';
         else if (c.t === 'check') h = '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-k="' + c.k + '" ' + (v ? 'checked' : '') + '> ' + c.l + '</label>';
         else if (c.t === 'multi') h += '<div class="chk-g" data-k="' + c.k + '">' + c.o.map(o => o.g ? '<div class="grp">' + esc(o.g) + '</div>' : '<label><input type="checkbox" value="' + esc(o.v) + '" ' + ((v || []).map(String).indexOf(String(o.v)) >= 0 ? 'checked' : '') + '> ' + esc(o.t) + '</label>').join('') + '</div>';
         return h;
      }).join('');
      abrir('#m-gen');
      $('#g-ok').onclick = async () => {
         const o = {};
         campos.forEach(c => { const el = $('#g-body [data-k="' + c.k + '"]'); if (c.t === 'check') o[c.k] = el.checked; else if (c.t === 'multi') o[c.k] = [].slice.call(el.querySelectorAll('input:checked')).map(i => i.value); else o[c.k] = el.value.trim(); });
         for (const c of campos) if (c.req && (c.t === 'multi' ? !o[c.k].length : !o[c.k])) { $('#g-av').textContent = '«' + c.l + '» es obligatorio.'; return; }
         $('#g-ok').disabled = true;
         try { await fn(o); cerrar(); } catch (e) { $('#g-av').textContent = e.message; } finally { $('#g-ok').disabled = false; }
      };
   }
   const tiposDe = (clave, soloActivos) => D.tipos.filter(t => t.proceso === clave && (!soloActivos || t.activo));
   const tiposOpts = () => { const o = []; KEYS().forEach(k => { const l = tiposDe(k, true); if (l.length) { o.push({ g: PN(k) }); l.forEach(x => o.push({ v: x.id, t: x.nombre })); } }); return o; };

   /* ---------------- catálogos: tipos, campos, estatus ---------------- */
   const ENT = {
      tipos: { path: 'tipos', nom: 'Tipo', list: () => D.tipos, load: ['tipos', 'plant', 'campos'] },
      campos: { path: 'campos', nom: 'Campo', list: () => D.campos, load: ['campos'] },
      estatus: { path: 'estatus', nom: 'Estatus', list: () => D.estatus, load: ['estatus'] },
      plant: { path: 'plantillas', nom: 'Plantilla', list: () => D.plant, load: ['plant', 'tipos'] },
      msgs: { path: 'mensajes', nom: 'Mensaje', list: () => D.msgs, load: ['msgs'] }
   };
   const recargar = ent => Promise.all(ENT[ent].load.map(k => LOAD[k]())).catch(fail);
   function fTipo(r) {
      frm(r ? 'Editar tipo de siniestro' : 'Nuevo tipo de siniestro', [{ k: 'proceso', l: 'Proceso', t: 'select', o: D.cat.procesos.map(p => ({ v: p.clave, t: p.nombre })), req: 1 }, { k: 'nombre', l: 'Nombre del tipo', t: 'text', req: 1, ph: 'Ej. Cirugía de columna' }],
         r ? { proceso: r.proceso, nombre: r.nombre } : { proceso: D.cat.procesos[0].clave },
         async o => { await http(r ? 'PUT' : 'POST', 'tipos' + (r ? '/' + r.id : ''), o); toast('Tipo guardado. Ya se puede usar en plantillas y campos.'); recargar('tipos'); });
   }
   function fCampo(r) {
      frm(r ? 'Editar campo' : 'Nuevo campo', [{ k: 'nombre', l: 'Nombre del campo', t: 'text', req: 1 }, { k: 'tipo_dato', l: 'Tipo de dato', t: 'select', o: D.cat.tipos_dato }, { k: 'opciones', l: 'Opciones (solo si es Lista, separadas por coma)', t: 'text' }, { k: 'obligatorio', l: 'Obligatorio al crear el siniestro', t: 'check' }, { k: 'procesos', l: 'Procesos donde aparece', t: 'multi', o: D.cat.procesos.map(p => ({ v: p.clave, t: p.nombre })), req: 1 }, { k: 'tipos', l: 'Solo para estos tipos de siniestro (vacío = todos los del proceso)', t: 'multi', o: tiposOpts() }],
         r ? r : { tipo_dato: 'Texto', procesos: [], tipos: [], obligatorio: false },
         async o => { o.tipos = o.tipos.map(Number); await http(r ? 'PUT' : 'POST', 'campos' + (r ? '/' + r.id : ''), o); toast('Campo guardado. Aparecerá en Nuevo siniestro según proceso y tipo.'); recargar('campos'); });
   }
   function fEst(r) {
      frm(r ? 'Editar estatus' : 'Nuevo estatus', [{ k: 'proceso', l: 'Proceso', t: 'select', o: D.cat.procesos.map(p => ({ v: p.clave, t: p.nombre })), req: 1 }, { k: 'nombre', l: 'Nombre del estatus', t: 'text', req: 1 }, { k: 'tipo', l: 'Tipo', t: 'select', o: D.cat.tipos_estatus }, { k: 'orden', l: 'Orden en el flujo', t: 'text', ph: 'Número (vacío = al final)' }],
         r ? r : { proceso: D.cat.procesos[0].clave, tipo: 'Aseguradora' },
         async o => { await http(r ? 'PUT' : 'POST', 'estatus' + (r ? '/' + r.id : ''), o); toast('Estatus guardado. Ya se puede elegir en Actualizar estatus.'); recargar('estatus'); });
   }
   $('#c-nuevo').onclick = () => fCampo(null); $('#t-nuevo').onclick = () => fTipo(null); $('#e-nuevo').onclick = () => fEst(null);
   const FORMS = { tipos: fTipo, campos: fCampo, estatus: fEst };

   async function eliminar(ent, r) {
      const E = ENT[ent], nom = r.nombre || (r.aseguradora + ' · ' + r.tipo);
      conf('Eliminar ' + E.nom.toLowerCase(), '<p style="margin:0">¿Eliminar <b>' + esc(nom) + '</b>? Esta acción no se puede deshacer.</p>', async () => {
         try { await http('DELETE', E.path + '/' + r.id); toast(E.nom + ' eliminado'); recargar(ent); }
         catch (e) {
            if (e.status === 409) conf('No se puede eliminar', '<p style="margin:0">' + esc(e.message) + '</p><p style="margin:8px 0 0;color:#555">Puedes <b>desactivarlo</b>: deja de ofrecerse en nuevos siniestros pero conserva el historial.</p>', () => toggle(ent, r), 'Desactivar', false);
            else toast(e.message);
         }
      });
   }
   async function toggle(ent, r) {
      try { const j = await http('POST', ENT[ent].path + '/' + r.id + '/toggle'); toast(j.activo ? 'Activado' : 'Desactivado: ya no se ofrece en nuevos siniestros'); recargar(ent); } catch (e) { toast(e.message); }
   }

   const verDetalle = id => window.dispatchEvent(new CustomEvent('siniestros:accion', { detail: { a: 'ver', id: id } }));
   /* ---------------- delegación de acciones de fila ---------------- */
   const MAPA = { 'c-tbody': 'campos', 't-tbody': 'tipos', 'e-tbody': 'estatus', 'r-tbody': 'plant', 'm-tbody': 'msgs' };
   document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('tbody [data-a]'); if (!b) return;
      const tb = b.closest('tbody').id, a = b.dataset.a, id = +b.dataset.id;
      if (tb === 'h-tbody') { e.preventDefault(); const r = D.hist.find(x => x.id === id); if (a === 'Reabrir') reabrir(r); else verDetalle(r.id); return; }
      if (tb === 'p-tbody') { e.preventDefault(); if (a === 'Cancelar') cancelarPago(D.pagos.find(x => x.id === id)); else if (a === 'Marcar pagado') { const r = D.pagos.find(x => x.id === id); window.dispatchEvent(new CustomEvent('siniestros:accion', { detail: { a: 'pagar', id: r.siniestro_id, pid: r.id, monto: r.monto } })); } else if (a === 'Comprobante') window.open('/siniestros/api/pagos/' + id + '/comprobante', '_blank'); else verDetalle(D.pagos.find(x => x.id === id).siniestro_id); return; }
      const ent = MAPA[tb]; if (!ent) return; e.preventDefault();
      const r = ENT[ent].list().find(x => x.id === id); if (!r) return;
      if (a === 'Vista previa') vistaMs(r);
      else if (a === 'Editar') { if (ent === 'plant') abrirPl(r); else if (ent === 'msgs') abrirMs(r); else FORMS[ent](r); }
      else if (a === 'Duplicar') abrirPl(Object.assign({}, r, { id: null, modificada: '' }), true);
      else if (a === 'Eliminar') eliminar(ent, r);
      else toggle(ent, r);
   });

   /* ---------------- historial: detalle de reaperturas ---------------- */
   document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('[data-reap]'); if (!a) return; e.preventDefault();
      const r = D.hist.find(x => x.id === +a.dataset.reap); if (!r) return;
      $('#rp-folio').textContent = r.folio;
      $('#rp-cuerpo').innerHTML = r.reaperturas.map((x, i) => '<div class="rp-item"><b>Reapertura ' + (i + 1) + '</b> · <span class="mono">' + esc(x.fecha) + '</span> · ' + esc(x.usuario) +
         '<div>Regresó a: <b>' + esc(x.estatus || '—') + '</b>' + (x.plazo ? ' · nuevo plazo: <span class="mono">' + esc(x.plazo) + '</span>' : '') + '</div><div class="rp-mot">' + esc(x.motivo) + '</div></div>').join('');
      abrir('#m-reaps');
   });
   window.addEventListener('siniestros:reabrir', e => reabrir(e.detail));
   /* ---------------- historial: reabrir ---------------- */
   let rbSin = null;
   async function reabrir(r) {
      rbSin = r; $('#rb-folio').textContent = r.folio; $('#rb-motivo').value = ''; $('#rb-av').textContent = '';
      try {
         const j = await http('GET', 'estatus/proceso/' + r.proceso_clave);
         $('#rb-est').innerHTML = j.items.map(x => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join(''); abrir('#m-reabrir');
      } catch (e) { toast(e.message); }
   }
   $('#rb-ok').addEventListener('click', async () => {
      if ($('#rb-motivo').value.trim().length < 5) { $('#rb-av').textContent = 'El motivo es obligatorio.'; return; }
      try { await http('POST', 'siniestros/' + rbSin.id + '/reabrir', { estatus_id: +$('#rb-est').value, motivo: $('#rb-motivo').value }); cerrar(); toast('Siniestro ' + rbSin.folio + ' reabierto. Ya está en Activos; el plazo se mide de nuevo desde hoy.'); LOAD.hist(); window.dispatchEvent(new Event('siniestros:recargar')); }
      catch (e) { $('#rb-av').textContent = e.message; }
   });
   function cancelarPago(p) {
      frm('Cancelar pago de ' + p.folio + ' por ' + money(p.monto), [{ k: 'motivo', l: 'Motivo de la cancelación', t: 'area', req: 1 }], {},
         async o => { await http('POST', 'pagos/' + p.id + '/cancelar', o); toast('Pago cancelado. El registro se conserva y quedó en bitácora.'); LOAD.pagos(); });
   }

   /* ---------------- plantillas de requisitos ---------------- */
   let cur = null;
   const reqsPintar = () => { $('#pl-reqs').innerHTML = cur.requisitos.map((q, i) => '<div class="req-fila"><span class="n">' + esc(q.nombre) + '</span><button class="sw ' + (q.obligatorio ? 'ob' : 'op') + '" data-i="' + i + '">' + (q.obligatorio ? 'Obligatorio' : 'Opcional') + '</button><span class="x" data-x2="' + i + '">&times;</span></div>').join('') || '<p style="color:#999;font-size:13px">Sin requisitos todavía</p>'; };
   function tiposPara(k, sel) {
      $('#pl-tipoLbl').textContent = k === 'REM' ? 'Tipo de reembolso *' : k === 'VI' ? 'Tipo de reclamación *' : 'Tipo de siniestro *';
      const l = tiposDe(k, true); $('#pl-tipo').innerHTML = l.map(t => '<option value="' + t.id + '">' + esc(t.nombre) + '</option>').join('') || '<option value="">(no hay tipos, agrega uno)</option>';
      if (sel) $('#pl-tipo').value = sel;
   }
   function abrirPl(q, dup) {
      cur = q ? JSON.parse(JSON.stringify(q)) : { id: null, proceso: 'CIR', aseguradora_id: D.cat.aseguradoras[0].id, tipo_id: null, requisitos: [] };
      $('#pl-tit').textContent = dup ? 'Duplicar plantilla' : q ? 'Editar plantilla' : 'Nueva plantilla de requisitos';
      $('#pl-proc').innerHTML = D.cat.procesos.filter(p => p.clave !== 'SI').map(p => '<option value="' + p.clave + '">' + esc(p.nombre) + '</option>').join(''); $('#pl-proc').value = cur.proceso;
      $('#pl-aseg').innerHTML = D.cat.aseguradoras.map(a => '<option value="' + a.id + '">' + esc(a.nombre) + '</option>').join(''); $('#pl-aseg').value = cur.aseguradora_id;
      tiposPara(cur.proceso, cur.tipo_id);
      $('#pl-cat').innerHTML = D.reqCat.map(x => '<option>' + esc(x) + '</option>').join(''); $('#pl-av').textContent = ''; reqsPintar(); abrir('#m-plant');
   }
   $('#r-nuevo').addEventListener('click', () => abrirPl(null));
   $('#pl-proc').addEventListener('change', function () { cur.proceso = this.value; tiposPara(cur.proceso); });
   $('#pl-reqs').addEventListener('click', e => { const i = e.target.getAttribute('data-i'), x = e.target.getAttribute('data-x2'); if (i !== null) { cur.requisitos[i].obligatorio = !cur.requisitos[i].obligatorio; reqsPintar(); } if (x !== null) { cur.requisitos.splice(x, 1); reqsPintar(); } });
   function addReq(n) { n = n.trim(); if (!n) return; if (cur.requisitos.some(q => q.nombre.toLowerCase() === n.toLowerCase())) { $('#pl-av').textContent = 'Ese requisito ya está en la plantilla.'; return; } $('#pl-av').textContent = ''; cur.requisitos.push({ nombre: n, obligatorio: true }); reqsPintar(); }
   $('#pl-addCat').addEventListener('click', () => addReq($('#pl-cat').value));
   $('#pl-addCustom').addEventListener('click', () => { addReq($('#pl-custom').value); $('#pl-custom').value = ''; });
   $('#pl-tipoAdd').addEventListener('click', async () => {
      const n = $('#pl-tipoNuevo').value.trim(); if (!n) return;
      try { const t = await http('POST', 'tipos', { proceso: $('#pl-proc').value, nombre: n }); await LOAD.tipos(); tiposPara($('#pl-proc').value, t.id); $('#pl-tipoNuevo').value = ''; toast('Tipo agregado al catálogo'); }
      catch (e) { $('#pl-av').textContent = e.message; }
   });
   $('#pl-ok').addEventListener('click', async () => {
      const body = { proceso: $('#pl-proc').value, aseguradora_id: +$('#pl-aseg').value, tipo_id: +$('#pl-tipo').value, requisitos: cur.requisitos };
      if (!body.tipo_id) { $('#pl-av').textContent = 'Elige o agrega un tipo.'; return; }
      try { await http(cur.id ? 'PUT' : 'POST', 'plantillas' + (cur.id ? '/' + cur.id : ''), body); cerrar(); toast('Plantilla guardada. Se ofrecerá al crear siniestros de ese proceso, aseguradora y tipo.'); recargar('plant'); }
      catch (e) { $('#pl-av').textContent = e.message; }
   });

   /* ---------------- mensajes ---------------- */
   const VARS = ['{cliente}', '{folio}', '{aseguradora}', '{poliza}', '{requisitos}', '{fecha_limite}', '{monto}', '{asegurado}'];
   const EJ = { '{cliente}': 'María Fernanda López', '{folio}': 'REM-2026-10-925', '{aseguradora}': 'GNP', '{poliza}': 'POL-48210', '{requisitos}': '• Informe médico\n• Facturas originales', '{fecha_limite}': '30/10/2026', '{monto}': '$18,450.00', '{asegurado}': 'Juan Carlos Méndez' };
   let cm = null;
   function vistaMs(m) {
      let x = m.texto; const clave = m.procesos === 'TODOS' ? 'REM' : m.procesos.split(',')[0];
      const ej = Object.assign({}, EJ, { '{folio}': clave + '-2026-10-925' });
      VARS.forEach(v => { x = x.split(v).join(ej[v]); });
      $('#vp-tit').textContent = m.nombre; $('#vp-can').textContent = m.canal + ' · ' + (m.procesos === 'TODOS' ? 'todos los procesos' : m.procesos); $('#vp-txt').textContent = x; abrir('#m-vp');
   }
   $('#vp-copiar').addEventListener('click', () => { navigator.clipboard.writeText($('#vp-txt').textContent).then(() => toast('Texto copiado'), () => toast('No se pudo copiar')); });
   const prev = () => { let t = $('#ms-txt').value; VARS.forEach(v => { t = t.split(v).join(EJ[v]); }); $('#ms-prev').textContent = t; };
   function abrirMs(m) {
      cm = m; const x = m || { nombre: '', uso: '', procesos: 'TODOS', canal: D.cat.canales[0], texto: '' };
      $('#ms-tit').textContent = m ? m.nombre : 'Nuevo mensaje'; $('#ms-nom').value = x.nombre; $('#ms-uso').value = x.uso;
      $('#ms-can').innerHTML = D.cat.canales.map(c => '<option>' + esc(c) + '</option>').join(''); $('#ms-can').value = x.canal; $('#ms-txt').value = x.texto;
      $('#ms-procs').innerHTML = '<div class="chk-g">' + KEYS().map(k => '<label><input type="checkbox" value="' + k + '" ' + (x.procesos === 'TODOS' || x.procesos.split(',').indexOf(k) >= 0 ? 'checked' : '') + '> ' + k + '</label>').join('') + '</div>';
      $('#ms-vars').innerHTML = VARS.map(v => '<span class="var-chip">' + v + '</span>').join(''); prev(); abrir('#m-msg');
   }
   $('#m-nuevo').onclick = () => abrirMs(null);
   $('#ms-txt').addEventListener('input', prev);
   $('#ms-vars').addEventListener('click', e => { if (!e.target.classList.contains('var-chip')) return; const t = $('#ms-txt'), p = t.selectionStart; t.value = t.value.slice(0, p) + e.target.textContent + t.value.slice(t.selectionEnd); t.focus(); prev(); });
   $('#ms-ok').addEventListener('click', async () => {
      const body = { nombre: $('#ms-nom').value, uso: $('#ms-uso').value, canal: $('#ms-can').value, texto: $('#ms-txt').value, procesos: $$('#ms-procs input:checked').map(i => i.value) };
      if (!body.nombre.trim() || !body.texto.trim()) { toast('Nombre y texto son obligatorios'); return; }
      try { await http(cm ? 'PUT' : 'POST', 'mensajes' + (cm ? '/' + cm.id : ''), body); cerrar(); toast('Mensaje guardado'); recargar('msgs'); } catch (e) { toast(e.message); }
   });

   /* ---------------- reportes ---------------- */
   let REP = null;
   const mesHoy = () => new Date().toISOString().slice(0, 7);
   $('#x-mes input').value = mesHoy();
   $('#x-per').addEventListener('change', function () {
      const r = this.value === 'rango', m = this.value === 'mes_sel';
      $('#x-d1').style.display = $('#x-d2').style.display = r ? '' : 'none'; $('#x-mes').style.display = m ? '' : 'none';
      if (!r) rep();
   });
   ['#x-proc', '#x-aseg'].forEach(s => $(s).addEventListener('change', rep));
   $('#x-d1 input').addEventListener('change', rep); $('#x-d2 input').addEventListener('change', rep); $('#x-mes input').addEventListener('change', rep);
   const dmy = f => f ? f.split('-').reverse().join('/') : '';
   async function rep() {
      if (!D.cat) return;
      const per = $('#x-per').value, q = new URLSearchParams({ proceso: $('#x-proc').value, periodo: per });
      if ($('#x-aseg').value) q.set('aseguradora_id', $('#x-aseg').value);
      if (per === 'rango') { if (!$('#x-d1 input').value || !$('#x-d2 input').value) return; q.set('desde', $('#x-d1 input').value); q.set('hasta', $('#x-d2 input').value); }
      if (per === 'mes_sel') { if (!$('#x-mes input').value) return; q.set('mes', $('#x-mes input').value); }
      try { REP = await http('GET', 'reportes?' + q.toString()); } catch (e) { toast(e.message); return; }
      const k = REP.proceso, mt = REP.meta, a = REP.actual, p = REP.previo, cont = $('#x-kpis'), nota = $('#x-nota');
      $('#x-rango').textContent = 'Periodo: ' + dmy(REP.desde) + ' al ' + dmy(REP.hasta) + ' · indicadores de tiempo sobre siniestros cerrados; reaperturas y pagos por fecha de registro';
      const delta = (x, y, u) => (x == null || y == null) ? 'sin periodo anterior para comparar' : x === y ? 'sin cambio vs. periodo anterior' : (x > y ? '▲ +' : '▼ ') + Math.round((x - y) * 100) / 100 + ' ' + u + ' vs. periodo anterior';
      const kpi = (t, v, m, ok, dl) => '<div class="kpi ' + (ok === null ? '' : ok ? 'cumple' : 'falla') + '"><h6>' + t + '</h6><div class="v">' + v + '</div><div class="m">' + m + '</div>' + (ok === null ? '<span class="st" style="background:#eceff1;color:#555">Sin casos</span>' : '<span class="st">' + (ok ? '✓ Cumple' : '✕ No cumple') + '</span>') + '<span class="d">' + dl + '</span></div>';
      const kn = (t, v, m, dl) => '<div class="kpi" style="border-top-color:#8a94a6"><h6>' + t + '</h6><div class="v">' + v + '</div><div class="m">' + m + '</div>' + (dl ? '<span class="d" style="margin-left:0">' + dl + '</span>' : '') + '</div>';
      let h = '';
      if (!mt) {
         nota.style.display = ''; nota.textContent = 'Este proceso no tiene indicador de tiempo definido: se reporta el volumen de cerrados, reaperturas y pagos.';
         h += kn('Siniestros cerrados', a.cerrados, 'en el periodo', delta(a.cerrados, p.cerrados, 'casos'));
         $('#x-gtit').textContent = ''; $('#x-graf').innerHTML = '<p style="color:#888;padding:20px;text-align:center">Sin indicador de plazo para este proceso</p>';
      } else {
         nota.style.display = 'none';
         h += kpi('% dentro de plazo', a.pct_plazo == null ? '—' : a.pct_plazo + '%', 'Meta: ' + esc(mt.texto) + ' en ≥ ' + mt.pct + '% de los casos', a.pct_plazo == null ? null : a.pct_plazo >= mt.pct, delta(a.pct_plazo, p.pct_plazo, 'pts'));
         if (REP.meta_procedente != null) h += kpi('% procedente', a.pct_procedente == null ? '—' : a.pct_procedente + '%', 'Meta: ≥ ' + REP.meta_procedente + '%', a.pct_procedente == null ? null : a.pct_procedente >= REP.meta_procedente, delta(a.pct_procedente, p.pct_procedente, 'pts'));
         if (mt.incid) h += kpi(k === 'VI' ? 'Dictámenes negativos / rechazos' : k === 'RA' ? 'Pagos rechazados' : k === 'SI' ? 'Incidencias reportadas' : 'Ciclos de corrección', a.incidencias, 'Meta: 0 · ' + a.cerrados + ' casos cerrados · ' + (k === 'VI' ? 'dictamen negativo o rechazo' : k === 'RA' ? 'pago rechazado por la aseguradora' : esc(mt.incid.join(' / ').toLowerCase())), a.cerrados ? a.incidencias === 0 : null, a.incidencias === p.incidencias ? 'sin cambio' : (a.incidencias > p.incidencias ? '▲ +' : '▼ ') + Math.abs(a.incidencias - p.incidencias) + ' vs. periodo anterior');
         else h += kn('Incidencias', '—', 'Este proceso no tiene incidencias definidas en el contrato');
         if (mt.dictamen_dias) h += kpi('Dictamen en ≤ ' + mt.dictamen_dias + ' días naturales', a.pct_dictamen == null ? '—' : a.pct_dictamen + '%', 'Del folio registrado al dictamen · ' + a.n_dictamen + ' dictámenes · Meta ≥ ' + mt.pct + '%', a.pct_dictamen == null ? null : a.pct_dictamen >= mt.pct, delta(a.pct_dictamen, p.pct_dictamen, 'pts'));
         grafica(REP.tendencia, mt.pct);
      }
      const R = REP.reaperturas.length, Rp = REP.reaperturas_previo, pg = REP.pagos, pp = REP.pagos_previo;
      h += kn('Siniestros reabiertos', R, 'reaperturas en el periodo' + (R ? ' · ver tabla abajo' : ''), delta(R, Rp, 'reaperturas'));
      h += kn('Pagado', money(pg.pagado), pg.n_pagado + ' pagos en ' + pg.siniestros + ' siniestros' + (pg.promedio != null ? ' · promedio ' + money(pg.promedio) : ''), pg.pagado === pp.pagado ? 'sin cambio vs. periodo anterior' : (pg.pagado > pp.pagado ? '▲ +' : '▼ -') + money(Math.abs(pg.pagado - pp.pagado)) + ' vs. periodo anterior');
      h += kn('Pendiente de pago', money(pg.pendiente), pg.n_pendiente + ' pagos pendientes registrados en el periodo');
      h += kn('Pagos cancelados', money(pg.cancelado), pg.n_cancelado + ' pagos cancelados en el periodo');
      cont.innerHTML = h;
      tablaRep(); extras();
   }
   function extras() {
      const pg = REP.pagos;
      $('#x-reaps').innerHTML = REP.reaperturas.length ? REP.reaperturas.map(r => '<tr><td><a href="#" class="x-ver" data-id="' + r.siniestro_id + '">' + esc(r.folio) + '</a></td><td>' + esc(r.fecha) + '</td><td>' + esc(r.aseguradora) + '</td><td>#' + r.numero + '</td><td>' + esc(r.estatus) + '</td><td>' + esc(r.usuario) + '</td><td>' + esc(r.motivo) + '</td><td>' + esc(r.estado_actual) + '</td></tr>').join('') : '<tr><td colspan="8" style="color:#888;text-align:center">Sin reaperturas en el periodo</td></tr>';
      $('#x-pc').innerHTML = pg.por_concepto.length ? pg.por_concepto.map(r => '<tr><td>' + esc(r.concepto) + '</td><td>' + r.n + '</td><td class="mono">' + money(r.monto) + '</td></tr>').join('') : '<tr><td colspan="3" style="color:#888;text-align:center">Sin pagos</td></tr>';
      $('#x-pa').innerHTML = pg.por_aseguradora.length ? pg.por_aseguradora.map(r => '<tr><td>' + esc(r.aseguradora) + '</td><td>' + r.n + '</td><td class="mono">' + money(r.monto) + '</td></tr>').join('') : '<tr><td colspan="3" style="color:#888;text-align:center">Sin pagos</td></tr>';
   }
   $('#v-reportes').addEventListener('click', e => { const a = e.target.closest('.x-ver'); if (a) { e.preventDefault(); verDetalle(+a.dataset.id); } });
   function grafica(d, meta) {
      $('#x-gtit').textContent = '% de casos dentro de plazo, últimos 5 meses';
      const W = 720, H = 260, L = 44, R = 16, T = 30, B = 34, iw = W - L - R, ih = H - T - B, X = i => L + iw * i / (d.length - 1), Y = v => T + ih * (1 - v / 100);
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tendencia del porcentaje de casos dentro de plazo">';
      [0, 25, 50, 75, 100].forEach(g => { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="#e8e8e8"/><text x="' + (L - 8) + '" y="' + (Y(g) + 4) + '" text-anchor="end" font-size="11" fill="#777">' + g + '%</text>'; });
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(meta) + '" y2="' + Y(meta) + '" stroke="#555" stroke-width="1.5" stroke-dasharray="5 4"/><text x="' + (W - R) + '" y="' + (Y(meta) + 14) + '" text-anchor="end" font-size="11" fill="#555">Meta ' + meta + '%</text>';
      let seg = []; const segs = []; d.forEach((p, i) => { if (p.valor == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(X(i) + ',' + Y(p.valor)); }); if (seg.length) segs.push(seg);
      segs.forEach(sg => { if (sg.length > 1) s += '<polyline points="' + sg.join(' ') + '" fill="none" stroke="#0b6fb3" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'; });
      d.forEach((p, i) => {
         s += '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" fill="#555">' + esc(p.mes) + '</text>';
         if (p.valor != null) s += '<circle cx="' + X(i) + '" cy="' + Y(p.valor) + '" r="4.5" fill="#0b6fb3" stroke="#fff" stroke-width="2"/><text x="' + X(i) + '" y="' + (Y(p.valor) - 10) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="#222">' + p.valor + '%</text>';
         s += '<rect data-i="' + i + '" x="' + (X(i) - iw / (d.length - 1) / 2) + '" y="' + T + '" width="' + (iw / (d.length - 1)) + '" height="' + ih + '" fill="transparent"/>';
      });
      s += '</svg><div class="leyenda"><span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke="#0b6fb3" stroke-width="2.5"/></svg> % dentro de plazo</span><span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke="#555" stroke-width="1.5" stroke-dasharray="5 4"/></svg> Meta</span><span style="color:#888">Los meses sin casos cerrados no tienen punto</span></div>';
      const g = $('#x-graf'), tip = $('#x-tip'); g.innerHTML = s;
      g.onmousemove = e => {
         const r = e.target.getAttribute && e.target.getAttribute('data-i'); if (r === null || r === undefined) { tip.style.opacity = 0; return; }
         const p = d[+r], pb = g.parentNode.getBoundingClientRect();
         tip.innerHTML = '<b>' + esc(p.mes) + '</b><br>' + (p.valor == null ? 'Sin casos cerrados' : p.valor + '% dentro de plazo') + '<br>' + p.casos + ' casos cerrados'; tip.style.left = (e.clientX - pb.left + 12) + 'px'; tip.style.top = (e.clientY - pb.top - 50) + 'px'; tip.style.opacity = 1;
      };
      g.onmouseleave = () => { tip.style.opacity = 0; };
   }
   const pc = v => v == null ? '—' : v + '%';
   function tablaRep() {
      $('#x-tbody').innerHTML = REP.tabla.map(r => {
         const base = '<td>' + esc(r.proceso_nombre) + '</td><td>' + r.cerrados + '</td>', fin = '<td>' + r.reaperturas + '</td><td class="mono">' + money(r.pagado) + '</td>';
         if (!r.meta) return '<tr>' + base + '<td colspan="5" style="color:#888">Sin indicador de tiempo</td>' + fin + '</tr>';
         const ok = r.pct_plazo == null ? null : r.pct_plazo >= r.meta.pct;
         return '<tr>' + base + '<td>' + esc(r.meta.texto) + '</td><td class="mono">' + pc(r.pct_plazo) + '</td><td class="mono">' + pc(r.pct_procedente) + '</td><td class="mono">' + (r.meta.incid ? r.incidencias : '—') + '</td><td>' + (ok === null ? chip('chip-gris', 'Sin casos') : ok ? chip('chip-ok', '✓ Cumple') : chip('chip-bad', '✕ No cumple')) + '</td>' + fin + '</tr>';
      }).join('');
   }
   /* Exportar / imprimir: mismo motor que Pólizas; el selector elige qué tabla sale */
   const sub = () => REP ? 'Periodo ' + dmy(REP.desde) + ' al ' + dmy(REP.hasta) : '';
   const EXP = {
      ind: () => ({
         titulo: 'Reporte de indicadores de siniestros', archivo: 'reporte_siniestros', hoja: 'Indicadores', sub: sub(),
         cols: [['Proceso', r => r.proceso_nombre], ['Casos cerrados', r => r.cerrados], ['Meta de tiempo', r => r.meta ? r.meta.texto : 'Sin indicador'], ['% dentro de plazo', r => pc(r.pct_plazo)], ['% procedente', r => pc(r.pct_procedente)], ['Incidencias', r => r.meta && r.meta.incid ? r.incidencias : '—'], ['Cumple', r => !r.meta || r.pct_plazo == null ? '—' : r.pct_plazo >= r.meta.pct ? 'Sí' : 'No'], ['Reaperturas', r => r.reaperturas], ['Pagado', r => money(r.pagado)]],
         rows: () => REP ? REP.tabla : []
      }),
      rea: () => ({
         titulo: 'Siniestros reabiertos', archivo: 'reaperturas_siniestros', hoja: 'Reaperturas', sub: sub(),
         cols: [['Folio', r => r.folio], ['Fecha', r => r.fecha], ['Aseguradora', r => r.aseguradora], ['Reapertura #', r => r.numero], ['Reabierto en', r => r.estatus], ['Usuario', r => r.usuario], ['Motivo', r => r.motivo], ['Estado actual', r => r.estado_actual]],
         rows: () => REP ? REP.reaperturas : []
      }),
      pco: () => ({
         titulo: 'Pagos por concepto', archivo: 'pagos_por_concepto', hoja: 'Pagos por concepto', sub: sub(),
         cols: [['Concepto', r => r.concepto], ['Pagos', r => r.n], ['Monto pagado', r => money(r.monto)]],
         rows: () => REP ? REP.pagos.por_concepto : []
      }),
      pas: () => ({
         titulo: 'Pagos por aseguradora', archivo: 'pagos_por_aseguradora', hoja: 'Pagos por aseguradora', sub: sub(),
         cols: [['Aseguradora', r => r.aseguradora], ['Pagos', r => r.n], ['Monto pagado', r => money(r.monto)]],
         rows: () => REP ? REP.pagos.por_aseguradora : []
      })
   };
   bindExport([...$('#v-reportes .polizas-toolbar').querySelectorAll('[data-x]')], () => EXP[$('#x-exp').value]());
})();
