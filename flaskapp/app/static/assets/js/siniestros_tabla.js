// Tabla de Siniestros activos (módulo Siniestros).
// Los datos llegan de /siniestros/api/siniestros; filtros, búsqueda y
// paginación se hacen aquí, igual que en la pantalla de Pólizas.
(function () {
   'use strict';
   const MIN_FILAS = 5;
   let porPagina = 10;          // se recalcula según el alto de la pantalla (ver ajustarFilas)
   let ROWS = [], filtradas = [], pagina = 1;

   const $id = id => document.getElementById(id);
   const esc = v => String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

   const ICON = {
      ver: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>',
      estatus: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
      bitacora: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/>',
      pago: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
      derivado: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
      comunicacion: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
      cerrar: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
   };
   const ACC = [['ver', 'Ver detalle'], ['estatus', 'Actualizar estatus'], ['bitacora', 'Agregar a bitácora'],
      ['pago', 'Registrar pago'], ['derivado', 'Crear siniestro derivado'], ['comunicacion', 'Enviar comunicación'],
      ['cerrar', 'Cerrar siniestro']];
   const svg = (k, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24">${ICON[k]}</svg>`;

   function toast(t) {
      const e = $id('toast'); e.textContent = t; e.classList.add('on');
      clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), 2400);
   }

   const chipEstatus = r => {
      const c = r.estatus_tipo === 'aseguradora' ? 'chip-aseg' : r.estatus_tipo === 'pendiente' ? 'chip-pend' : 'chip-otro';
      return `<span class="chip ${c}">${esc(r.estatus)}</span>`;
   };
   function relacion(r) {
      let h = '';
      if (r.origen) h += `<div><span class="chip chip-der">Derivado de <u>${esc(r.origen)}</u></span></div>`;
      if (r.n_derivados) h += `<div style="margin-top:${r.origen ? 3 : 0}px"><span class="chip chip-orig">${r.n_derivados} ${r.n_derivados > 1 ? 'derivados' : 'derivado'}</span></div>`;
      return h || '<span class="p-none">—</span>';
   }
   function accionesHTML(r) {
      const full = ACC.map(([k, t]) => {
         const off = k === 'cerrar' && r.n_derivados;
         const tt = off ? `No se puede cerrar: tiene ${r.n_derivados} ${r.n_derivados > 1 ? 'derivados abiertos' : 'derivado abierto'}` : t;
         return `<li><a title="${esc(tt)}" class="${off ? 'off' : ''}" data-a="${k}" data-id="${r.id}" data-f="${esc(r.folio)}">${svg(k, 22)}</a></li>`;
      }).join('');
      const menu = ACC.map(([k, t]) => {
         const off = k === 'cerrar' && r.n_derivados;
         return (k === 'cerrar' ? '<div class="dropdown-divider"></div>' : '') +
            `<a class="dropdown-item pointer ${off ? 'disabled' : ''}" data-a="${k}" data-id="${r.id}" data-f="${esc(r.folio)}">${svg(k, 18)}${t}</a>`;
      }).join('');
      return `<ul class="acciones-full">${full}</ul><div class="dropdown acciones-menu-wrapper"><button type="button" class="acciones-toggle pointer" title="Acciones"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button><div class="dropdown-menu dropdown-menu-right acciones-menu">${menu}</div></div>`;
   }

   function render(sinAjuste) {
      const ini = (pagina - 1) * porPagina, vis = filtradas.slice(ini, ini + porPagina);
      $id('tbody').innerHTML = vis.map(r =>
         `<tr><td><span class="folio-link" data-a="ver" data-id="${r.id}" data-f="${esc(r.folio)}">${esc(r.folio)}</span></td>` +
         `<td>${esc(r.proceso)}</td><td>${esc(r.cliente)}</td><td>${esc(r.poliza)}</td><td>${esc(r.aseguradora)}</td>` +
         `<td>${chipEstatus(r)}</td><td><span class="plazo p-${r.plazo_nivel}">${r.plazo_nivel !== 'none' ? '<i></i>' : ''}${esc(r.plazo)}</span></td>` +
         `<td>${esc(r.apertura)}</td><td>${relacion(r)}</td><td>${accionesHTML(r)}</td></tr>`).join('') ||
         '<tr><td colspan="10" class="sin-res">No hay siniestros con esos criterios</td></tr>';
      const n = filtradas.length;
      $id('total').textContent = `${n} ${n === 1 ? 'siniestro activo encontrado' : 'siniestros activos encontrados'}`;
      const np = Math.max(1, Math.ceil(n / porPagina)); let p = '';
      if (np > 1) {
         p += `<span class="paginationList__index ${pagina === 1 ? 'noClickable' : ''}" data-p="${pagina - 1}">«</span>`;
         for (let i = 1; i <= np; i++) p += `<span class="paginationList__index ${i === pagina ? 'paginationList__index--active' : ''}" data-p="${i}">${i}</span>`;
         p += `<span class="paginationList__index ${pagina === np ? 'noClickable' : ''}" data-p="${pagina + 1}">»</span>`;
      }
      $id('pagination').innerHTML = p;
      ajustarAcciones();
   }

   // Cuántas filas caben: la tabla se llena hasta que la página ya no necesita
   // scroll vertical (como en Pólizas). Se renderiza, se mide cuánto sobra (o cuánto falta) y se
   // corrige con el alto promedio real de las filas (que cambia según cuántas
   // líneas ocupen los nombres). Funciona igual en cualquier tamaño de pantalla.
   let ajustando = false;
   function ajustarFilas() {
      if (ajustando || !ROWS.length) return;
      ajustando = true;
      // scrollHeight nunca baja del alto de la ventana, así que se mide el fondo real
      // de la tarjeta (+16 px de aire de la columna) contra el alto visible.
      const card = document.querySelector('.card-tabla-polizas');
      const sobra = () => window.innerHeight - (card.getBoundingClientRect().bottom + window.scrollY + 16);   // >=0 = cabe
      const promedio = () => {
         const trs = $id('tbody').querySelectorAll('tr');
         let h = 0; trs.forEach(tr => { h += tr.getBoundingClientRect().height; });
         return trs.length ? h / trs.length : 50;
      };
      const primeraFila = (pagina - 1) * porPagina;   // para no perder el lugar al cambiar de tamaño
      let n = porPagina, mejor = null;
      for (let i = 0; i < 8; i++) {
         porPagina = n; render(true);
         const libre = sobra(), prom = Math.max(20, promedio());
         if (libre >= 0) {
            mejor = n;
            if (filtradas.length <= n) break;                    // ya se ven todas
            const mas = Math.floor(libre / prom);
            if (mas < 1) break;
            n += mas;
         } else {
            const menos = Math.ceil(-libre / prom);
            if (n <= MIN_FILAS) break;
            n = Math.max(MIN_FILAS, n - menos);
         }
      }
      // si la última prueba se pasó, regresa a la mayor cantidad que sí cabía
      if (sobra() < 0 && mejor !== null && mejor !== porPagina) { porPagina = mejor; }
      pagina = Math.floor(primeraFila / porPagina) + 1;
      render(true);
      ajustando = false;
   }

   function llenarSelect(id, vals) {
      const s = $id(id), actual = s.value;
      while (s.options.length > 1) s.remove(1);
      [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'es')).forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o); });
      s.value = actual;
   }

   function aplicar() {
      const q = $id('buscar').value.toLowerCase().trim(), g = id => $id(id).value;
      filtradas = ROWS.filter(r => {
         if (q && !(r.folio + ' ' + r.cliente + ' ' + r.poliza).toLowerCase().includes(q)) return false;
         if (g('fProceso') && r.proceso !== g('fProceso')) return false;
         if (g('fEstatus') && r.estatus !== g('fEstatus')) return false;
         if (g('fAseg') && r.aseguradora !== g('fAseg')) return false;
         if (g('fPlazo') && r.plazo_nivel !== g('fPlazo')) return false;
         const rel = g('fRel');
         if (rel === 'origen' && !r.n_derivados) return false;
         if (rel === 'derivado' && !r.origen) return false;
         if (rel === 'indep' && (r.origen || r.n_derivados)) return false;
         if (g('fCliente') && !r.cliente.toLowerCase().includes(g('fCliente').toLowerCase())) return false;
         if (g('fDesde') && r.apertura_iso < g('fDesde')) return false;
         if (g('fHasta') && r.apertura_iso > g('fHasta')) return false;
         return true;
      });
      pagina = 1; render(); ajustarFilas();
   }

   function cargar() {
      fetch('/siniestros/api/siniestros')
         .then(r => { if (!r.ok) throw new Error(); return r.json(); })
         .then(d => {
            ROWS = d.items;
            llenarSelect('fProceso', ROWS.map(r => r.proceso));
            llenarSelect('fEstatus', ROWS.map(r => r.estatus));
            llenarSelect('fAseg', ROWS.map(r => r.aseguradora));
            aplicar();
         })
         .catch(() => { $id('tbody').innerHTML = '<tr><td colspan="10" class="sin-res">No se pudo cargar la tabla. Recarga la página.</td></tr>'; });
   }

   // ---- Exportar / imprimir (lo que se ve filtrado) ----
   const COLS = [['Folio', r => r.folio], ['Proceso', r => r.proceso], ['Cliente', r => r.cliente], ['Póliza', r => r.poliza],
      ['Aseguradora', r => r.aseguradora], ['Estatus', r => r.estatus], ['Plazo', r => r.plazo], ['Apertura', r => r.apertura],
      ['Relación', r => [r.origen ? 'Derivado de ' + r.origen : '', r.n_derivados ? r.n_derivados + (r.n_derivados > 1 ? ' derivados' : ' derivado') : ''].filter(Boolean).join(' · ') || '—']];
   const hoy = () => new Date().toISOString().slice(0, 10);

   // Mismo mecanismo y formato que Pólizas: Excel real (SheetJS) y un PDF
   // horizontal con el logo de GGcorp, título, fecha de generación y encabezado
   // de tabla en el color de marca. Exporta TODOS los siniestros que coinciden
   // con la búsqueda/filtros actuales, no solo la página visible.
   let logoCache = null;
   function logoBase64() {
      if (logoCache) return Promise.resolve(logoCache);
      return fetch(document.querySelector('.logo-ggc').getAttribute('src'))
         .then(r => r.blob())
         .then(blob => new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onloadend = () => { logoCache = fr.result; resolve(fr.result); };
            fr.onerror = reject; fr.readAsDataURL(blob);
         }));
   }

   async function construirPdf(items) {
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('La librería jsPDF no cargó (revisa si el CDN está bloqueado).');
      const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
      if (typeof doc.autoTable !== 'function') throw new Error('El plugin jspdf-autotable no cargó (revisa si el CDN está bloqueado).');
      let x = 14;
      try {
         const logo = await logoBase64();
         const w = 12, h = w * (1024 / 615);   // proporción real del logo
         doc.addImage(logo, 'PNG', 14, 8, w, h);
         x = 14 + w + 6;
      } catch (e) { /* sin logo antes que bloquear la exportación */ }
      doc.setFontSize(14); doc.text('Tabla de Siniestros', x, 18);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text('Generado: ' + new Date().toLocaleString('es-MX'), x, 24); doc.setTextColor(0);
      doc.autoTable({
         startY: 34,
         head: [COLS.map(c => c[0])],
         body: items.map(r => COLS.map(([, f]) => String(f(r) ?? ''))),
         styles: { fontSize: 8 },
         headStyles: { fillColor: [201, 74, 28] },   // var(--color-primario) #c94a1c
      });
      return doc;
   }

   const falla = (que, err) => { console.error('[siniestros] ' + que, err); toast(`No se pudo ${que}: ${err && err.message ? err.message : err}`); };

   $id('btnExcel').onclick = () => {
      if (!filtradas.length) return toast('No hay siniestros para exportar');
      try {
         const ws = XLSX.utils.json_to_sheet(filtradas.map(r => Object.fromEntries(COLS.map(([t, f]) => [t, f(r)]))));
         const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Siniestros');
         XLSX.writeFile(wb, `siniestros_${hoy()}.xlsx`);
      } catch (err) { falla('generar el Excel', err); }
   };
   $id('btnPdf').onclick = () => {
      if (!filtradas.length) return toast('No hay siniestros para exportar');
      construirPdf(filtradas).then(doc => doc.save(`siniestros_${hoy()}.pdf`)).catch(err => falla('generar el PDF', err));
   };
   // Imprimir: el mismo PDF, con orden de imprimir, abierto en un iframe oculto.
   $id('btnImprimir').onclick = () => {
      if (!filtradas.length) return toast('No hay siniestros para imprimir');
      construirPdf(filtradas).then(doc => {
         doc.autoPrint();
         const url = doc.output('bloburl');
         const iframe = document.createElement('iframe');
         iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
         iframe.src = url; document.body.appendChild(iframe);
         iframe.onload = () => { try { iframe.contentWindow.focus(); } catch (e) { window.open(url, '_blank'); } };
      }).catch(err => falla('generar el PDF para imprimir', err));
   };

   // ---- Eventos ----
   $id('buscar').addEventListener('input', aplicar);
   $id('btnAplicar').onclick = aplicar;
   $id('btnLimpiar').onclick = () => { document.querySelectorAll('#panelFiltros select,#panelFiltros input').forEach(e => e.value = ''); aplicar(); };
   $id('btnToggleFiltros').onclick = () => { const p = $id('panelFiltros'); p.style.display = p.style.display === 'none' ? 'flex' : 'none'; ajustarFilas(); };
   $id('btnNuevo').onclick = () => toast('Nuevo siniestro: se habilita en la siguiente pantalla');
   $id('pagination').addEventListener('click', e => {
      const p = +e.target.dataset.p;
      if (!p || e.target.classList.contains('noClickable')) return;
      pagina = p; render();
   });

   // Menú de 3 puntos: se coloca fuera de la tabla para que el scroll no lo recorte.
   let abierto = null;
   function cerrarMenu() {
      if (abierto) { abierto.menu.classList.remove('show'); abierto.wrap.appendChild(abierto.menu); abierto = null; }
   }
   document.addEventListener('click', e => {
      const tg = e.target.closest('.acciones-toggle');
      if (tg) {
         e.stopPropagation();
         const wrap = tg.parentElement, was = abierto && abierto.wrap === wrap;
         const menu = wrap.querySelector('.acciones-menu');
         cerrarMenu(); if (was) return;
         document.body.appendChild(menu); menu.classList.add('show');
         const r = tg.getBoundingClientRect();
         menu.style.top = Math.max(8, Math.min(r.bottom + 2, innerHeight - menu.offsetHeight - 8)) + 'px';
         menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px'; menu.style.right = 'auto';
         abierto = { wrap, menu, t: Date.now() }; return;
      }
      const a = e.target.closest('[data-a]');
      if (a && ACC.some(x => x[0] === a.dataset.a) && (a.closest('#tbody') || a.closest('.acciones-menu'))) {
         if (a.classList.contains('off') || a.classList.contains('disabled')) toast('No se puede cerrar: el siniestro tiene derivados abiertos');
         else window.dispatchEvent(new CustomEvent('siniestros:accion', { detail: { a: a.dataset.a, id: +a.dataset.id, f: a.dataset.f } }));
      }
      cerrarMenu();
   });
   // Un scroll cierra el menú, salvo el que dispara el propio reacomodo al abrirlo.
   window.addEventListener('scroll', () => { if (abierto && Date.now() - abierto.t > 400) cerrarMenu(); }, true);

   // Íconos en fila mientras quepan; si no, menú de 3 puntos (misma idea que Pólizas).
   function ajustarAcciones() {
      const box = $id('table-polizas'), sc = box.querySelector('.table-polizas__scroll'), t = sc.querySelector('table');
      box.classList.remove('table-polizas--collapsed');
      box.classList.toggle('table-polizas--collapsed', sc.clientWidth < t.scrollWidth - 20);
   }
   let tResize = null;
   window.addEventListener('resize', () => { ajustarAcciones(); clearTimeout(tResize); tResize = setTimeout(ajustarFilas, 200); });
   // Las fuentes web cambian el alto de las filas: se vuelve a medir cuando terminan de cargar.
   if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarFilas);
   window.addEventListener('load', ajustarFilas);
   window.addEventListener('siniestros:recargar', cargar);
   cargar();
})();
