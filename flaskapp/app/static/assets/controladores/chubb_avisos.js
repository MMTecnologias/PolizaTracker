/*
 * Recibos de Chubb a partir de sus AVISOS DE COBRO.
 *
 * Script clásico (no módulo) que expone window.ChubbAvisos. Lo usan
 * polizas.js y endosos.js. Necesita jQuery y SweetAlert (Swal).
 *
 * Piezas:
 *  1) Panel dentro del modal "Generar Recibos" (alta de póliza,
 *     renovación o endoso): bindCreatePanel / showCreatePanel /
 *     createGate / requestOptions.
 *  2) Modal independiente (#chubb-avisos-modal) para "Generar recibos"
 *     (póliza/endoso 'Por generar') y "Regenerar desde avisos"
 *     (recibos ya generados): openModal.
 *  3) Botones dentro del modal de lista de recibos: refreshActions.
 */
(function (window, $) {
  'use strict';

  const URLS = {
    preview: '/polizas/chubb_avisos_preview',
    info: '/polizas/chubb_recibos_info',
    generar: '/polizas/save_receipts_avisos',
    regenerar: '/polizas/regenerar_recibos_avisos',
  };

  const esc = (t) =>
    String(t == null ? '' : t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const money = (n) =>
    Number(n || 0).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fechaMx = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  };

  function aviso(text, icon, title) {
    return Swal.fire({ title: title || '', text, icon: icon || 'info' });
  }

  function confirmar(text) {
    return Swal.fire({
      title: '',
      text,
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      icon: 'warning',
    });
  }

  function archivosDe(input) {
    return input && input.files ? Array.from(input.files) : [];
  }

  // params: string urlencoded u objeto -> FormData con los archivos.
  function armarFormData(params, files) {
    const fd = new FormData();
    if (typeof params === 'string') {
      new URLSearchParams(params).forEach((v, k) => fd.append(k, v));
    } else {
      Object.keys(params || {}).forEach((k) => {
        if (params[k] !== undefined && params[k] !== null) fd.append(k, params[k]);
      });
    }
    (files || []).forEach((f) => fd.append('avisos_cobro', f, f.name));
    return fd;
  }

  function post(url, formData) {
    return $.ajax({
      url,
      method: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      dataType: 'json',
    });
  }

  // ---------------------------------------------------------------
  // Vista previa (tabla + errores + advertencias)
  // ---------------------------------------------------------------
  function renderPreview($el, resp) {
    if (!resp || resp.error) {
      $el.html(
        `<div class="alert alert-danger mb-2" style="white-space:pre-line">${esc(
          (resp && resp.msg) || 'No se pudieron leer los avisos',
        )}</div>`,
      );
      return;
    }
    const r = resp.resumen;
    let html = '';
    if (resp.errores && resp.errores.length) {
      html += `<div class="alert alert-danger mb-2"><strong>No se puede continuar:</strong><ul class="mb-0 pl-3">${resp.errores
        .map((e) => `<li>${esc(e)}</li>`)
        .join('')}</ul></div>`;
    }
    if (resp.advertencias && resp.advertencias.length) {
      html += `<div class="alert alert-warning mb-2"><strong>Revisa:</strong><ul class="mb-0 pl-3">${resp.advertencias
        .map((e) => `<li>${esc(e)}</li>`)
        .join('')}</ul></div>`;
    }
    if (resp.ok) {
      html += `<div class="alert alert-success mb-2 py-1">Se leyeron ${r.n} aviso(s) de la póliza ${esc(
        r.poliza,
      )}${r.serie_id ? ' · documento ' + esc(r.serie_id) : ''}.</div>`;
    }
    html += `<div class="table-responsive"><table class="table table-sm table-bordered mb-1" style="font-size:12px">
      <thead class="tableHeader"><tr>
        <th>Recibo</th><th>Vigencia</th><th class="text-right">Prima neta</th>
        <th class="text-right">Financ.</th><th class="text-right">Gastos exp.</th>
        <th class="text-right">IVA</th><th class="text-right">Total</th><th>Límite de pago</th>
      </tr></thead><tbody>`;
    r.filas.forEach((f) => {
      html += `<tr><td>${esc(f.numero)}</td>
        <td>${fechaMx(f.vigencia_desde)} – ${fechaMx(f.vigencia_hasta)}</td>
        <td class="text-right">${money(f.prima_neta)}</td>
        <td class="text-right">${money(f.financiamiento)}</td>
        <td class="text-right">${money(f.gastos_expedicion)}</td>
        <td class="text-right">${money(f.iva)}</td>
        <td class="text-right"><strong>${money(f.total)}</strong></td>
        <td>${fechaMx(f.fecha_limite)}</td></tr>`;
    });
    html += `<tr style="font-weight:bold"><td colspan="2">Suma</td>
        <td class="text-right">${money(r.suma_prima_neta)}</td>
        <td class="text-right">${money(r.suma_financiamiento)}</td>
        <td class="text-right">${money(r.suma_gastos_expedicion)}</td>
        <td class="text-right">${money(r.suma_iva)}</td>
        <td class="text-right">${money(r.suma_total)}</td><td></td></tr>`;
    html += '</tbody></table></div>';
    $el.html(html);
  }

  // ---------------------------------------------------------------
  // 1) Panel dentro del modal "Generar Recibos" (alta)
  // ---------------------------------------------------------------
  const createState = { ok: false, active: false, opts: null, firma: '' };

  function esChubbSeleccionada() {
    const txt = $('#aseguradora option:selected').text() || '';
    return /chubb/i.test(txt);
  }

  function firmaArchivos() {
    return archivosDe($('#chubb-files')[0])
      .map((f) => `${f.name}:${f.size}:${f.lastModified}`)
      .join('|');
  }

  function limpiarEstadoPanel() {
    createState.ok = false;
    createState.firma = '';
    $('#chubb-preview').empty();
  }

  const ChubbAvisos = {
    /**
     * opts.getParams()  -> string urlencoded con los datos de la póliza/endoso
     *                      (valores sin formato de moneda)
     * opts.getRecibos() -> objeto con los datos del modal (receipts, commission…)
     * opts.esEdicion()  -> true si el modal está editando una póliza existente
     */
    bindCreatePanel(opts) {
      createState.opts = opts;

      $('#chubb-files').on('change', limpiarEstadoPanel);

      $('#btn-chubb-leer').on('click', function () {
        const files = archivosDe($('#chubb-files')[0]);
        if (!files.length) {
          return aviso('Selecciona uno o varios PDF de avisos de cobro.', 'warning');
        }
        const datos = $.extend({}, opts.getRecibos());
        const params = `${opts.getParams()}&${$.param({
          modo_alta: 1,
          receipts: datos.receipts || '',
        })}`;
        const $btn = $(this).prop('disabled', true).text('Leyendo…');
        post(URLS.preview, armarFormData(params, files))
          .done((resp) => {
            renderPreview($('#chubb-preview'), resp);
            createState.ok = !!(resp && !resp.error && resp.ok);
            createState.firma = createState.ok ? firmaArchivos() : '';
            if (createState.ok) {
              // El derecho de póliza real es la suma de los gastos de expedición.
              $('#derecho_poliza').val(Number(resp.resumen.suma_gastos_expedicion).toFixed(2));
              $('#iva').val(resp.resumen.iva_pct || 16);
            }
          })
          .fail((xhr) => {
            createState.ok = false;
            renderPreview($('#chubb-preview'), {
              error: true,
              msg:
                (xhr.responseJSON && xhr.responseJSON.msg) ||
                'No se pudieron leer los avisos. Intenta de nuevo.',
            });
          })
          .always(() => $btn.prop('disabled', false).text('Leer avisos'));
      });
    },

    // Se llama cada vez que se abre el modal "Generar Recibos".
    showCreatePanel() {
      const opts = createState.opts;
      const activo = !!(opts && !opts.esEdicion() && esChubbSeleccionada());
      createState.active = activo;
      limpiarEstadoPanel();
      $('#chubb-files').val('');
      $('#chubb-panel').toggle(activo);
      $('#btnGuardar-sin-recibos').toggle(activo);
    },

    /** Estado para el submit: {active, hasFiles, ok} */
    createGate() {
      const hasFiles = archivosDe($('#chubb-files')[0]).length > 0;
      return {
        active: createState.active,
        hasFiles,
        // ok solo si se leyeron Y siguen siendo los mismos archivos
        ok: createState.ok && createState.firma === firmaArchivos(),
      };
    },

    /**
     * Si hay avisos listos, regresa las opciones de $.ajax para mandar la
     * petición multipart (con los PDF); si no, null.
     */
    requestOptions(paramsString) {
      const gate = this.createGate();
      if (!(gate.active && gate.hasFiles && gate.ok)) return null;
      return {
        data: armarFormData(paramsString, archivosDe($('#chubb-files')[0])),
        processData: false,
        contentType: false,
      };
    },

    /** Mensaje de resultado si algunos PDF de aviso no se pudieron guardar. */
    avisarFallos(resp) {
      if (resp && resp.avisos_sin_guardar && resp.avisos_sin_guardar.length) {
        aviso(
          'Los recibos se crearon, pero estos avisos no se pudieron guardar como documento (súbelos a mano desde la columna "Aviso de Cobro"):\n' +
            resp.avisos_sin_guardar.join('\n'),
          'warning',
        );
      }
    },

    // ---------------------------------------------------------------
    // 2) Modal independiente: generar / regenerar desde avisos
    // ---------------------------------------------------------------
    openModal(cfg) {
      // cfg: {modo:'generar'|'regenerar', poliza_id, endoso_id, titulo, comision_pct, onDone}
      const $m = $('#chubb-avisos-modal');
      if (!$m.length) return;
      $m.data('cfg', cfg);
      $m.data('ok', false);
      $('#chubb-m-titulo').text(
        (cfg.modo === 'regenerar' ? 'Regenerar recibos desde avisos' : 'Generar recibos desde avisos') +
          (cfg.titulo ? ` — ${cfg.titulo}` : ''),
      );
      $('#chubb-m-ayuda').html(
        cfg.modo === 'regenerar'
          ? 'Los recibos existentes <strong>se actualizan en sitio</strong> (prima neta, prima total, comisión y fechas); ' +
              'no se borran ni cambia su estado de pago, y se conservan sus documentos. ' +
              'El aviso de cobro se guarda en cada recibo que aún no tenga uno.'
          : 'Se crearán los recibos con los montos y fechas exactos de los avisos y se guardará cada aviso como el Aviso de Cobro de su recibo.',
      );
      $('#chubb-m-files').val('');
      $('#chubb-m-preview').empty();
      $('#chubb-m-comision').val(cfg.comision_pct != null ? cfg.comision_pct : '');
      $('#chubb-m-confirmar')
        .prop('disabled', true)
        .text(cfg.modo === 'regenerar' ? 'Actualizar recibos' : 'Generar recibos');
      $m.modal({ backdrop: 'static', keyboard: false });
    },

    // ---------------------------------------------------------------
    // 3) Botones en el modal de lista de recibos
    // ---------------------------------------------------------------
    refreshActions($cont, poliza_id, endoso_id, onDone, titulo) {
      if (!$cont || !$cont.length) return;
      $cont.empty();
      const token = Date.now() + Math.random();
      $cont.data('token', token);
      post(URLS.info, armarFormData({ poliza_id: poliza_id || '', endoso_id: endoso_id || '' }, [])).done(
        (resp) => {
          if ($cont.data('token') !== token) return; // respuesta vieja
          if (!resp || resp.error || !resp.chubb) return;
          const generados = resp.recibos === 'Generados';
          const $btn = $(
            `<button type="button" class="btn btn-sm mb-2">${
              generados ? 'Regenerar desde avisos' : 'Generar recibos desde avisos'
            }</button>`,
          );
          $btn.on('click', () =>
            ChubbAvisos.openModal({
              modo: generados ? 'regenerar' : 'generar',
              poliza_id,
              endoso_id,
              titulo,
              comision_pct: resp.comision_pct,
              onDone,
            }),
          );
          $cont.append($btn);
          if (!generados) {
            $cont.append(
              '<span class="ml-2 text-muted" style="font-size:12px">Esta póliza/endoso aún no tiene recibos.</span>',
            );
          }
        },
      );
    },
  };

  // ---------------------------------------------------------------
  // Eventos del modal independiente
  // ---------------------------------------------------------------
  $(function () {
    const $m = $('#chubb-avisos-modal');
    if (!$m.length) return;

    $('#chubb-m-files').on('change', () => {
      $m.data('ok', false);
      $('#chubb-m-confirmar').prop('disabled', true);
      $('#chubb-m-preview').empty();
    });

    $('#chubb-m-leer').on('click', function () {
      const cfg = $m.data('cfg') || {};
      const files = archivosDe($('#chubb-m-files')[0]);
      if (!files.length) return aviso('Selecciona uno o varios PDF de avisos de cobro.', 'warning');
      const fd = armarFormData(
        { poliza_id: cfg.poliza_id || '', endoso_id: cfg.endoso_id || '' },
        files,
      );
      const $btn = $(this).prop('disabled', true).text('Leyendo…');
      post(URLS.preview, fd)
        .done((resp) => {
          renderPreview($('#chubb-m-preview'), resp);
          const ok = !!(resp && !resp.error && resp.ok);
          $m.data('ok', ok);
          $('#chubb-m-confirmar').prop('disabled', !ok);
        })
        .fail((xhr) =>
          renderPreview($('#chubb-m-preview'), {
            error: true,
            msg:
              (xhr.responseJSON && xhr.responseJSON.msg) ||
              'No se pudieron leer los avisos. Intenta de nuevo.',
          }),
        )
        .always(() => $btn.prop('disabled', false).text('Leer avisos'));
    });

    $('#chubb-m-confirmar').on('click', async function () {
      const cfg = $m.data('cfg') || {};
      if (!$m.data('ok')) return;
      const pct = parseFloat(String($('#chubb-m-comision').val()).replace(',', '.'));
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return aviso('Indica el % de comisión (de 0 a 100).', 'warning');
      }
      if (cfg.modo === 'regenerar') {
        const r = await confirmar(
          'Se actualizarán los montos, comisión y fechas de los recibos con los de los avisos. ¿Continuar?',
        );
        if (!r.isConfirmed) return;
      }
      const fd = armarFormData(
        {
          poliza_id: cfg.poliza_id || '',
          endoso_id: cfg.endoso_id || '',
          commission: pct,
        },
        archivosDe($('#chubb-m-files')[0]),
      );
      const $btn = $(this).prop('disabled', true);
      post(cfg.modo === 'regenerar' ? URLS.regenerar : URLS.generar, fd)
        .done((resp) => {
          if (resp.error) {
            $btn.prop('disabled', false);
            return aviso(resp.msg, 'error');
          }
          $m.modal('hide');
          aviso(resp.msg, 'success');
          ChubbAvisos.avisarFallos(resp);
          if (typeof cfg.onDone === 'function') cfg.onDone();
        })
        .fail((xhr) => {
          $btn.prop('disabled', false);
          aviso(
            (xhr.responseJSON && xhr.responseJSON.msg) || 'Ocurrió un error al procesar los avisos',
            'error',
          );
        });
    });

    // Al cerrarse este modal (que se abre encima de la lista de recibos)
    // Bootstrap 4 quita 'modal-open' del body y se pierde el scroll del
    // modal de abajo: se restablece.
    $m.on('hidden.bs.modal', () => {
      if ($('.modal.show').length) $('body').addClass('modal-open');
    });
  });

  window.ChubbAvisos = ChubbAvisos;
})(window, window.jQuery);
