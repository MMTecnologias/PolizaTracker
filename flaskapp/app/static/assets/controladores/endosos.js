$(function () {
  let razonInput = '';
  let receiptSaveInProgress = false;

  // ---------------------------------------------------------------------
  // Menú de acciones ("3 puntos") de la tabla — misma lógica que en
  // polizas.js: al abrirse se pega al <body> con position:fixed para que
  // el contenedor con scroll de la tabla nunca lo recorte, y al cerrarse
  // regresa a su fila. Delegado sobre document porque las filas se
  // reconstruyen en cada render.
  // ---------------------------------------------------------------------
  $(document).on(
    'show.bs.dropdown',
    '#polizas-table .acciones-menu-wrapper',
    function () {
      const $wrapper = $(this);
      const $menu = $wrapper.find('.acciones-menu');
      const $toggle = $wrapper.find('.acciones-toggle');
      if (!$menu.length || !$toggle.length) return;

      $menu.data('acciones-original-parent', $wrapper);
      $('body').append($menu);

      const toggleRect = $toggle[0].getBoundingClientRect();
      $menu.css({ display: 'block', visibility: 'hidden', position: 'fixed', top: 0, left: 0 });
      const menuWidth = $menu.outerWidth();
      const menuHeight = $menu.outerHeight();

      let left = toggleRect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - 8 - menuWidth;
      }

      let top = toggleRect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 8) {
        top = toggleRect.top - menuHeight - 4;
      }

      $menu.css({ top: `${top}px`, left: `${left}px`, visibility: 'visible', zIndex: 2000 });
    },
  );

  $(document).on(
    'hide.bs.dropdown',
    '#polizas-table .acciones-menu-wrapper',
    function () {
      const $wrapper = $(this);
      $('body')
        .children('.acciones-menu')
        .each(function () {
          const $m = $(this);
          const $original = $m.data('acciones-original-parent');
          if ($original && $original.length && $original.is($wrapper)) {
            $original.append($m);
            $m.css({ position: '', top: '', left: '', display: '', visibility: '', zIndex: '' });
          }
        });
    },
  );

  $(document).on('scroll', '.table-polizas__scroll', function () {
    $('#polizas-table .acciones-toggle[aria-expanded="true"]').dropdown('hide');
  });

  // Decide si caben todos los íconos de "Acciones" en fila o si hay que
  // colapsarlos al menú "3 puntos" (misma técnica que polizas.js: se
  // compara el ancho disponible del contenedor con scroll contra el ancho
  // natural de la tabla completa).
  let accionesResizeObserver = null;

  function setupAccionesResponsive() {
    const $tabla = $('#table-polizas');
    const $scrollWrap = $tabla.find('.table-polizas__scroll');
    const $table = $scrollWrap.find('> table');
    if (!$scrollWrap.length || !$table.length || typeof ResizeObserver === 'undefined') return;

    if (accionesResizeObserver) accionesResizeObserver.disconnect();

    const wasCollapsed = $tabla.hasClass('table-polizas--collapsed');
    $tabla.removeClass('table-polizas--collapsed');
    const naturalTableWidth = $table[0].scrollWidth;
    if (wasCollapsed) $tabla.addClass('table-polizas--collapsed');

    accionesResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const collapsed = entry.contentRect.width < naturalTableWidth - 20;
        requestAnimationFrame(() => {
          if ($tabla.hasClass('table-polizas--collapsed') !== collapsed) {
            $tabla.toggleClass('table-polizas--collapsed', collapsed);
          }
        });
      }
    });
    accionesResizeObserver.observe($scrollWrap[0]);
  }

  // Bootstrap 4 no maneja bien dos modales abiertos a la vez: antes de
  // abrir otro (p. ej. el de generar recibos) se espera a que el modal
  // del formulario termine de cerrarse.
  function hideModalEndosoThenShow(nextModalSelector, options = 'show') {
    const $modal = $('#modal-poliza');
    if (!$modal.hasClass('show')) {
      $(nextModalSelector).modal(options);
      return;
    }
    $modal.one('hidden.bs.modal', function () {
      $(nextModalSelector).modal(options);
    });
    $modal.modal('hide');
  }

  function abrirModalEndoso(titulo) {
    $('#titulo-modal-endoso').text(titulo);
    $('#modal-poliza').modal('show');
  }

  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    dataType: 'json',
  };

  // Drag & Drop y auto-upload para PDF
  const dropZone = $('#pdf_drop_zone');
  const fileInput = $('#pdf_file');
  const uploadContent = dropZone.find('.upload-content');
  const uploadLoading = dropZone.find('.upload-loading');

  dropZone.on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    fileInput.trigger('click');
  });

  fileInput.on('click', function (e) {
    e.stopPropagation();
  });

  dropZone.on('dragover dragenter', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.addClass('drag-over');
  });

  dropZone.on('dragleave dragend', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.removeClass('drag-over');
  });

  dropZone.on('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.removeClass('drag-over');
    const files = e.originalEvent.dataTransfer.files;
    if (files.length > 0) {
      fileInput[0].files = files;
      uploadEndosoPdf();
    }
  });

  fileInput.on('change', function (e) {
    e.stopPropagation();
    if (this.files.length > 0) {
      uploadEndosoPdf();
    }
  });

  function uploadEndosoPdf(endoso_id) {
    if (endoso_id) {
      const tempInput = $(`<input type="file" accept=".pdf" style="display:none;" />`);
      tempInput.on('change', function () {
        const file = this.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          alert('Solo se permiten archivos PDF', 'warning', 'Archivo inválido');
          return;
        }
        const formData = new FormData();
        formData.append('pdf_file', file);
        formData.append('endoso_id', endoso_id);

        Swal.fire({
          title: 'Procesando PDF...',
          text: 'Guardando archivo PDF',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        $.ajax({
          type: 'POST',
          url: '/endosos/upload_pdf',
          data: formData,
          processData: false,
          contentType: false,
          success: function (response) {
            Swal.close();
            if (response.error) {
              alert(response.msg, 'error', 'Error');
            } else {
              alert('PDF cargado exitosamente', 'success', 'Éxito');
              getEndosos();
            }
          },
          error: function () {
            Swal.close();
            alert('Error al procesar el PDF', 'error', 'Error');
          },
        });
      });
      tempInput.trigger('click');
      return;
    }

    const file = fileInput[0].files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se permiten archivos PDF', 'warning', 'Archivo inválido');
      fileInput.val('');
      return;
    }

    uploadContent.hide();
    uploadLoading.show();

    const formData = new FormData();
    formData.append('pdf_file', file);

    const endosoIdInput = document.getElementById('endoso_id');
    const actualEndosoId = endosoIdInput ? endosoIdInput.value : null;
    if (actualEndosoId && actualEndosoId !== 'New') {
      formData.append('endoso_id', actualEndosoId);
    }

    Swal.fire({
      title: 'Procesando PDF...',
      text: 'Guardando archivo PDF',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    $.ajax({
      type: 'POST',
      url: '/endosos/upload_pdf',
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        Swal.close();
        uploadLoading.hide();
        uploadContent.show();
        fileInput.val('');
        if (response.error) {
          alert(response.msg, 'error', 'Error');
        } else {
          if (response.pdf_path) {
            $('#pdf_path').val(response.pdf_path);
          }
          if (response.data) {
            fillFormWithEndosoPdfData(response.data);
          }
          alert('PDF cargado exitosamente', 'success', 'Éxito');
          getEndosos();
        }
      },
      error: function () {
        Swal.close();
        uploadLoading.hide();
        uploadContent.show();
        fileInput.val('');
        alert('Error al procesar el PDF', 'error', 'Error');
      },
    });
  }

  function getBackColor(status) {
    if (!status) return '';
    switch (status) {
      case 'Cancelada':
        return '#ee0e0e';
      case 'Finalizada':
        return '#565656';
      default:
        return '';
    }
  }

  function getTextColor(status) {
    if (!status) return '';
    switch (status) {
      case 'Cancelada':
        return '#ffffff';
      case 'Finalizada':
        return '#ffffff';
      default:
        return '';
    }
  }

  function alert(text = '', icon = 'success', title = '') {
    Swal.fire({ title, text, icon });
  }

  function alertConfirm(text = '') {
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

  function alertInput(title = '') {
    return Swal.fire({
      title,
      html: `<input type="text" id="razon" class="swal2-input" placeholder="Razon">`,
      confirmButtonText: 'Aceptar',
      focusConfirm: false,
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      allowOutsideClick: false,
      icon: 'warning',
      didOpen: () => {
        const popup = Swal.getPopup();
        razonInput = popup.querySelector('#razon');
        razonInput.onkeyup = (event) =>
          event.key === 'Enter' && Swal.clickConfirm();
      },
      preConfirm: () => {
        const razon = razonInput.value;
        if (!razon) {
          Swal.showValidationMessage(
            `Por favor ingrese una razon para cancelar`
          );
        }
        return { razon };
      },
    });
  }

  function formatDateFromPdf(dateStr) {
    if (!dateStr) return '';
    const raw = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const numeric = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (numeric) {
      const [, day, month, year] = numeric;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const months = {
      ENE: '01',
      ENERO: '01',
      FEB: '02',
      FEBRERO: '02',
      MAR: '03',
      MARZO: '03',
      ABR: '04',
      ABRIL: '04',
      MAY: '05',
      MAYO: '05',
      JUN: '06',
      JUNIO: '06',
      JUL: '07',
      JULIO: '07',
      AGO: '08',
      AGOSTO: '08',
      SEP: '09',
      SEPT: '09',
      SEPTIEMBRE: '09',
      OCT: '10',
      OCTUBRE: '10',
      NOV: '11',
      NOVIEMBRE: '11',
      DIC: '12',
      DICIEMBRE: '12',
    };
    const monthMatch = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .match(/(\d{1,2})\s*[\/\-\s]?\s*([A-Z]+)\s*[\/\-\s]?\s*(\d{4})/);
    if (monthMatch && months[monthMatch[2]]) {
      return `${monthMatch[3]}-${months[monthMatch[2]]}-${String(monthMatch[1]).padStart(2, '0')}`;
    }
    return '';
  }

  function normalizeToken(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  // La BD guarda la moneda como 'MXN'/'USD'/'UDIS' (enum), pero el <option>
  // del select usa "Udis" (minúsculas). El select nunca coincidía por el
  // "Udis" en un endoso ya guardado no se seleccionaba al editar/ver.
  function normalizeMonedaValue(value) {
    const token = normalizeToken(value);
    if (token.includes('USD') || token.includes('DOLAR')) return 'USD';
    if (token.includes('UDI')) return 'Udis';
    return 'MXN';
  }

  function setSelectValueByIdOrText(selector, idValue, textValue) {
    const select = $(selector);
    if (!select.length) return;

    if (idValue && select.find(`option[value="${idValue}"]`).length) {
      select.val(String(idValue)).trigger('change');
      return;
    }

    const normalizedText = normalizeToken(textValue);
    if (!normalizedText) return;

    let matchedValue = null;
    select.find('option').each(function () {
      const optionText = normalizeToken($(this).text());
      if (optionText && (optionText.includes(normalizedText) || normalizedText.includes(optionText))) {
        matchedValue = $(this).val();
        return false;
      }
    });
    if (matchedValue) select.val(matchedValue).trigger('change');
  }

  function fillFormWithEndosoPdfData(data) {
    if (!data) return;
    console.log('Datos extraídos del PDF de endoso:', data);

    if (data.numero_de_poliza) {
      $('#div_poliza_id').show();
      $('#id_poliza').val(data.numero_de_poliza);
    }
    if (data.endoso) {
      $('#Poliza').val(data.endoso);
    }

    if (data.nombre_cliente) $('#buscar-cliente').val(data.nombre_cliente);
    if (data.cliente_id) $('#selected-client-id').val(data.cliente_id);
    if (data.desde) $('#VigenciaI').val(formatDateFromPdf(data.desde));
    if (data.hasta) $('#VigenciaF').val(formatDateFromPdf(data.hasta));
    if (data.moneda) {
      const moneda = normalizeToken(data.moneda);
      $('#Moneda').val(moneda.includes('USD') || moneda.includes('DOLAR') ? 'USD' : moneda.includes('UDI') ? 'Udis' : 'MXN');
    }
    if (data.prima_neta) $('#prima_neta').val(String(data.prima_neta).replace(/[^0-9.-]/g, ''));
    if (data.prima_total) $('#prima_total').val(String(data.prima_total).replace(/[^0-9.-]/g, ''));
    if (data.serie) $('#serie').val(data.serie);

    const notas = [data.descripcion, data.observaciones].filter(Boolean).join('\n');
    if (notas) $('#notas').val(notas);

    setSelectValueByIdOrText('#ramo', data.ramo_id, data.ramo);
    setSelectValueByIdOrText('#subramo', data.subramo_id, data.subramo);
    setSelectValueByIdOrText('#aseguradora', data.aseguradora_id, data.aseguradora);
    setSelectValueByIdOrText('#Pago', data.tipo_pago_id, data.forma_de_pago);
    setSelectValueByIdOrText('#vendedor', data.vendedor_id, data.vendedor);
    setSelectValueByIdOrText('#agente', data.agente_id, data.agente);
  }

  function chooseEndosoType() {
    return Swal.fire({
      title: 'Tipo de endoso',
      input: 'radio',
      inputOptions: {
        A: 'A - Modificación de prima, con recibos',
        B: 'B - Cambio de datos, sin modificar primas ni recibos',
        D: 'D - Devolución, con recibos negativos',
      },
      inputValidator: (value) => (!value ? 'Selecciona el tipo de endoso' : undefined),
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
    });
  }

  // Al crear un endoso nuevo (no al editar uno existente), en cuanto se
  // captura/pierde el foco de "Póliza a la que pertenece" se busca esa
  // póliza: se avisa de inmediato si está Cancelada/Finalizada (antes el
  // usuario se enteraba hasta el final, ya con todo el formulario lleno),
  // y se precarga su fin de vigencia si el usuario no había puesto ya una.
  $('#id_poliza').on('blur', function () {
    const endosoId = $('#endoso_id').val();
    if (endosoId && endosoId !== 'New') return;
    const policyNumber = $(this).val().trim();
    if (!policyNumber) return;
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 10, searchValue: policyNumber }),
      success: function (resp) {
        const policies = resp.data || [];
        const compactNeedle = policyNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const exact = policies.find((p) => String(p.poliza || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === compactNeedle);
        const selected = exact || (policies.length === 1 ? policies[0] : null);
        if (!selected) return;
        if (selected.status === 'Cancelada' || selected.status === 'Finalizada') {
          alert(`No se puede crear un endoso: la póliza está ${selected.status}.`, 'error', 'Póliza no disponible');
          $('#id_poliza').val('');
          $('#poliza_id').val('New');
          return;
        }
        if (selected.fecha_termino && !$('#VigenciaF').val()) {
          $('#VigenciaF').val(selected.fecha_termino);
        }
      },
    });
  });

  function resolveParentPolicyId() {
    const currentPolizaId = $('#poliza_id').val();
    if (currentPolizaId && currentPolizaId !== 'New') {
      return Promise.resolve(currentPolizaId);
    }

    const policyNumber = $('#id_poliza').val().trim();
    if (!policyNumber) {
      return Promise.reject(new Error('Captura la póliza a la que pertenece el endoso'));
    }

    return new Promise((resolve, reject) => {
      $.ajax({
        ...ajaxConfig,
        url: '/polizas/get',
        data: $.param({ start: 0, length: 10, searchValue: policyNumber }),
        success: function (resp) {
          const policies = resp.data || [];
          const compactNeedle = policyNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const exact = policies.find((p) => String(p.poliza || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === compactNeedle);
          const selected = exact || (policies.length === 1 ? policies[0] : null);
          if (!selected) {
            reject(new Error('No se encontró una póliza única para asociar el endoso'));
            return;
          }
          $('#poliza_id').val(selected.id);
          $('#id_poliza').val(selected.poliza);
          resolve(selected.id);
        },
        error: function () {
          reject(new Error('No se pudo buscar la póliza del endoso'));
        },
      });
    });
  }

  // Derecho de póliza y % comisión del endoso que se está editando, para
  // precargarlos al regenerar sus recibos (antes quedaban vacíos).
  let endosoEnEdicion = { derecho_poliza: null, comision: null };

    function openReceiptsModalForEndoso(params, polizaId) {
    const newParams = `${params}&poliza_id=${polizaId}&is_endoso=true`;
    $.ajax({
      url: '/polizas/get_policy_values',
      method: 'POST',
      dataType: 'json',
      data: newParams,
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
          $('#create-recib').modal('hide');
          return;
        }
        if (resp.msg && resp.msg.includes('no coincidiran')) {
          $('#alert_Modal').show().text(resp.msg);
        }
        $('#prima-neta').val(resp.netPremium);
        $('#prima-total').val(resp.totalPremium);
        $('#nopagos').val(resp.numReceipts);
        $('#iva').val(16);
        $('#derecho_poliza').val(
          endosoEnEdicion.derecho_poliza != null ? parseFloat(endosoEnEdicion.derecho_poliza).toFixed(2) : '0.00',
        );
        $('#comision').val(
          endosoEnEdicion.comision != null && Number(endosoEnEdicion.comision) > 0
            ? parseFloat(endosoEnEdicion.comision).toFixed(2)
            : '10',
        );
        $('#alert_devolucion').toggle($('#tipo').val() === 'D');
        hideModalEndosoThenShow('#create-recib', { backdrop: 'static', keyboard: false });
        $('#receipts_created').val('no');
      },
      error: function (xhr, textStatus, error) {
        console.error(error);
        alert('Lamentamos el inconveniente, por favor vuelve a intentarlo', 'error');
      },
    });
  }

  async function resetForm() {
    try {
      $('#form-polizas')[0].reset();
      $('#btnGuardar').show();
      $('#reset-btn').show();
      $('#form-polizas').removeClass('was-validated');
      $('#form-polizas select').prop('disabled', false);
      $('#poliza_id').val('New');
      $('#endoso_id').val('New');
      $('#pdf_path').val('');
      $('#pdf_file').val('');
      $('#id_poliza').val('');
      $('#old_prima_neta').val('');
      $('#old_prima_total').val('');
      $('.upload-loading').hide();
      $('.upload-content').show();
      $('#tipo').val('');
      $('#div_poliza_id').show();
      $('#div_search_client').show();
      $('#title_poliza').text('Endoso');
      $('#form-polizas input, #form-polizas select, #form-polizas textarea').prop('disabled', false);
      $('#conducto_pago').val('Agente');
      $('#ramo').html('');
      $('#subramo').html('');
      $('#aseguradora').html('');
      $('#Pago').html('');
      $('#vendedor').html('');
      $('#agente').html('');
      $('#btnGuardar').html('Guardar');
      $('#nuevo_ramo_subramo_div').hide();
      $('#nuevo_aseguradora_div').hide();
      $('#nuevo_vendedor_div').hide();
      $('#nuevo_agente_div').hide();
      const data = await getFormData();
      if (!data) throw new Error('No se recibieron los catálogos del formulario');

      $('#ramo').append(`<option value="">Selecciona...</option>`);
      for (const ramo of data.Ramo) {
        $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
      }
      $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
      $('#subramo').append(`<option value="">Selecciona...</option>`);
      for (const subramo of data.Subramo) {
        $('#subramo').append(`<option value='${subramo.id}'>
          ${subramo.subramo}
          </option>
          `);
      }
      $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
      $('#aseguradora').append(`<option value="">Selecciona...</option>`);
      for (const aseguradora of data.Aseguradora) {
        $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
      }
      $('#aseguradora').append(
        `<option value="New">Nueva Aseguradora</option>`
      );
      $('#Pago').append(`<option value="">Selecciona...</option>`);
      for (const pago of data.TipoPago) {
        $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
      }
      for (const vendedor of data.Vendedor) {
        $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
      }
      $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
      for (const agente of data.Agente) {
        $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
      }
      $('#agente').append(`<option value="New">Nuevo Agente</option>`);
      return data;
    } catch (error) {
      console.error('Error al cargar catálogos de endosos', error);
      alert(
        'No se pudieron cargar los catálogos del formulario. Recarga la página para volver a intentarlo.',
        'error',
        'Error al cargar formulario'
      );
      return null;
    }
  }

  function getFormData() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: 'GET',
        url: '/polizas/get_form_data',
        data: {},
        success: function (resp) {
          resolve(resp);
          // console.log(resp);
        },
        error: function (xhr, status, error) {
          reject(error);
          console.error(error);
          alert(
            'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
            'error'
          );
        },
      });
    });
  }

  async function showEndoso(endoso_id) {
    const data = await resetForm();
    $('#btnGuardar').hide();
    abrirModalEndoso('Detalle del endoso');
    $('#endoso_id').val(endoso_id);
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start: 0, length: 0, endoso_id }),
      success: function (resp) {
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#div_poliza_id').show();
        $('#id_poliza').val(resp.data[0].poliza);
        $('#Poliza').val(resp.data[0].endoso);
        $('#poliza_id').val(resp.data[0].poliza_id);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#prima_neta').prop('disabled', false);
        $('#prima_total').prop('disabled', false);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(normalizeMonedaValue(resp.data[0].moneda));
        $('#conducto_pago').val(resp.data[0].conducto_pago || '');
        $('#prima_neta').val(formatCurrencyDisplay(resp.data[0].prima_neta));
        $('#prima_total').val(formatCurrencyDisplay(resp.data[0].prima_total));
        $('#prima_neta').prop('disabled', true);
        $('#prima_total').prop('disabled', true);
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        // "Ver detalle" es solo lectura: se bloquea TODO el formulario
        // (antes solo primas -- cliente, serie, vigencia, moneda, notas,
        // etc. se podían escribir aunque no hubiera botón para guardar).
        $('#form-polizas input, #form-polizas select, #form-polizas textarea').prop('disabled', true);
        console.log(resp.data[0]);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function cancelEndoso(endoso_id) {
    const { isConfirmed, value } = await alertInput(
      '¿Esta seguro de cancelar este endoso?'
    );
    console.log(endoso_id);
    if (!isConfirmed) return;
    if (!value.razon)
      return alert('Debe agregar una razón para cancelar', 'error');
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/delete',
      data: $.param({ endoso_id, razon: value.razon }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
          getEndosos();
        } else {
          alert(resp.msg, 'error');
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  const ICONOS = {
    show: 'M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z',
    edit: 'M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z',
    poliza: 'M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z',
    pdf: 'M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z',
    upload: 'M440-320h80v-160h120L480-640 320-480h120v160ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z',
    factura: 'M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z',
    facturaUpload: 'M320-240h320v-80H320v80Zm0-160h320v-80H320v80Zm120-200h80v-160h120L480-920 320-760h120v160ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z',
    cancel: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z',
    dots: 'M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z',
  };

  function icono(nombre, size, fill) {
    return `<svg xmlns="http://www.w3.org/2000/svg" height="${size}" viewBox="0 -960 960 960" width="${size}" fill="${fill}"><path d="${ICONOS[nombre]}"/></svg>`;
  }

  // Escapa texto antes de meterlo en el HTML de la tabla (nombres de
  // clientes, notas, etc. vienen de captura libre).
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(num) {
    const [integerPart, decimalPart = ''] = num.toString().split('.');
    let result = '';
    for (let i = 0; i < integerPart.length; i++) {
      if (i > 0 && (integerPart.length - i) % 3 === 0 && integerPart[i - 1] !== '-') result += ',';
      result += integerPart[i];
    }
    return decimalPart ? `${result}.${decimalPart}` : result;
  }

  function parseCurrencyInputValue(value) {
    if (value === null || value === undefined) return '';
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if (!cleaned) return '';
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? '' : parsed.toFixed(2);
  }

  function getCurrencyFieldValue(selector) {
    return parseCurrencyInputValue($(selector).val());
  }

  function bindCurrencyFormatting(selector) {
    const input = $(selector);
    input.on('focus', function () {
      $(this).val(parseCurrencyInputValue($(this).val()));
    });
    input.on('blur', function () {
      $(this).val(formatCurrencyDisplay($(this).val()));
    });
  }

  // El form guarda "$9,756.11" para que se vea bien, pero el backend
  // necesita el número crudo ("9756.11"). Se cambia el valor justo antes
  // de serializar y se restaura después, para no alterar lo que ve el
  // usuario en pantalla.
  function serializeEndosoFormWithRawCurrencyValues() {
    const primaNetaField = $('#prima_neta');
    const primaTotalField = $('#prima_total');
    const originalPrimaNeta = primaNetaField.val();
    const originalPrimaTotal = primaTotalField.val();

    primaNetaField.val(getCurrencyFieldValue('#prima_neta'));
    primaTotalField.val(getCurrencyFieldValue('#prima_total'));

    const serialized = $('#form-polizas').serialize();

    primaNetaField.val(originalPrimaNeta);
    primaTotalField.val(originalPrimaTotal);

    return serialized;
  }

  function displayCellValue(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).trim();
    if (!stringValue || ['null', 'undefined'].includes(stringValue.toLowerCase())) return '';
    return stringValue;
  }

  function formatCurrencyDisplay(value) {
    const normalized = parseCurrencyInputValue(value);
    if (!normalized) return '';
    return normalized.startsWith('-') ? `-$${formatNumber(normalized.slice(1))}` : `$${formatNumber(normalized)}`;
  }

  function formatReceiptAmount(value) {
    const normalized = parseCurrencyInputValue(value);
    if (!normalized) return '0.00';
    return normalized.startsWith('-') ? `-${formatNumber(normalized.slice(1))}` : formatNumber(normalized);
  }

  function fillTableEndosos(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const total = recordsTotal || 0;
    $('#endososTotalLabel').text(
      `${total} endoso${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`,
    );
    const table = $('#polizas-table');
    // Si un menú de acciones seguía abierto "flotando" sobre <body> al
    // repintar la tabla, se elimina para no dejarlo huérfano.
    $('body').children('.acciones-menu').remove();
    table.html('');

    if (!data || !data.length) {
      table.html(
        '<tr><td colspan="14" class="text-center text-muted py-4">No se encontraron endosos</td></tr>',
      );
      $('#pagination').html('');
      return;
    }

    $.each(data, function (idx, endoso) {
      const color = getTextColor(endoso.status);
      const fill = color || 'currentColor';
      const td = (value, nowrap = false) =>
        `<td style="color: ${color};${nowrap ? ' white-space: nowrap;' : ''}">${esc(value)}</td>`;
      const sinPdf = endoso.pdf_path
        ? ''
        : `<span title="Falta cargar el PDF de este endoso — clic para subirlo" class="pointer js-sin-pdf" style="display:inline-block; margin-left:6px; padding:1px 7px; border-radius:10px; font-size:11px; font-weight:600; background-color:#fdecea; color:#c0392b; border:1px solid #f1b0a8; vertical-align:middle;">Sin PDF</span>`;
      const $row = $(
        `<tr class="tableOption" style="background-color: ${getBackColor(endoso.status)}">
          <td>
            <p class="td-clickable js-ver-recibos" title="Ver recibos del endoso" style="color: ${color}">
              ${esc(endoso.endoso)}${sinPdf}
            </p>
          </td>
          <td>
            <a href="javascript:void(0)" class="poliza-link js-ver-poliza" title="Ver información de la póliza"
              style="color: ${color}; text-decoration: underline;">${esc(endoso.poliza)}</a>
          </td>
          ${td(endoso.tipo_endoso)}
          ${td(endoso.cliente)}
          ${td(endoso.serie || '')}
          ${td(endoso.fecha_inicio, true)}
          ${td(endoso.fecha_termino, true)}
          ${td(endoso.subramo)}
          ${td(endoso.aseguradora)}
          ${td(endoso.moneda)}
          ${td(endoso.tipoPago)}
          ${td(formatCurrencyDisplay(endoso.prima_neta), true)}
          ${td(formatCurrencyDisplay(endoso.prima_total), true)}
          <td>
            <ul class="btn_table_options acciones-full">
              <li><a title="Ver detalle del endoso" class="btn__icon_show pointer js-show">${icono('show', 21, fill)}</a></li>
              ${
                endoso.status !== 'Cancelada'
                  ? `<li><a title="Editar endoso" class="btn__icon_edit pointer js-edit">${icono('edit', 21, fill)}</a></li>`
                  : ''
              }
              <li><a title="Ver información de la póliza" class="btn__icon_show pointer js-ver-poliza">${icono('poliza', 24, fill)}</a></li>
              ${
                endoso.pdf_path
                  ? `<li><a title="Ver PDF" class="btn__icon_show pointer js-ver-pdf">${icono('pdf', 24, fill)}</a></li>`
                  : `<li><a title="Cargar PDF del endoso" class="btn__icon_show pointer js-cargar-pdf">${icono('upload', 24, fill)}</a></li>`
              }
              ${
                endoso.factura_pdf || endoso.factura_xml
                  ? `<li><a title="Ver/Descargar factura${endoso.factura_pdf && !endoso.factura_xml ? ' (falta XML)' : !endoso.factura_pdf && endoso.factura_xml ? ' (falta PDF)' : ''}" class="btn__icon_show pointer js-ver-factura">${icono('factura', 24, fill)}</a></li>`
                  : `<li><a title="Cargar factura del endoso" class="btn__icon_show pointer js-cargar-factura">${icono('facturaUpload', 24, fill)}</a></li>`
              }
              ${
                endoso.status !== 'Cancelada'
                  ? `<li><a title="Cancelar endoso" class="btn__icon_delete pointer js-cancelar">${icono('cancel', 24, fill)}</a></li>`
                  : ''
              }
            </ul>
            <div class="dropdown acciones-menu-wrapper">
              <button type="button" class="acciones-toggle pointer" data-toggle="dropdown" data-display="static"
                aria-haspopup="true" aria-expanded="false" title="Acciones">${icono('dots', 20, fill)}</button>
              <div class="dropdown-menu dropdown-menu-right acciones-menu">
                <a class="dropdown-item pointer js-show">${icono('show', 18, 'currentColor')} Ver detalle</a>
                ${
                  endoso.status !== 'Cancelada'
                    ? `<a class="dropdown-item pointer js-edit">${icono('edit', 18, 'currentColor')} Editar</a>`
                    : ''
                }
                <a class="dropdown-item pointer js-ver-poliza">${icono('poliza', 18, 'currentColor')} Ver póliza</a>
                <div class="dropdown-divider"></div>
                ${
                  endoso.pdf_path
                    ? `<a class="dropdown-item pointer js-ver-pdf">${icono('pdf', 18, 'currentColor')} Ver PDF</a>`
                    : `<a class="dropdown-item pointer js-cargar-pdf">${icono('upload', 18, 'currentColor')} Cargar PDF</a>`
                }
                ${
                  endoso.factura_pdf || endoso.factura_xml
                    ? `<a class="dropdown-item pointer js-ver-factura">${icono('factura', 18, 'currentColor')} Ver/Descargar factura${leyendaFaltante(endoso.factura_pdf, endoso.factura_xml)}</a>`
                    : `<a class="dropdown-item pointer js-cargar-factura">${icono('facturaUpload', 18, 'currentColor')} Cargar factura</a>`
                }
                ${
                  endoso.status !== 'Cancelada'
                    ? `<div class="dropdown-divider"></div>
                <a class="dropdown-item pointer text-danger js-cancelar">${icono('cancel', 18, 'currentColor')} Cancelar endoso</a>`
                    : ''
                }
              </div>
            </div>
          </td>
        </tr>`,
      );

      // Los eventos se enlazan sobre los elementos de ESTA fila (no por id):
      // antes varios endosos de la misma póliza repetían el id del link de
      // póliza y solo el primero respondía (y lo hacía varias veces). Los
      // del menú "3 puntos" se enlazan aquí también: el menú se mueve a
      // <body> al abrirse, pero conserva sus handlers.
      $row.find('.js-ver-recibos').on('click', () => {
        recibosContexto = {
          endoso_id: endoso.id,
          poliza_id: endoso.poliza_id,
          titulo: `Endoso ${endoso.endoso} — Póliza ${endoso.poliza}`,
        };
        $('#titulo-recibos-endoso').text(`Recibos del ${recibosContexto.titulo}`);
        $('#receiptsTable').html('');
        $('#recib').modal();
        getRecibos(endoso.id, endoso.poliza_id);
      });
      $row.find('.js-ver-factura').on('click', (e) => {
        e.preventDefault();
        viewEndosoFactura(endoso);
      });
      $row.find('.js-cargar-factura').on('click', (e) => {
        e.preventDefault();
        uploadEndosoFactura(endoso.id, () => getEndosos(endososPaginaActual, (endososPaginaActual - 1) * endososItemsOnPage));
      });
      $row.find('.js-sin-pdf').on('click', (e) => {
        e.stopPropagation();
        uploadEndosoPdf(endoso.id);
      });
      $row.find('.js-show').on('click', () => showEndoso(endoso.id));
      $row.find('.js-edit').on('click', () => editEndoso(endoso.id, endoso.poliza_id));
      $row.find('.js-ver-poliza').on('click', (e) => {
        e.preventDefault();
        showPolizaInfo(endoso.poliza_id);
      });
      $row.find('.js-ver-pdf').on('click', (e) => {
        e.preventDefault();
        viewEndosoPdf(endoso);
      });
      $row.find('.js-cargar-pdf').on('click', (e) => {
        e.preventDefault();
        uploadEndosoPdf(endoso.id);
      });
      $row.find('.js-cancelar').on('click', () => cancelEndoso(endoso.id));

      table.append($row);
    });

    setupAccionesResponsive();

    $('#pagination').pagination({
      items: total,
      itemsOnPage: itemsOnPage,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getEndosos(pageNumber, start);
      },
    });
  }

  async function editEndoso(endoso_id, poliza_id) {
    const data = await resetForm();
    $('#btnGuardar').html('Actualizar endoso');
    abrirModalEndoso('Editar endoso');
    $('#endoso_id').val(endoso_id);
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start: 0, length: 0, endoso_id }),
      success: function (resp) {
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#div_poliza_id').show();
        $('#id_poliza').val(resp.data[0].poliza);
        $('#Poliza').val(resp.data[0].endoso);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#prima_neta').prop('disabled', false);
        $('#prima_total').prop('disabled', false);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(normalizeMonedaValue(resp.data[0].moneda));
        $('#conducto_pago').val(resp.data[0].conducto_pago || '');
        $('#tipo').val(resp.data[0].tipo_endoso);
        $('#prima_neta').val(formatCurrencyDisplay(resp.data[0].prima_neta));
        $('#prima_total').val(formatCurrencyDisplay(resp.data[0].prima_total));
        // Un endoso B solo modifica datos de la póliza (ramo, vigencia,
        // aseguradora, etc.), nunca primas ni recibos.
        $('#prima_neta').prop('disabled', resp.data[0].tipo_endoso === 'B');
        $('#prima_total').prop('disabled', resp.data[0].tipo_endoso === 'B');
        $('#old_prima_neta').val(resp.data[0].prima_neta);
        $('#old_prima_total').val(resp.data[0].prima_total);
        $('#old_tipo_pago_id').val(resp.data[0].tipo_pago_id);
        endosoEnEdicion = {
          derecho_poliza: resp.data[0].derecho_poliza,
          comision: resp.data[0].comision,
        };
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        if (data) {
          for (const ramo of data.Ramo) {
            $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
          }
          $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
          for (const subramo of data.Subramo) {
            $('#subramo').append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
          }
          $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
          for (const aseguradora of data.Aseguradora) {
            $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
          }
          $('#aseguradora').append(
            `<option value="New">Nueva Aseguradora</option>`
          );
          for (const pago of data.TipoPago) {
            $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
          }
          for (const vendedor of data.Vendedor) {
            $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
          }
          $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
          for (const agente of data.Agente) {
            $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
          }
          $('#agente').append(`<option value="New">Nuevo Agente</option>`);
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  // ---------------------------------------------------------------------
  // Recibos del endoso — misma tabla y mismas acciones que en pólizas
  // (pagar, editar fecha de pago, Aviso de Cobro y Complemento de Pago).
  // Se usan las mismas rutas de /polizas/...: trabajan por recibo y
  // guardan los documentos en la carpeta de la póliza a la que pertenece
  // el endoso (Poliza_.../recibos/Recibo_{id}/...).
  // ---------------------------------------------------------------------
  let recibosContexto = { endoso_id: null, poliza_id: null, titulo: '' };
  let reciboFechaPagoId = null;

  function recargarRecibos() {
    getRecibos(recibosContexto.endoso_id, recibosContexto.poliza_id);
  }

  function fillTableRecibos(resp, currentPage, itemsOnPage, endoso_id, poliza_id) {
    if (resp.error) {
      alert(resp.msg, 'error', 'Error');
      return;
    }
    const { data, recordsTotal } = resp;
    const table = $('#receiptsTable');
    table.html('');
    const hayCancelados = data.some((r) => r.cancelado);
    $('#tablaRecibosCompacta').toggleClass('tiene-cancelados', hayCancelados);

    if (!data.length) {
      table.html(
        '<tr><td colspan="11" class="text-center text-muted py-3">Este endoso no tiene recibos</td></tr>',
      );
      $('#pagination-recibos').html('');
      return;
    }

    $.each(data, function (idx, recibo) {
      const fechaPago = displayCellValue(recibo.fecha_pago);
      const $row = $(
        `<tr class="tableOption-recibos">
            <td>${esc(displayCellValue(recibo.numero))}</td>
            <td>${esc(displayCellValue(recibo.fecha_recibo))}</td>
            <td>${esc(displayCellValue(recibo.vencimiento))}</td>
            <td>${formatReceiptAmount(recibo.prima_neta)}</td>
            <td>${formatReceiptAmount(recibo.prima_total)}</td>
            <td>${esc(displayCellValue(recibo.moneda))}</td>
            <td><input type="checkbox" class="js-pagado" ${recibo.pagado ? 'checked' : ''} /></td>
            <td>${esc(fechaPago)} ${
              fechaPago
                ? `<a class="btn__icon_edit pointer js-editar-fecha" title="Modificar fecha de pago">${icono('edit', 21, 'currentColor')}</a>`
                : ''
            }</td>
            <td class="col-cancelado">${recibo.cancelado ? 'Cancelado' : ''}</td>
            <td>${
              recibo.comprobante
                ? '<button type="button" class="btn px-2 py-1 js-ver-aviso">Ver/Descargar</button>'
                : '<button type="button" class="btn px-2 py-1 js-cargar-aviso">Cargar</button>'
            }</td>
            <td>${
              recibo.complemento_pago_pdf || recibo.complemento_pago_xml
                ? `<button type="button" class="btn px-2 py-1 js-ver-complemento">Ver/Descargar</button>${leyendaFaltante(recibo.complemento_pago_pdf, recibo.complemento_pago_xml)}`
                : '<button type="button" class="btn px-2 py-1 js-cargar-complemento">Cargar</button>'
            }</td>
         </tr>`,
      );
      $row.find('.js-pagado').on('click', function () {
        changeReciboPagado(recibo.id, this.checked ? 'Pagar' : 'Cancelar Pago');
      });
      $row.find('.js-editar-fecha').on('click', () => {
        reciboFechaPagoId = recibo.id;
        $('#fecha_pago').val(recibo.fecha_pago || '');
        $('#form_date_recib').removeClass('was-validated');
        $('#edit_recib_date').modal();
      });
      $row.find('.js-ver-aviso').on('click', (e) => {
        e.preventDefault();
        viewReceiptComprobante(recibo);
      });
      $row.find('.js-cargar-aviso').on('click', (e) => {
        e.preventDefault();
        uploadReceiptComprobante(recibo.id, recargarRecibos);
      });
      $row.find('.js-ver-complemento').on('click', (e) => {
        e.preventDefault();
        viewReceiptComplemento(recibo);
      });
      $row.find('.js-cargar-complemento').on('click', (e) => {
        e.preventDefault();
        uploadReceiptComplemento(recibo.id, recargarRecibos);
      });
      table.append($row);
    });

    $('#pagination-recibos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(endoso_id, poliza_id, pageNumber, start);
      },
    });
  }

  function changeReciboPagado(recibo_id, accion) {
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data: $.param({ recibo_id, accion }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, 'success');
        }
        recargarRecibos();
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert('Lamentamos el inconveniente, porfavor vuelve a intentarlo', 'error');
        recargarRecibos();
      },
    });
  }

  $('#form_date_recib').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data: $.param({
        accion: 'Modificar Fecha de Pago',
        recibo_id: reciboFechaPagoId,
        fecha_pago: $('#fecha_pago').val(),
      }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          $('#edit_recib_date').modal('hide');
          alert(resp.msg, 'success');
          reciboFechaPagoId = null;
          recargarRecibos();
        }
      },
      error: function (xhr, status, error) {
        console.error('Error en process_receipt', error);
        alert('Lamentamos el inconveniente, porfavor vuelve a intentarlo', 'error');
      },
    });
  });

  const TRASH_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';

  function leyendaFaltante(tienePdf, tieneXml) {
    if (tienePdf && !tieneXml) return ' <span style="font-size:0.68em; color:#dc3545; font-weight:600;">(falta XML)</span>';
    if (!tienePdf && tieneXml) return ' <span style="font-size:0.68em; color:#dc3545; font-weight:600;">(falta PDF)</span>';
    return '';
  }

  function confirmarEliminarDocumento(mensaje, onConfirm) {
    Swal.fire({
      title: '¿Eliminar documento?',
      text: mensaje,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    }).then((result) => {
      if (result.isConfirmed) onConfirm();
    });
  }

  // Selector de archivos + subida por AJAX. `campos` son los datos extra
  // del form (ej. recibo_id o endoso_id); `soloTipo` limita a pdf/xml.
  function subirArchivos({ url, campos, accept, multiple, validar, armarFormData, titulo, okTitulo, errorMsg, onSuccess }) {
    const fileInput = $(
      `<input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none;" />`,
    );
    $('body').append(fileInput);
    fileInput.on('change', function () {
      const files = Array.from(this.files || []);
      fileInput.remove();
      if (!files.length) return;
      const error = validar(files);
      if (error) {
        alert(error, 'warning', 'Archivo inválido');
        return;
      }
      const formData = new FormData();
      Object.entries(campos).forEach(([k, v]) => formData.append(k, v));
      armarFormData(formData, files);
      Swal.fire({
        title: titulo,
        text: 'Guardando documento(s)',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      $.ajax({
        type: 'POST',
        url,
        data: formData,
        processData: false,
        contentType: false,
        success: function (resp) {
          Swal.close();
          if (resp.error) {
            alert(resp.msg, 'error', 'Error');
          } else {
            alert(resp.msg, 'success', okTitulo);
            if (onSuccess) onSuccess();
          }
        },
        error: function () {
          Swal.close();
          alert(errorMsg, 'error', 'Error');
        },
      });
    });
    fileInput.trigger('click');
  }

  // PDF + XML (complemento de pago y factura comparten la misma mecánica).
  function subirPdfXml({ url, campos, prefijoCampo, soloTipo, nombreDoc, titulo, okTitulo, errorMsg, onSuccess }) {
    const esPdf = (f) => f.name.toLowerCase().endsWith('.pdf');
    const esXml = (f) => f.name.toLowerCase().endsWith('.xml');
    subirArchivos({
      url,
      campos,
      accept: soloTipo === 'pdf' ? '.pdf' : soloTipo === 'xml' ? '.xml' : '.pdf,.xml',
      multiple: !soloTipo,
      validar: (files) => {
        const invalido = files.find((f) => !esPdf(f) && !esXml(f));
        if (invalido || (!files.find(esPdf) && !files.find(esXml))) {
          return soloTipo ? `Selecciona un archivo .${soloTipo}` : `Selecciona el PDF y/o el XML ${nombreDoc}`;
        }
        return null;
      },
      armarFormData: (formData, files) => {
        const pdf = files.find(esPdf);
        const xml = files.find(esXml);
        if (pdf && soloTipo !== 'xml') formData.append(`${prefijoCampo}_pdf`, pdf);
        if (xml && soloTipo !== 'pdf') formData.append(`${prefijoCampo}_xml`, xml);
      },
      titulo,
      okTitulo,
      errorMsg,
      onSuccess,
    });
  }

  function uploadReceiptComprobante(reciboId, onSuccess) {
    subirArchivos({
      url: '/polizas/upload_receipt_comprobante',
      campos: { recibo_id: reciboId },
      accept: '.pdf',
      multiple: false,
      validar: (files) =>
        files[0].name.toLowerCase().endsWith('.pdf') ? null : 'El comprobante debe ser un archivo PDF',
      armarFormData: (formData, files) => formData.append('comprobante_pdf', files[0]),
      titulo: 'Cargando comprobante...',
      okTitulo: 'Comprobante cargado',
      errorMsg: 'Error al cargar el comprobante',
      onSuccess,
    });
  }

  function uploadReceiptComplemento(reciboId, onSuccess, soloTipo) {
    subirPdfXml({
      url: '/polizas/upload_receipt_complemento',
      campos: { recibo_id: reciboId },
      prefijoCampo: 'complemento',
      soloTipo,
      nombreDoc: 'del complemento de pago',
      titulo: 'Cargando complemento de pago...',
      okTitulo: 'Complemento cargado',
      errorMsg: 'Error al cargar el complemento de pago',
      onSuccess,
    });
  }

  // Ventanita "Ver/Descargar + Eliminar" para documentos PDF/XML.
  // `docs` = [{ key, label, tiene, verUrl, borrarUrl, borrarData, recargar, subir }]
  function mostrarDocumentos(titulo, docs) {
    const fila = (d) =>
      d.tiene
        ? `<div style="display:flex; gap:8px;">
             <button type="button" class="btn" id="btnVer_${d.key}" style="flex:1;">${d.labelVer}</button>
             <button type="button" class="btn" id="btnEliminar_${d.key}" title="Eliminar" style="flex:0 0 44px; background-color:#dc3545; color:#fff; display:flex; align-items:center; justify-content:center;">${TRASH_ICON_SVG}</button>
           </div>`
        : `<div style="display:flex; gap:8px;"><button type="button" class="btn" id="btnCargar_${d.key}" style="flex:1;">${d.labelCargar}</button><div style="flex:0 0 44px;"></div></div>`;
    Swal.fire({
      title: titulo,
      width: 420,
      html: `<div style="display:flex; flex-direction:column; gap:8px;">${docs.map(fila).join('')}</div>`,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        docs.forEach((d) => {
          $(`#btnVer_${d.key}`).on('click', () => window.open(d.verUrl, '_blank'));
          $(`#btnCargar_${d.key}`).on('click', () => {
            Swal.close();
            d.subir();
          });
          $(`#btnEliminar_${d.key}`).on('click', () => {
            confirmarEliminarDocumento(d.mensajeEliminar, () => {
              $.ajax({
                type: 'POST',
                url: d.borrarUrl,
                data: d.borrarData || {},
                success: (resp) => {
                  Swal.close();
                  if (resp.error) {
                    alert(resp.msg, 'error', 'Error');
                  } else {
                    d.recargar();
                    d.subir();
                  }
                },
                error: () => alert('Error al eliminar el documento', 'error', 'Error'),
              });
            });
          });
        });
      },
    });
  }

  function viewReceiptComprobante(recibo) {
    mostrarDocumentos(`Aviso de Cobro — ${recibosContexto.titulo}`, [
      {
        key: 'aviso',
        tiene: !!recibo.comprobante,
        labelVer: 'Ver/Descargar PDF',
        labelCargar: 'Cargar PDF',
        verUrl: `/polizas/download_receipt_comprobante/${recibo.id}`,
        borrarUrl: '/polizas/delete_receipt_comprobante',
        borrarData: { recibo_id: recibo.id },
        mensajeEliminar: 'Se eliminará el Aviso de Cobro de este recibo. Esta acción no se puede deshacer.',
        recargar: recargarRecibos,
        subir: () => uploadReceiptComprobante(recibo.id, recargarRecibos),
      },
    ]);
  }

  function viewReceiptComplemento(recibo) {
    const doc = (tipo) => ({
      key: `complemento_${tipo}`,
      tiene: !!recibo[`complemento_pago_${tipo}`],
      labelVer: tipo === 'pdf' ? 'Ver/Descargar PDF' : 'Descargar XML',
      labelCargar: `Cargar ${tipo.toUpperCase()} (falta)`,
      verUrl: `/polizas/download_receipt_complemento/${recibo.id}/${tipo}`,
      borrarUrl: `/polizas/delete_receipt_complemento/${recibo.id}/${tipo}`,
      mensajeEliminar: `Se eliminará el ${tipo.toUpperCase()} del complemento de pago de este recibo. Esta acción no se puede deshacer.`,
      recargar: recargarRecibos,
      subir: () => uploadReceiptComplemento(recibo.id, recargarRecibos, tipo),
    });
    mostrarDocumentos(`Complemento de Pago — ${recibosContexto.titulo}`, [doc('pdf'), doc('xml')]);
  }

  // ---------------------------------------------------------------------
  // Factura del endoso (PDF + XML) — igual que la factura de pólizas.
  // Los archivos viven en Poliza_.../endosos/Endoso_{id}_{numero}/factura/
  // ---------------------------------------------------------------------
  function uploadEndosoFactura(endosoId, onSuccess, soloTipo) {
    subirPdfXml({
      url: '/endosos/upload_factura',
      campos: { endoso_id: endosoId },
      prefijoCampo: 'factura',
      soloTipo,
      nombreDoc: 'de la factura',
      titulo: 'Cargando factura...',
      okTitulo: 'Factura cargada',
      errorMsg: 'Error al cargar la factura',
      onSuccess,
    });
  }

  // El PDF propio del endoso (no la factura): una vez cargado solo se podía
  // ver, sin forma de quitarlo ni reemplazarlo desde la interfaz.
  function viewEndosoPdf(endoso) {
    const recargar = () => getEndosos(endososPaginaActual, (endososPaginaActual - 1) * endososItemsOnPage);
    mostrarDocumentos(`PDF — Endoso ${endoso.endoso}`, [{
      key: 'pdf',
      tiene: !!endoso.pdf_path,
      labelVer: 'Ver/Descargar PDF',
      labelCargar: 'Cargar PDF',
      verUrl: `/static/${endoso.pdf_path}`,
      borrarUrl: `/endosos/delete_pdf/${endoso.id}`,
      mensajeEliminar: 'Se eliminará el PDF de este endoso. Esta acción no se puede deshacer.',
      recargar,
      subir: () => uploadEndosoPdf(endoso.id),
    }]);
  }

  function viewEndosoFactura(endoso) {
    const recargar = () => getEndosos(endososPaginaActual, (endososPaginaActual - 1) * endososItemsOnPage);
    const doc = (tipo) => ({
      key: `factura_${tipo}`,
      tiene: !!endoso[`factura_${tipo}`],
      labelVer: tipo === 'pdf' ? 'Ver/Descargar PDF' : 'Descargar XML',
      labelCargar: `Cargar ${tipo.toUpperCase()} (falta)`,
      verUrl: `/endosos/download_factura/${endoso.id}/${tipo}`,
      borrarUrl: `/endosos/delete_factura/${endoso.id}/${tipo}`,
      mensajeEliminar: `Se eliminará el ${tipo.toUpperCase()} de la factura de este endoso. Esta acción no se puede deshacer.`,
      recargar,
      subir: () => uploadEndosoFactura(endoso.id, recargar, tipo),
    });
    mostrarDocumentos(`Factura — Endoso ${endoso.endoso}`, [doc('pdf'), doc('xml')]);
  }

  function showPolizaInfo(poliza_id) {
    if (!poliza_id) {
      alert('No se encontró el ID de la póliza', 'error', 'Error');
      return;
    }
    $('#btnEditarPolizaDesdeEndoso').off('click').on('click', () => {
      window.open(`/polizas?editar_id=${poliza_id}`, '_blank');
    });
    $('#poliza-info-loading').show();
    $('#poliza-info-content').hide();
    $('#poliza-info-error').hide();
    $('#poliza-info-modal').modal('show');

    $.ajax({
      type: 'POST',
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        $('#poliza-info-loading').hide();
        if (resp.error || !resp.data || !resp.data.length) {
          $('#poliza-info-error')
            .text(resp.msg || 'No se encontró información de la póliza')
            .show();
          return;
        }
        const p = resp.data[0];
        $('#pi-poliza').text(p.poliza || '-');
        $('#pi-cliente').text(p.cliente || '-');
        $('#pi-aseguradora').text(p.aseguradora || '-');
        $('#pi-ramo').text(p.ramo || '-');
        $('#pi-subramo').text(p.subramo || '-');
        $('#pi-moneda').text(p.moneda || '-');
        $('#pi-vigencia').text(
          p.fecha_inicio && p.fecha_termino
            ? `${p.fecha_inicio} a ${p.fecha_termino}`
            : '-'
        );
        $('#pi-tipoPago').text(p.tipoPago || '-');
        $('#pi-vendedor').text(p.vendedor || '-');
        $('#pi-agente').text(p.agente || '-');
        $('#pi-prima_neta').text(p.prima_neta || '-');
        $('#pi-prima_total').text(p.prima_total || '-');
        $('#pi-status').text(p.status || '-');
        $('#pi-notas').text(p.Notas && p.Notas.trim() ? p.Notas : 'Sin notas');
        $('#poliza-info-content').show();
      },
      error: function (xhr, status, error) {
        $('#poliza-info-loading').hide();
        $('#poliza-info-error')
          .text('Error al obtener la información de la póliza')
          .show();
        console.error(error);
      },
    });
  }

  // ---------------------------------------------------------------------
  // Listado, búsqueda, filtros y exportación (igual que en pólizas)
  // ---------------------------------------------------------------------
  // Filas por página: NO es un número fijo (a diferencia de la versión
  // anterior, ENDOSOS_POR_PAGINA=10) -- se recalcula según cuántas filas
  // caben de verdad en la pantalla, igual que en pólizas, para que la
  // tabla llene el espacio disponible en vez de dejar hueco gris abajo
  // cuando la ventana es grande.
  let endososItemsOnPage = 10;
  let endososAutoAdjustAttempts = 0;
  const ENDOSOS_MAX_AUTO_ADJUST_ATTEMPTS = 5;
  let endososPaginaActual = 1;
  let totalEndosos = 0;
  let endososRequest = null;
  let endososRequestSeq = 0;

  function getFiltrosEndosos() {
    const filtros = {};
    const put = (key, value) => {
      if (value) filtros[key] = value;
    };
    put('filtro_aseguradora_id', $('#filtroAseguradora').val());
    put('filtro_status', $('#filtroStatus').val());
    put('filtro_tipo', $('#filtroTipo').val());
    put('filtro_grupo_id', $('#filtroGrupo').val());
    put('filtro_fecha_desde', $('#filtroFechaDesde').val());
    put('filtro_fecha_hasta', $('#filtroFechaHasta').val());
    if ($('#filtroSinPdf').is(':checked')) filtros.filtro_sin_pdf = 1;
    return filtros;
  }

  // Solo se pinta la respuesta de la ÚLTIMA petición: si el usuario escribe
  // rápido, una respuesta vieja ya no puede tapar los resultados correctos.
  function getEndosos(pageNumber = 1, start = 0, isAutoAdjust = false) {
    if (!isAutoAdjust) endososAutoAdjustAttempts = 0;
    endososPaginaActual = pageNumber;
    const searchValue = $('#searchEndoso').val().trim();
    const params = { start, length: endososItemsOnPage, order: true, ...getFiltrosEndosos() };
    if (searchValue) params.searchValue = searchValue;
    const seq = ++endososRequestSeq;
    if (endososRequest) endososRequest.abort();
    endososRequest = $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param(params),
      success: (resp) => {
        if (seq !== endososRequestSeq) return;
        totalEndosos = resp.recordsTotal || 0;
        fillTableEndosos(resp, pageNumber, endososItemsOnPage);
        if (!isAutoAdjust) adjustEndososItemsOnPageAndReload();
      },
      error: (xhr, status, error) => {
        if (status !== 'abort') console.error(error);
      },
    });
  }

  // Mide el alto real ya renderizado (fila + encabezado + paginador) contra
  // el espacio disponible en la ventana y pide exactamente las filas que
  // caben. Misma lógica ya probada en polizas.js, con los nombres de esta
  // página. Reintenta (con tope) porque la primera medición puede salir
  // corta si las fuentes web (@font-face) aún no habían cargado.
  function adjustEndososItemsOnPageAndReload() {
    if (endososAutoAdjustAttempts >= ENDOSOS_MAX_AUTO_ADJUST_ATTEMPTS) {
  return;
    }

    const $scrollWrap = $('#table-polizas .table-polizas__scroll');
    const $thead = $scrollWrap.find('thead');
    const $firstRow = $('#polizas-table tr').first();
    const $pagination = $('.table-polizas__pagination');
if (!$scrollWrap.length || !$firstRow.length) return;

    const top = $scrollWrap[0].getBoundingClientRect().top;
    const theadHeight = $thead.length ? $thead[0].getBoundingClientRect().height : 0;
    const rowHeight = $firstRow[0].getBoundingClientRect().height;
    const paginacionHeight = $pagination.length ? $pagination.outerHeight(true) : 60;
    const margenInferior = 16;
    if (!rowHeight) return;

    const disponible = window.innerHeight - top - theadHeight - paginacionHeight - margenInferior;
    const idealCount = Math.max(5, Math.floor(disponible / rowHeight));
if (idealCount === endososItemsOnPage) return;

    endososAutoAdjustAttempts += 1;
    endososItemsOnPage = idealCount;
    const start = (endososPaginaActual - 1) * idealCount;
    getEndosos(endososPaginaActual, start, true);
  }

  let endososResizeDebounce = null;
  $(window).on('resize', () => {
    clearTimeout(endososResizeDebounce);
    endososResizeDebounce = setTimeout(() => {
      endososAutoAdjustAttempts = 0;
      adjustEndososItemsOnPageAndReload();
    }, 200);
  });

  // La señal principal de "ya hay filas para medir" es el propio éxito de
  // getEndosos() (arriba, en su 'success'). document.fonts.ready se deja
  // como respaldo, por si una fuente web (@font-face) termina de cargar
  // DESPUÉS y cambia el alto real de fila. 'window.load' NO se usa: ese
  // evento espera recursos (imágenes, CSS, scripts) pero NO peticiones
  // AJAX -- puede disparar con la tabla todavía vacía.
  if (window.document && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      endososAutoAdjustAttempts = 0;
      adjustEndososItemsOnPageAndReload();
    });
  }

  function getRecibos(endoso_id, poliza_id, pageNumber = 1, start = 0) {
    const length = 10;
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_receipts',
      data: $.param({ start, length, endoso_id }),
      success: (resp) => fillTableRecibos(resp, pageNumber, length, endoso_id, poliza_id),
      error: (xhr, status, error) => {
        console.error(error);
        alert('No se pudieron cargar los recibos del endoso', 'error', 'Error');
      },
    });
  }

  const ENDOSOS_COLUMNAS_EXPORT = [
    { key: 'endoso', label: 'Endoso' },
    { key: 'poliza', label: 'Póliza' },
    { key: 'tipo_endoso', label: 'Tipo' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'fecha_inicio', label: 'Inicio Vigencia' },
    { key: 'fecha_termino', label: 'Fin Vigencia' },
    { key: 'subramo', label: 'Sub Ramo' },
    { key: 'aseguradora', label: 'Aseguradora' },
    { key: 'moneda', label: 'Moneda' },
    { key: 'tipoPago', label: 'Forma de Pago' },
    { key: 'prima_neta', label: 'Prima Neta', moneda: true },
    { key: 'prima_total', label: 'Prima Total', moneda: true },
    { key: 'status', label: 'Estado' },
  ];

  function valorExport(item, col) {
    return col.moneda ? formatCurrencyDisplay(item[col.key]) : displayCellValue(item[col.key]);
  }

  // Trae TODOS los endosos que coinciden con la búsqueda/filtros actuales
  // (no solo la página visible). Se envuelve en Promise.resolve porque la
  // promesa de jQuery 2 no tiene .catch().
  function fetchAllEndososFiltrados() {
    const searchValue = $('#searchEndoso').val().trim();
    const params = { start: 0, length: 0, order: true, ...getFiltrosEndosos() };
    if (searchValue) params.searchValue = searchValue;
    return Promise.resolve(
      $.ajax({ ...ajaxConfig, url: '/endosos/get', data: $.param(params) }),
    ).then((resp) => {
      const items = resp.data || [];
      if (!items.length) alert('No hay endosos para exportar con los filtros actuales', 'info');
      return items;
    });
  }

  // Logo para el PDF. Se reduce en un <canvas> a tamaño de impresión antes
  // de incrustarlo: el PNG original es de ~1756x1915 px y, metido tal cual,
  // hacía que el PDF pesara más de 13 MB. También se toma su proporción real
  // (antes se asumía 615x1024 y el logo salía deformado).
  let endososLogoCache = null;
  function obtenerLogoParaPdf() {
    if (endososLogoCache) return Promise.resolve(endososLogoCache);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxLado = 160;
        const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * escala);
        canvas.height = Math.round(img.naturalHeight * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        endososLogoCache = {
          dataUrl: canvas.toDataURL('image/png'),
          proporcion: img.naturalHeight / img.naturalWidth,
        };
        resolve(endososLogoCache);
      };
      img.onerror = reject;
      img.src = $('.logo-ggc').attr('src');
    });
  }

  // Mismo diseño de PDF que pólizas: logo, título, fecha y tabla con el
  // encabezado en el color de marca.
  async function construirEndososPdfDoc(items) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('La librería jsPDF no cargó (revisa la consola/Network por si el CDN está bloqueado).');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    if (typeof doc.autoTable !== 'function') {
      throw new Error('El plugin jspdf-autotable no cargó (revisa la consola/Network por si el CDN está bloqueado).');
    }
    let inicioTextoX = 14;
    try {
      const logo = await obtenerLogoParaPdf();
      const logoW = 12;
      const logoH = logoW * logo.proporcion;
      doc.addImage(logo.dataUrl, 'PNG', 14, 8, logoW, logoH, undefined, 'FAST');
      inicioTextoX = 14 + logoW + 6;
    } catch (e) {
      // Sin logo si falla la descarga; no se bloquea la exportación.
    }
    doc.setFontSize(14);
    doc.text('Tabla de Endosos', inicioTextoX, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, inicioTextoX, 24);
    doc.setTextColor(0);
    doc.autoTable({
      startY: 34,
      head: [ENDOSOS_COLUMNAS_EXPORT.map((c) => c.label)],
      body: items.map((it) => ENDOSOS_COLUMNAS_EXPORT.map((c) => valorExport(it, c))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [201, 74, 28] },
    });
    return doc;
  }

  $('#btnExportar').click((e) => {
    e.preventDefault();
    fetchAllEndososFiltrados()
      .then((items) => {
        if (!items.length) return;
        if (typeof XLSX === 'undefined') throw new Error('La librería de Excel no cargó.');
        const filas = items.map((it) => {
          const fila = {};
          ENDOSOS_COLUMNAS_EXPORT.forEach((c) => {
            // En Excel las primas se exportan como número, para poder sumarlas.
            fila[c.label] = c.moneda ? Number(it[c.key]) || 0 : displayCellValue(it[c.key]);
          });
          return fila;
        });
        const ws = XLSX.utils.json_to_sheet(filas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Endosos');
        XLSX.writeFile(wb, `endosos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      })
      .catch((err) => alert(`No se pudo exportar a Excel: ${err && err.message ? err.message : err}`, 'error', 'Error'));
  });

  $('#btnPdf').click((e) => {
    e.preventDefault();
    fetchAllEndososFiltrados()
      .then(async (items) => {
        if (!items.length) return;
        const doc = await construirEndososPdfDoc(items);
        doc.save(`endosos_${new Date().toISOString().slice(0, 10)}.pdf`);
      })
      .catch((err) => alert(`No se pudo generar el PDF: ${err && err.message ? err.message : err}`, 'error', 'Error'));
  });

  $('#btnImprimir').click((e) => {
    e.preventDefault();
    fetchAllEndososFiltrados()
      .then(async (items) => {
        if (!items.length) return;
        const doc = await construirEndososPdfDoc(items);
        doc.autoPrint();
        const url = doc.output('bloburl');
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          try {
            iframe.contentWindow.focus();
          } catch (err) {
            window.open(url, '_blank');
          }
        };
      })
      .catch((err) => alert(`No se pudo generar el PDF para imprimir: ${err && err.message ? err.message : err}`, 'error', 'Error'));
  });

  $('#btnToggleFiltros').click((e) => {
    e.preventDefault();
    $('#panelFiltrosPolizas').slideToggle(150);
  });

  $('#btnAplicarFiltros').click((e) => {
    e.preventDefault();
    getEndosos(1, 0);
  });

  $('#btnLimpiarFiltros').click((e) => {
    e.preventDefault();
    $('#filtroAseguradora, #filtroStatus, #filtroTipo, #filtroGrupo').val('');
    $('#filtroFechaDesde, #filtroFechaHasta, #filtroMesRapido, #filtroMesRapidoAnio').val('');
    $('#filtroSinPdf').prop('checked', false);
    getEndosos(1, 0);
  });

  function aplicarMesRapido() {
    const mes = parseInt($('#filtroMesRapido').val(), 10);
    if (!mes) return;
    const anio = parseInt($('#filtroMesRapidoAnio').val(), 10) || new Date().getFullYear();
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    $('#filtroFechaDesde').val(iso(new Date(anio, mes - 1, 1)));
    $('#filtroFechaHasta').val(iso(new Date(anio, mes, 0)));
  }
  $('#filtroMesRapido, #filtroMesRapidoAnio').on('change', aplicarMesRapido);

  function createReceipts(selectPoliza, endoso_id = '') {
    const netPremium = $('#prima-neta').val();
    const totalPremium = $('#prima-total').val();
    const iva = $('#iva').val();
    const insurance = $('#derecho_poliza').val();
    const commission = $('#comision').val();
    const receipts = $('#nopagos').val();
    const rec_pago = $('#rec_pago').val();
    const sendObj = {
      netPremium,
      totalPremium,
      iva,
      insurance,
      commission,
      receipts,
      selectPoliza,
      rec_pago,
    };
    if (endoso_id) sendObj.endoso_id = endoso_id;
    return new Promise((resolve, reject) => {
      $.ajax({
        ...ajaxConfig,
        url: '/polizas/save_receipts',
        data: $.param(sendObj),
        success: function (resp) {
          if (resp.error) {
            console.error('Error crear recibos', resp.msg);
            reject(new Error(resp.msg || 'No se pudieron crear los recibos'));
            return;
          }
          console.log('Recibos creados exitosamente', { endoso_id });
          resolve(resp);
        },
        error: function (xhr, status, error) {
          const message =
            xhr.responseJSON?.msg ||
            error ||
            'No se pudieron crear los recibos';
          console.error('Error crear recibos', message);
          reject(new Error(message));
        },
      });
    });
  }

  function fetchClientOptions(query) {
    $.ajax({
      url: 'polizas/search_clients',
      method: 'POST',
      dataType: 'json',
      data: { query },
      success: function (response) {
        const options = response.options;
        const dropdownMenu = $('#client-options');
        dropdownMenu.empty();
        if (options.length === 0) {
          dropdownMenu.append(
            '<p class="dropdown-item no-results">No hay coincidencias</p>'
          );
        } else {
          $.each(options, function (i, option) {
            dropdownMenu.append(
              `<a class="dropdown-item" id="client__${option.id}">
                ${option.name}
              </a>`
            );
            $(`#client__${option.id}`).on('click', (e) => {
              $('#buscar-cliente').val(option.name);
              $('#selected-client-id').val(option.id);
              $('#client-options').hide();
              $('#buscar-cliente')[0].setCustomValidity('');
            });
          });
        }
        dropdownMenu.show();
      },
      error: function (xhr, textStatus, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  $('#form-polizas').submit(async function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const prima_neta = getCurrencyFieldValue('#prima_neta');
    const old_prima_neta = $('#old_prima_neta').val();
    const prima_total = getCurrencyFieldValue('#prima_total');
    const old_prima_total = $('#old_prima_total').val();
    const fecha_inicio = $('#VigenciaI').val();
    const fecha_termino = $('#VigenciaF').val();
    const tipo_pago_id = $('#Pago').val();
    let params = $.param({
      prima_neta,
      prima_total,
      fecha_inicio,
      fecha_termino,
      tipo_pago_id,
    });
    const endoso_id = $('#endoso_id').val();
    let poliza_id;
    try {
      poliza_id = await resolveParentPolicyId();
    } catch (error) {
      alert(error.message, 'error', 'Póliza requerida');
      return;
    }

    if (!endoso_id || endoso_id === 'New') {
      const tipoResp = await chooseEndosoType();
      if (!tipoResp.isConfirmed || !tipoResp.value) return;
      $('#tipo').val(tipoResp.value);

      if (tipoResp.value === 'A' || tipoResp.value === 'D') {
        if (tipoResp.value === 'D' && (prima_neta > 0 || prima_total > 0)) {
          alert(
            'Este es un endoso de devolución: la prima neta y la prima total deben ser negativas (o cero).',
            'error',
            'Revisa los montos',
          );
          return;
        }
        openReceiptsModalForEndoso(params, poliza_id);
        return;
      }

      let newParams = serializeEndosoFormWithRawCurrencyValues();
      newParams = `${newParams}&poliza_id=${poliza_id}`;
      $.ajax({
        url: '/polizas/create_endoso',
        method: 'POST',
        dataType: 'json',
        data: newParams,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
            return;
          }
          alert(resp.msg, 'success');
          $('#modal-poliza').modal('hide');
          getEndosos();
          resetForm();
        },
        error: function (xhr, textStatus, error) {
          console.error(error);
          alert('Lamentamos el inconveniente, por favor vuelve a intentarlo', 'error');
        },
      });
      return;
    }

    const old_tipo_pago_id = $('#old_tipo_pago_id').val();
    if ($('#tipo').val() !== 'B'
        && (prima_neta !== old_prima_neta || prima_total !== old_prima_total
            || (old_tipo_pago_id && tipo_pago_id !== old_tipo_pago_id))) {
      const resp = await alertConfirm(
        '¿vamos a eliminar los recibos para generarlos nuevamente, estás seguro de continuar?'
      );
      if (!resp.isConfirmed) return;
      $.ajax({
        url: 'polizas/check_delete_receipts',
        method: 'POST',
        dataType: 'json',
        data: `endoso_id=${endoso_id}`,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            // Misma función que arma el modal para un endoso NUEVO A/D --
            // así derecho_poliza y % comisión también quedan precargados
            // (antes esta rama, duplicada, los dejaba vacíos).
            openReceiptsModalForEndoso(params, poliza_id);
          }
        },
        error: function (xhr, textStatus, error) {
          console.error(error);
          alert(
            'Lamentamos el inconveniente, por favor vuelve a intentarlo',
            'error'
          );
        },
      });
    } else {
      let newParams = serializeEndosoFormWithRawCurrencyValues();
      newParams = `${newParams}&endoso_id=${endoso_id}`;
      $.ajax({
        url: '/polizas/edit_endoso',
        method: 'POST',
        dataType: 'json',
        data: newParams,
        success: function (resp) {
          console.log(resp);
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            alert(resp.msg, 'success');
            $('#modal-poliza').modal('hide');
            getEndosos();
            resetForm();
          }
        },
        error: function (xhr, textStatus, error) {
          console.error(error);
          alert(
            'Lamentamos el inconveniente, por favor vuelve a intentarlo',
            'error'
          );
        },
      });
    }
  });

  $('#form-recibo').submit(async function (e) {
    e.preventDefault();
    if (receiptSaveInProgress) return;
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    // Un endoso D es una devolución: si algún monto viene en positivo,
    // el usuario seguramente olvidó el signo -- se bloquea el guardado en
    // vez de crear un cobro donde debía ir un reembolso.
    if ($('#tipo').val() === 'D') {
      const montos = [
        parseFloat($('#prima-neta').val()) || 0,
        parseFloat($('#prima-total').val()) || 0,
      ];
      if (montos.some((m) => m > 0)) {
        alert(
          'Este es un endoso de devolución: la prima neta y la prima total deben ser negativas (o cero).',
          'error',
          'Revisa los montos',
        );
        return;
      }
    }
    receiptSaveInProgress = true;
    $('#btnGuardar-recibos').prop('disabled', true);
    const endoso_id = $('#endoso_id').val();
    const poliza_id = $('#poliza_id').val();
    let newParams = serializeEndosoFormWithRawCurrencyValues();
    if ($('#tipo').val() && (!endoso_id || endoso_id === 'New')) {
      try {
        const resp = await $.ajax({
          url: '/polizas/create_endoso',
          method: 'POST',
          dataType: 'json',
          data: newParams,
        });
        if (resp.error) throw new Error(resp.msg);

        $('#endoso_id').val(resp.endoso_id);
        await createReceipts(poliza_id, resp.endoso_id);
        $('#create-recib').modal('hide');
        $('#receipts_created').val('si');
        alert('Endoso y recibos creados exitosamente', 'success');
        getEndosos();
        await resetForm();
      } catch (error) {
        console.error('Error al guardar endoso y recibos', error);
        alert(
          error.message || 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error',
          'No se completó el guardado'
        );
      } finally {
        receiptSaveInProgress = false;
        $('#btnGuardar-recibos').prop('disabled', false);
      }
      return;
    }

    newParams = `${newParams}&endoso_id=${endoso_id}&regenerar_recibos=1`;
    try {
      const resp = await $.ajax({
        url: '/polizas/edit_endoso',
        method: 'POST',
        dataType: 'json',
        data: newParams,
      });
      if (resp.error) throw new Error(resp.msg);

      await createReceipts(poliza_id, endoso_id);
      $('#create-recib').modal('hide');
      $('#receipts_created').val('si');
      alert('Endoso y recibos actualizados exitosamente', 'success');
      getEndosos();
      await resetForm();
    } catch (error) {
      console.error('Error al actualizar endoso y recibos', error);
      alert(
        error.message || 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
        'error',
        'No se completó el guardado'
      );
    } finally {
      receiptSaveInProgress = false;
      $('#btnGuardar-recibos').prop('disabled', false);
    }
  });

  $('#closeModalCreateRecibos').click(async (e) => {
    e.preventDefault();
    try {
      const resp = await alertConfirm(
        '¿Esta seguro de que desea salir?, no se crearan el endoso y/o recibos'
      );
      if (!resp.isConfirmed) return;
      $('#create-recib').modal('toggle');
    } catch (error) {
      console.log(error);
    }
  });

  $('#btnCalcular').click((e) => {
    e.preventDefault();
    const netPremium = $('#prima-neta').val();
    const totalPremium = $('#prima-total').val();
    const iva = $('#iva').val();
    const insurance = $('#derecho_poliza').val();
    const commission = $('#comision').val();
    const receipts = $('#nopagos').val();
    const rec_pago = $('#rec_pago').val();
    if (!iva || !insurance || !commission)
      return alert(
        'debe llenar los campos, derecho de póliza, iva y comisión',
        'warning'
      );
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/calculate_receipts',
      data: $.param({
        netPremium,
        totalPremium,
        iva,
        insurance,
        commission,
        receipts,
        rec_pago,
      }),
      success: function (resp) {
        $('#prima_neta_1er').val(resp.firstpay.netPremium);
        $('#prima_neta_subs').val(resp.subspay.netPremium);
        $('#prima_total_1er').val(resp.firstpay.totalPremium);
        $('#prima_total_subs').val(resp.subspay.totalPremium);
        $('#comision_1er').val(resp.firstpay.comision);
        $('#comision_subs').val(resp.subspay.comision);
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  let searchEndosoDebounce = null;
  $('#searchEndoso').on('input', function () {
    clearTimeout(searchEndosoDebounce);
    searchEndosoDebounce = setTimeout(() => getEndosos(1, 0), 300);
  });

  $('#buscar-cliente').on('keyup', function (e) {
    e.preventDefault();
    const inputValue = e.target.value;
    if (inputValue.length >= 3) {
      fetchClientOptions(inputValue);
    } else {
      $('#client-options').hide();
      $('#buscar-cliente')[0].setCustomValidity('');
    }
  });

  $('#btnCrearEndoso').click(async (e) => {
    e.preventDefault();
    await resetForm();
    abrirModalEndoso('Crear endoso');
  });

  $('#reset-btn').click(async (e) => {
    e.preventDefault();
    await resetForm();
    $('#modal-poliza').modal('hide');
  });

  // Al elegir "Nuevo ..." en un catálogo se muestra el campo para
  // escribir el nombre (igual que en pólizas). Antes esos campos no
  // existían en el formulario de endosos.
  $('#ramo, #subramo').on('change', function () {
    if (this.value === 'New') $('#nuevo_ramo_subramo_div').show();
  });
  $('#aseguradora').on('change', function () {
    if (this.value === 'New') $('#nuevo_aseguradora_div').show();
  });
  $('#vendedor').on('change', function () {
    if (this.value === 'New') $('#nuevo_vendedor_div').show();
  });
  $('#agente').on('change', function () {
    if (this.value === 'New') $('#nuevo_agente_div').show();
  });

  bindCurrencyFormatting('#prima_neta');
  bindCurrencyFormatting('#prima_total');

  getEndosos();
  resetForm();
});
