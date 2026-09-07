$(function () {
  let razonInput = '';
  let totalPolizas = 0;
  let pdfMode = null; // 'renew', 'endoso', or null
  let receiptSaveRequested = false;

  // Cantidad de filas por página de la tabla de pólizas. Ya no es un
  // número fijo: se recalcula según cuántas filas caben realmente en el
  // espacio disponible, para que la tabla se llene por completo en vez
  // de dejar espacio en blanco abajo.
  let polizasItemsOnPage = 10;
  // Se resetea a 0 en cada carga "real" (inicial, cambio de página,
  // búsqueda, resize) y se incrementa cada vez que se hace un re-fetch
  // automático para ajustar itemsOnPage. Un límite (no un booleano de un
  // solo intento) porque la primera medición puede salir imprecisa —por
  // ejemplo si las fuentes web todavía no terminaban de cargar y la
  // altura real de fila cambia un poco después—, así que se permiten
  // unos cuantos reintentos para converger, sin arriesgar un ciclo
  // infinito.
  let polizasAutoAdjustAttempts = 0;
  const POLIZAS_MAX_AUTO_ADJUST_ATTEMPTS = 3;

  // Menú de acciones ("3 puntos") de la tabla de pólizas: al abrirse se
  // saca del flujo normal y se pega al <body> con position:fixed, para
  // que nunca lo recorte el contenedor con scroll de la tabla
  // (.table-polizas__scroll), sin importar en qué fila esté ni el nivel
  // de zoom. Se calcula la posición a partir del botón que lo abrió y se
  // ajusta si se saldría de la pantalla. Delegado sobre document porque
  // las filas de la tabla se reconstruyen en cada render.
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
      // El menú fue reubicado a <body> al abrirse, así que ya no es hijo
      // del wrapper: se busca en <body> por el dato que guarda de dónde
      // vino, y se regresa a su lugar original.
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

  // Si se hace scroll dentro de la tabla mientras el menú está abierto, se
  // cierra (el botón se movería mientras el menú, ya flotante, se
  // quedaría fijo — mejor cerrarlo que dejarlo desalineado).
  $(document).on('scroll', '.table-polizas__scroll', function () {
    $('#polizas-table .acciones-toggle[aria-expanded="true"]').dropdown('hide');
  });

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

  // Click para abrir selector de archivos
  dropZone.on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    fileInput.trigger('click');
  });

  // Prevenir que el click del input se propague
  fileInput.on('click', function (e) {
    e.stopPropagation();
  });

  // Prevenir comportamiento por defecto en drag
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

  // Manejar drop
  dropZone.on('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.removeClass('drag-over');

    const files = e.originalEvent.dataTransfer.files;
    if (files.length > 0) {
      fileInput[0].files = files;
      uploadPDF();
    }
  });

  // Auto-upload al seleccionar archivo
  fileInput.on('change', function (e) {
    e.stopPropagation();
    if (this.files.length > 0) {
      uploadPDF();
    }
  });

  function uploadPDF() {
    const file = fileInput[0].files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se permiten archivos PDF', 'warning', 'Archivo inválido');
      fileInput.val('');
      return;
    }

    uploadContent.hide();
    uploadLoading.show();

    Swal.fire({
      title: 'Procesando PDF...',
      text: 'Extrayendo información con IA',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    const formData = new FormData();
    formData.append('pdf_file', file);
    if (pdfMode) {
      formData.append('pdf_mode', pdfMode);
    }

    const polizaIdInput = document.getElementById('poliza_id');
    if (polizaIdInput) {
      const polizaId = polizaIdInput.value;
      if (polizaId && polizaId !== 'New') {
        formData.append('poliza_id', polizaId);
      }
    }

    $.ajax({
      type: 'POST',
      url: '/polizas/upload_pdf',
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        Swal.close();
        uploadLoading.hide();
        uploadContent.show();
        fileInput.val('');

        console.log('Respuesta completa:', response);

        if (response.error) {
          alert(response.msg, 'error', 'Error');
        } else {
          if (response.pdf_path) {
            $('#pdf_path').val(response.pdf_path);
            console.log('PDF path guardado (drag&drop):', response.pdf_path);
          }
          if (response.data) {
            fillFormWithPdfData(response.data);
            alert('Datos extraídos correctamente', 'success', 'Éxito');
          } else {
            console.error('No se encontró poliza_data en la respuesta');
            alert(
              'Error: datos no encontrados en la respuesta',
              'error',
              'Error',
            );
          }
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

  $('#btn_upload_pdf').on('click', function () {
    const fileInput = $('#pdf_file')[0];
    if (!fileInput.files.length) {
      alert('Selecciona un archivo PDF', 'warning', 'Sin archivo');
      return;
    }

    const formData = new FormData();
    formData.append('pdf_file', fileInput.files[0]);
    if (pdfMode) {
      formData.append('pdf_mode', pdfMode);
    }

    const polizaIdInput = document.getElementById('poliza_id');
    if (polizaIdInput) {
      const polizaId = polizaIdInput.value;
      if (polizaId && polizaId !== 'New') {
        formData.append('poliza_id', polizaId);
      }
    }

    Swal.fire({
      title: 'Procesando PDF...',
      text: 'Extrayendo información con IA',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    $.ajax({
      type: 'POST',
      url: '/polizas/upload_pdf',
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        Swal.close();
        if (response.error) {
          alert(response.msg, 'error', 'Error');
          pdfMode = null;
        } else {
          console.log(response);
          // Guardar pdf_path en campo oculto
          if (response.pdf_path) {
            $('#pdf_path').val(response.pdf_path);
            console.log('PDF path guardado:', response.pdf_path);
          }

          fillFormWithPdfData(response.data);
          alert('Datos extraídos correctamente', 'success', 'Éxito');

          // Resetear modo después de usar
          pdfMode = null;
        }
      },
      error: function () {
        Swal.close();
        alert('Error al procesar el PDF', 'error', 'Error');
        pdfMode = null;
      },
    });
  });

  function fillFormWithPdfData(data) {
    const isRenewMode = pdfMode === 'renew';
    const isEndosoMode = pdfMode === 'endoso' || String($('#title_poliza').text() || '').includes('Endoso');
    const previousPolicyValue = $('#polizaAnterior').val();
    const previousPolicyDisplayValue = $('#poliza-anterior').val();

    function normalizeFormaPagoToken(value) {
      if (!value) return '';
      return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    }

    function resolveFormaPagoSelect(data, source = 'unknown') {
      if (!data || (!data.forma_de_pago && !data.tipo_pago_id)) {
        console.log('[FORMA_PAGO] Sin datos para resolver', { source, data });
        return false;
      }

      const pagoSelect = $('#Pago');
      const optionTexts = pagoSelect
        .find('option')
        .map(function () {
          return {
            value: $(this).val(),
            text: $(this).text().trim(),
          };
        })
        .get();

      console.log('[FORMA_PAGO] Intentando resolver', {
        source,
        forma_de_pago: data.forma_de_pago,
        tipo_pago_id: data.tipo_pago_id,
        optionCount: optionTexts.length,
        options: optionTexts,
      });

      if (data.tipo_pago_id) {
        const tipoPagoId = String(data.tipo_pago_id);
        const optionExists =
          pagoSelect.find(`option[value="${tipoPagoId}"]`).length > 0;
        if (optionExists) {
          pagoSelect.val(tipoPagoId).trigger('change');
          console.log('[FORMA_PAGO] Match por tipo_pago_id', {
            source,
            tipo_pago_id: tipoPagoId,
          });
          return true;
        }

        console.warn('[FORMA_PAGO] tipo_pago_id no existe en el select', {
          source,
          tipo_pago_id: tipoPagoId,
        });
      }

      if (!data.forma_de_pago) {
        console.warn('[FORMA_PAGO] No hay texto de forma_de_pago para buscar', {
          source,
          tipo_pago_id: data.tipo_pago_id,
        });
        return false;
      }

      const formaPagoNorm = normalizeFormaPagoToken(data.forma_de_pago);
      let matched = false;

      pagoSelect.find('option').each(function () {
        const optionText = normalizeFormaPagoToken($(this).text());
        if (
          optionText.includes(formaPagoNorm) ||
          formaPagoNorm.includes(optionText.replace(/[^A-Z]/g, ''))
        ) {
          pagoSelect.val($(this).val()).trigger('change');
          matched = true;
          console.log('[FORMA_PAGO] Match directo por texto', {
            source,
            formaPagoNorm,
            matchedOption: {
              value: $(this).val(),
              text: $(this).text().trim(),
            },
          });
          return false;
        }
      });

      if (!matched) {
        const pagoMap = {
          MENSUAL: 'MENSUAL',
          TRIMESTRAL: 'TRIMESTRAL',
          SEMESTRAL: 'SEMESTRAL',
          ANUAL: 'ANUAL',
          MULTIANUAL: 'MULTIANUAL',
          CONTADO: 'CONTADO',
          UNICO: 'CONTADO',
          UNICOANUAL: 'ANUAL',
          FRACCIONADO: 'MENSUAL',
        };

        for (const [key, val] of Object.entries(pagoMap)) {
          if (formaPagoNorm.includes(key)) {
            pagoSelect.find('option').each(function () {
              const optionText = normalizeFormaPagoToken($(this).text());
              if (optionText.includes(val)) {
                pagoSelect.val($(this).val()).trigger('change');
                matched = true;
                console.log('[FORMA_PAGO] Match por mapa de equivalencias', {
                  source,
                  formaPagoNorm,
                  mapKey: key,
                  mapValue: val,
                  matchedOption: {
                    value: $(this).val(),
                    text: $(this).text().trim(),
                  },
                });
                return false;
              }
            });
            if (matched) break;
          }
        }
      }

      if (!matched) {
        console.warn('[FORMA_PAGO] No se encontró coincidencia en el select', {
          source,
          forma_de_pago: data.forma_de_pago,
          tipo_pago_id: data.tipo_pago_id,
          optionCount: optionTexts.length,
          options: optionTexts,
        });
      }

      return matched;
    }

    function mergeVehicleObservations(currentNotes, vehicleObservations) {
      const current = String(currentNotes || '').trim();
      const vehicleBlock = String(vehicleObservations || '').trim();
      if (!vehicleBlock) return current;

      const vehicleBlockPattern =
        /(?:^|\n)Datos del veh[ií]culo[\s\S]*?(?=\n\n(?!Datos del veh[ií]culo)|$)/gi;
      const withoutPreviousVehicleBlock = current
        .replace(vehicleBlockPattern, '')
        .trim();

      return withoutPreviousVehicleBlock
        ? `${withoutPreviousVehicleBlock}\n${vehicleBlock}`
        : vehicleBlock;
    }

    if (!data) {
      console.error('No se recibieron datos para llenar el formulario');
      return;
    }

    console.log('Datos extraídos del PDF:', data);
    console.log('Llenando formulario...');

    // Póliza
    if (data.numero_de_poliza) {
      console.log('Poliza:', data.numero_de_poliza);
      $('#Poliza').val(data.numero_de_poliza);
    }
    if (isRenewMode) {
      $('#polizaAnterior').val(previousPolicyValue);
      $('#poliza-anterior')
        .val(previousPolicyDisplayValue || previousPolicyValue)
        .prop('disabled', true);
    }

    // Cliente
    if (data.nombre_cliente) {
      console.log('Cliente:', data.nombre_cliente);
      $('#buscar-cliente').val(data.nombre_cliente);
    }
    if (data.cliente_id) {
      console.log('Cliente ID:', data.cliente_id);
      $('#selected-client-id').val(data.cliente_id);
    } else {
      $('#selected-client-id').val('None');
    }

    // Primas
    if (data.prima_neta) {
      const primaNeta = parseFloat(String(data.prima_neta).replace(/[^0-9.-]/g, ''));
      console.log('Prima Neta:', primaNeta);
      if (!isNaN(primaNeta)) setCurrencyFieldValue('#prima_neta', primaNeta);
    }
    if (data.prima_total) {
      const primaTotal = parseFloat(String(data.prima_total).replace(/[^0-9.-]/g, ''));
      console.log('Prima Total:', primaTotal);
      if (!isNaN(primaTotal)) setCurrencyFieldValue('#prima_total', primaTotal);
    }

    // Moneda
    if (data.moneda) {
      const monedaMap = {
        MXN: 'MXN',
        PESOS: 'MXN',
        NACIONAL: 'MXN',
        PESO: 'MXN',
        USD: 'USD',
        DOLARES: 'USD',
        DÓLARES: 'USD',
        DOLAR: 'USD',
        UDIS: 'Udis',
        UDI: 'Udis',
      };
      const monedaNorm = data.moneda.toUpperCase();
      const monedaVal = monedaMap[monedaNorm] || 'MXN';
      console.log('Moneda:', monedaVal);
      $('#Moneda').val(monedaVal);
    }

    // Fechas
    if (data.desde) {
      const fechaInicio = formatDateFromPdf(data.desde);
      console.log('Fecha Inicio:', fechaInicio);
      if (fechaInicio) $('#VigenciaI').val(fechaInicio);
    }
    if (data.hasta) {
      const fechaFin = formatDateFromPdf(data.hasta);
      console.log('Fecha Fin:', fechaFin);
      if (fechaFin) $('#VigenciaF').val(fechaFin);
    }

    // Endoso
    if (data.endoso) {
      console.log('Endoso:', data.endoso);
      if (isEndosoMode) {
        $('#Poliza').val(data.endoso);
      } else {
        $('#renovacion').val(data.endoso);
      }
    }

    // Descripción/Notas
    const normalizePdfToken = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    const shouldPopulateVehicleFields = ['AUTOMOVIL', 'AUTO', 'AUTOS'].includes(
      normalizePdfToken(data.ramo),
    );
    const shouldAppendDescripcionSeparately =
      shouldPopulateVehicleFields &&
      data.descripcion &&
      !data.observaciones;
    if (shouldAppendDescripcionSeparately) {
      console.log('Descripción:', data.descripcion);
      const notasActuales = $('#notas').val();
      $('#notas').val(
        notasActuales
          ? notasActuales + '\n' + data.descripcion
          : data.descripcion,
      );
    }

    // Serie del vehículo (número de serie/VIN)
    if (shouldPopulateVehicleFields && data.serie) {
      console.log('Serie del vehículo:', data.serie);
      $('#serie').val(data.serie);
    } else if (!shouldPopulateVehicleFields) {
      $('#serie').val('');
    }

    // Observaciones del vehículo, priorizando el bloque completo generado para autos
    if (shouldPopulateVehicleFields && data.observaciones) {
      console.log('Observaciones del vehículo:', data.observaciones);
      const notasActuales = $('#notas').val();
      $('#notas').val(mergeVehicleObservations(notasActuales, data.observaciones));
    }

    resolveFormaPagoSelect(data, 'fillFormWithPdfData_initial');

    // Derecho de póliza (también puede ser "gastos de expedición")
    if (data.derecho_poliza) {
      const derechoPoliza = parseFloat(
        String(data.derecho_poliza).replace(/[^0-9.-]/g, ''),
      );
      console.log('Derecho de Póliza:', derechoPoliza);
      if (!isNaN(derechoPoliza)) {
        $('#derecho_poliza').val(derechoPoliza.toFixed(2));
      }
    }

    // Aseguradora - esperar a que estén cargados los selects y usar ID
    function fillSelectWithData() {
      const ramoSelect = $('#ramo');
      const subramoSelect = $('#subramo');
      const aseguradoraSelect = $('#aseguradora');
      const vendedorSelect = $('#vendedor');
      const agenteSelect = $('#agente');

      // Verificar si los selects están vacíos (no cargados)
      const selectsEmpty =
        ramoSelect.children('option').length <= 1 &&
        aseguradoraSelect.children('option').length <= 1;

      if (selectsEmpty) {
        console.log('Selects vacíos, cargando datos del formulario...');
        getFormData()
          .then((formData) => {
            if (formData) {
              // Poblar selects si están vacíos
              if (ramoSelect.children('option').length <= 1) {
                for (const ramo of formData.Ramo) {
                  $('#ramo').append(
                    `<option value='${ramo.id}'>${ramo.ramo}</option>`,
                  );
                }
                $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
              }
              if (subramoSelect.children('option').length <= 1) {
                for (const subramo of formData.Subramo) {
                  $('#subramo').append(
                    `<option value='${subramo.id}'>${subramo.subramo}</option>`,
                  );
                }
                $('#subramo').append(
                  `<option value="New">Nuevo Subramo</option>`,
                );
              }
              if (aseguradoraSelect.children('option').length <= 1) {
                for (const aseguradora of formData.Aseguradora) {
                  $('#aseguradora').append(
                    `<option value='${aseguradora.id}'>${aseguradora.aseguradora}</option>`,
                  );
                }
                $('#aseguradora').append(
                  `<option value="New">Nueva Aseguradora</option>`,
                );
              }
              if (vendedorSelect.children('option').length <= 1) {
                for (const vendedor of formData.Vendedor) {
                  $('#vendedor').append(
                    `<option value='${vendedor.id}'>${vendedor.nombre}</option>`,
                  );
                }
                $('#vendedor').append(
                  `<option value="New">Nuevo Vendedor</option>`,
                );
              }
              if (agenteSelect.children('option').length <= 1) {
                for (const agente of formData.Agente) {
                  $('#agente').append(
                    `<option value='${agente.id}'>${agente.nombre}</option>`,
                  );
                }
                $('#agente').append(
                  `<option value="New">Nuevo Agente</option>`,
                );
              }

              // Poblar select de forma de pago también si está vacío
              const pagoSelect = $('#Pago');
              if (pagoSelect.children('option').length <= 1) {
                for (const pago of formData.TipoPago) {
                  $('#Pago').append(
                    `<option value='${pago.id}'>${pago.tipo_pago}</option>`,
                  );
                }
              }

              // Ahora llenar los valores
              setValuesInSelects(data);
            }
          })
          .catch((err) => {
            console.error('Error al cargar datos del formulario:', err);
          });
      } else {
        // Los selects ya están poblados, llenar valores directamente
        setValuesInSelects(data);
      }
    }

    // Función para establecer valores en los selects
    function setValuesInSelects(data) {
      // Aseguradora: el nombre detectado en el PDF tiene prioridad sobre un ID
      // inconsistente. Esto evita que una póliza Chubb termine seleccionando AXA.
      if (data.aseguradora || data.aseguradora_id) {
        const aseguradoraSelect = $('#aseguradora');
        aseguradoraSelect.val('');
        const normalizeCatalogName = (value) =>
          String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
        const aseguradoraNombre = normalizeCatalogName(data.aseguradora);
        const optionByName = aseguradoraSelect
          .find('option')
          .filter(function () {
            return normalizeCatalogName($(this).text()) === aseguradoraNombre;
          })
          .first();

        if (aseguradoraNombre && optionByName.length) {
          console.log('Aseguradora por nombre:', data.aseguradora);
          aseguradoraSelect.val(optionByName.val());
        } else if (!aseguradoraNombre && data.aseguradora_id) {
          const aseguradoraId = String(data.aseguradora_id);
          const optionById = aseguradoraSelect.find(
            `option[value="${aseguradoraId}"]`,
          );
          if (optionById.length) {
            console.log('Aseguradora por ID:', data.aseguradora_id);
            aseguradoraSelect.val(aseguradoraId);
          }
        }

        if (!aseguradoraSelect.val() && data.aseguradora) {
          console.log(
            'Aseguradora no encontrada en select, creando nueva:',
            data.aseguradora,
          );
          $('#nuevo_aseguradora').val(data.aseguradora);
          aseguradoraSelect.val('New');
          $('#nuevo_aseguradora_div').show();
        }
      }

      // Ramo - usar ID si está disponible
      if (data.ramo_id) {
        console.log('Ramo ID:', data.ramo_id);
        const ramoId = String(data.ramo_id);
        const ramoSelect = $('#ramo');
        const optionExists =
          ramoSelect.find(`option[value="${ramoId}"]`).length > 0;
        if (optionExists) {
          ramoSelect.val(ramoId).trigger('change');
        } else {
          console.log(
            'Ramo no encontrado en select, creando nuevo:',
            data.ramo,
          );
          $('#nuevo_ramo').val(data.ramo);
          ramoSelect.val('New');
          $('#nuevo_ramo_div').show();
        }
      }

      // Subramo - usar ID si está disponible
      if (data.subramo_id) {
        console.log('Subramo ID:', data.subramo_id);
        const subramoId = String(data.subramo_id);
        const subramoSelect = $('#subramo');
        const optionExists =
          subramoSelect.find(`option[value="${subramoId}"]`).length > 0;
        if (optionExists) {
          subramoSelect.val(subramoId);
        } else {
          console.log(
            'Subramo no encontrado en select, creando nuevo:',
            data.subramo,
          );
          $('#nuevo_subramo').val(data.subramo);
          subramoSelect.val('New');
          $('#nuevo_subramo_div').show();
        }
      }

      // Vendedor - usar ID si está disponible
      if (data.vendedor_id) {
        console.log('Vendedor ID:', data.vendedor_id);
        const vendedorId = String(data.vendedor_id);
        const vendedorSelect = $('#vendedor');
        const optionExists =
          vendedorSelect.find(`option[value="${vendedorId}"]`).length > 0;
        if (optionExists) {
          vendedorSelect.val(vendedorId);
        } else {
          console.log(
            'Vendedor no encontrado en select, creando nuevo:',
            data.vendedor,
          );
          $('#nuevo_vendedor').val(data.vendedor);
          vendedorSelect.val('New');
          $('#nuevo_vendedor_div').show();
        }
      }

      // Agente - usar ID si está disponible
      if (data.agente_id) {
        console.log('Agente ID:', data.agente_id);
        const agenteId = String(data.agente_id);
        const agenteSelect = $('#agente');
        const optionExists =
          agenteSelect.find(`option[value="${agenteId}"]`).length > 0;
        if (optionExists) {
          agenteSelect.val(agenteId);
        } else {
          console.log(
            'Agente no encontrado en select, creando nuevo:',
            data.agente,
          );
          $('#nuevo_agente').val(data.agente);
          agenteSelect.val('New');
          $('#nuevo_agente_div').show();
        }
      }

      resolveFormaPagoSelect(data, 'setValuesInSelects');

      console.log('Formulario llenado completamente');

      // Calcular recibos automáticamente con 10% de comisión
      setTimeout(() => {
        const primaNeta = parseFloat(getCurrencyFieldValue('#prima_neta')) || 0;
        const primaTotal = parseFloat(getCurrencyFieldValue('#prima_total')) || 0;
        const derechoPoliza = parseFloat($('#derecho_poliza').val()) || 0;
        const fechaInicio = $('#VigenciaI').val();
        const fechaTermino = $('#VigenciaF').val();
        const tipoPagoId = $('#Pago').val();

        if (primaNeta > 0 && primaTotal > 0) {
          // Establecer 10% de comisión por defecto
          $('#comision').val('10');

          // Establecer IVA por defecto (16%)
          if (!$('#iva').val()) {
            $('#iva').val('16');
          }

          // Llamar a calculate_receipts
          const netPremium = primaNeta;
          const totalPremium = primaTotal;
          const iva = parseFloat($('#iva').val()) || 16;
          const insurance = derechoPoliza;
          const commission = 10;
          const rec_pago = $('#rec_pago').val() || 'primer_recibo';

          const runReceiptCalculation = (
            receipts = $('#nopagos').val() || 1,
            calculatedNetPremium = netPremium,
            calculatedTotalPremium = totalPremium,
          ) => {
            $.ajax({
              ...ajaxConfig,
              url: '/polizas/calculate_receipts',
              data: $.param({
                netPremium: calculatedNetPremium,
                totalPremium: calculatedTotalPremium,
                iva,
                insurance,
                commission,
                receipts,
                rec_pago,
              }),
              success: function (resp) {
                $('#prima-neta').val(calculatedNetPremium);
                $('#prima-total').val(calculatedTotalPremium);
                $('#nopagos').val(receipts);
                $('#prima_neta_1er').val(resp.firstpay.netPremium);
                $('#prima_neta_subs').val(resp.subspay.netPremium);
                $('#prima_total_1er').val(resp.firstpay.totalPremium);
                $('#prima_total_subs').val(resp.subspay.totalPremium);
                $('#comision_1er').val(resp.firstpay.comision);
                $('#comision_subs').val(resp.subspay.comision);
                $('#recibos').val('Por generar');
                console.log('Recibos calculados automáticamente', {
                  receipts,
                  insurance,
                });

              },
              error: (xhr, status, error) =>
                console.error('Error al calcular recibos:', error),
            });
          };

          if (fechaInicio && fechaTermino && tipoPagoId) {
            $.ajax({
              url: 'polizas/get_policy_values',
              method: 'POST',
              dataType: 'json',
              data: $.param({
                prima_neta: netPremium,
                prima_total: totalPremium,
                fecha_inicio: fechaInicio,
                fecha_termino: fechaTermino,
                tipo_pago_id: tipoPagoId,
              }),
              success: function (resp) {
                if (resp && !resp.error) {
                  $('#nopagos').val(resp.numReceipts || 1);
                  $('#iva').val(16);
                  runReceiptCalculation(
                    resp.numReceipts || 1,
                    resp.netPremium || netPremium,
                    resp.totalPremium || totalPremium,
                  );
                } else {
                  runReceiptCalculation();
                }
              },
              error: function () {
                runReceiptCalculation();
              },
            });
          } else {
            runReceiptCalculation();
          }
        }
      }, 1000);
    }

    // Iniciar el proceso de llenado
    fillSelectWithData();
  }

  function formatDateFromPdf(dateStr) {
    if (!dateStr) return '';

    // Mapa de meses en español
    const meses = {
      ENE: '01',
      FEB: '02',
      MAR: '03',
      ABR: '04',
      MAY: '05',
      JUN: '06',
      JUL: '07',
      AGO: '08',
      SEP: '09',
      OCT: '10',
      NOV: '11',
      DIC: '12',
    };

    // Formato: 01/NOV/2025
    const monthNameMatch = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4})/);
    if (monthNameMatch) {
      const dia = monthNameMatch[1];
      const mes = meses[monthNameMatch[2].toUpperCase()] || '01';
      const anio = monthNameMatch[3];
      return `${anio}-${mes}-${dia}`;
    }

    const patterns = [
      {
        regex: /(\d{2})\/(\d{2})\/(\d{4})/,
        format: (m) => `${m[3]}-${m[2]}-${m[1]}`,
      },
      {
        regex: /(\d{4})-(\d{2})-(\d{2})/,
        format: (m) => `${m[1]}-${m[2]}-${m[3]}`,
      },
      {
        regex: /(\d{2})-(\d{2})-(\d{4})/,
        format: (m) => `${m[3]}-${m[2]}-${m[1]}`,
      },
    ];

    for (let { regex, format } of patterns) {
      const match = dateStr.match(regex);
      if (match) return format(match);
    }

    return '';
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

  function formatNumber(num, options = {}) {
    const { separator = ',', decimalPoint = '.', groupSize = 3 } = options;
    const parts = num.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : '';
    let result = '';
    for (let i = 0; i < integerPart.length; i++) {
      if (i > 0 && (integerPart.length - i) % groupSize === 0) {
        result += separator;
      }
      result += integerPart[i];
    }
    if (decimalPart) {
      result += decimalPoint + decimalPart;
    }
    return result;
  }

  function parseCurrencyInputValue(value) {
    if (value === null || value === undefined) return '';
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if (!cleaned) return '';
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? '' : parsed.toFixed(2);
  }

  function displayCellValue(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === 'null' || stringValue.toLowerCase() === 'undefined') {
      return '';
    }
    return stringValue;
  }

  function formatCurrencyDisplay(value) {
    const normalized = parseCurrencyInputValue(value);
    if (!normalized) return '';
    return `$${formatNumber(normalized)}`;
  }

  function formatReceiptAmount(value) {
    const normalized = parseCurrencyInputValue(value);
    if (!normalized) return '0.00';
    return formatNumber(normalized);
  }

  function setCurrencyFieldValue(selector, value) {
    $(selector).val(formatCurrencyDisplay(value));
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

  function serializePolizaFormWithRawCurrencyValues() {
    const primaNetaField = $('#prima_neta');
    const primaTotalField = $('#prima_total');
    const originalPrimaNeta = primaNetaField.val();
    const originalPrimaTotal = primaTotalField.val();

    primaNetaField.val(getCurrencyFieldValue('#prima_neta'));
    primaTotalField.val(getCurrencyFieldValue('#prima_total'));

    let serialized = $('#form-polizas').serialize();
    if (String($('#title_poliza').text() || '').includes('Endoso')) {
      serialized = `${serialized}&endoso=${encodeURIComponent($('#Poliza').val() || '')}`;
    }

    primaNetaField.val(originalPrimaNeta);
    primaTotalField.val(originalPrimaTotal);

    return serialized;
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
            `Por favor ingrese una razon para cancelar`,
          );
        }
        return { razon };
      },
    });
  }

  async function resetForm() {
    try {
      pdfMode = null;

      $('#form-polizas')[0].reset();
      $('#btnGuardar').show();
      $('#reset-btn').show();
      $('#form-polizas').removeClass('was-validated');
      $('#form-polizas select').prop('disabled', false);
      $('#form-polizas input').prop('disabled', false);
      $('#form-polizas textarea').prop('disabled', false);
      $('#poliza_id').val('New');
      $('#tipo').val('');
      $('#pdf_path').val('');
      $('#recibos').val('Por generar');
      $('#selected-client-id').val('None');
      $('#recibo_id').val('');
      $('#id_poliza').val('');
      $('#polizaAnterior').val('');
      $('#poliza-anterior').val('').prop('disabled', false);
      $('#old_prima_neta').val('');
      $('#old_prima_total').val('');
      $('#old_tipo_pago').val('');
      $('#buscar-cliente').val('');
      $('#client-options').hide().empty();
      $('#pdf_file').val('');
      $('#upload_loading, .upload-loading').hide();
      $('#upload_content, .upload-content').show();
      $('#div_poliza_id').hide();
      $('#div_search_client').show();
      $('#title_poliza').text('Póliza');
      $('#title_poliza_anterior').text('Póliza anterior');
      $('#prima_neta').prop('disabled', false);
      $('#prima_total').prop('disabled', false);
      $('#ramo').html('');
      $('#subramo').html('');
      $('#aseguradora').html('');
      $('#Pago').html('');
      $('#vendedor').html('');
      $('#agente').html('');
      $('#btnGuardar').html('Guardar');
      $('#div_poliza_anterior').hide();
      $('#nuevo_ramo_subramo_div').hide();
      $('#nuevo_aseguradora_div').hide();
      $('#nuevo_vendedor_div').hide();
      $('#nuevo_agente_div').hide();
      $('#only_show_poliza').hide();
      $('#nuevo_ramo_div').hide();
      $('#nuevo_subramo_div').hide();
      $('#create-recib').modal('hide');
      $('#endoso-type').modal('hide');
      $('#alert_Modal').hide();
      const data = await getFormData();

      $('#ramo').append(`<option value=''>Selecciona...</option>`);
      for (const ramo of data.Ramo) {
        $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
      }
      $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);

      $('#subramo').append(`<option value=''>Selecciona...</option>`);
      for (const subramo of data.Subramo) {
        $('#subramo').append(`<option value='${subramo.id}'>
          ${subramo.subramo}
          </option>
          `);
      }
      $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);

      $('#aseguradora').append(`<option value=''>Selecciona...</option>`);
      for (const aseguradora of data.Aseguradora) {
        $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
      }
      $('#aseguradora').append(
        `<option value="New">Nueva Aseguradora</option>`,
      );

      $('#Pago').append(`<option value=''>Selecciona...</option>`);
      for (const pago of data.TipoPago) {
        $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
      }

      $('#vendedor').append(`<option value=''>Selecciona...</option>`);
      for (const vendedor of data.Vendedor) {
        $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
      }
      $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);

      $('#agente').append(`<option value=''>Selecciona...</option>`);
      for (const agente of data.Agente) {
        $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
      }
      $('#agente').append(`<option value="New">Nuevo Agente</option>`);

      $('#ramo').val('');
      $('#subramo').val('');
      $('#aseguradora').val('');
      $('#Pago').val('');
      $('#vendedor').val('');
      $('#agente').val('');
      $('#Moneda').val('');

      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async function createEndozo(poliza_id, tipo) {
    pdfMode = 'endoso';
    const data = await resetForm();
    $('#endoso-type').modal('hide');
    $('#modal-poliza').modal('show');
    $('#tipo').val(tipo);
    $('#btnGuardar').html('Generar endoso');
    $('#poliza_id').val(poliza_id);
    // $('#div_search_client').hide();
    $('#title_poliza').text('Endoso');
    $('#div_poliza_id').show();
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        $('#id_poliza').val(resp.data[0].poliza);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        setCurrencyFieldValue(
          '#prima_neta',
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(/,/g, '')),
        );
        setCurrencyFieldValue(
          '#prima_total',
          parseFloat(
            resp.data[0].prima_total.replace('$', '').replace(/,/g, ''),
          ),
        );
        const modificaPrima = tipo === 'A' || tipo === 'D';
        $('#prima_neta').prop('disabled', !modificaPrima);
        $('#prima_total').prop('disabled', !modificaPrima);
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
            `<option value="New">Nueva Aseguradora</option>`,
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

  async function showPoliza(poliza_id) {
    const data = await resetForm();
    $('#modal-poliza').modal('show');
    $('#btnGuardar').hide();
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        if (!resp.data || !resp.data[0]) return;
        $('#only_show_poliza').show();
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#Poliza').val(resp.data[0].poliza);
        $('#poliza_anterior').val(resp.data[0].poliza_anterior);
        $('#renovacion').val(resp.data[0].renovacion);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        setCurrencyFieldValue(
          '#prima_neta',
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(/,/g, '')),
        );
        setCurrencyFieldValue(
          '#prima_total',
          parseFloat(
            resp.data[0].prima_total.replace('$', '').replace(/,/g, ''),
          ),
        );
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
            `<option value="New">Nueva Aseguradora</option>`,
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

        // "Ver póliza" es solo de lectura: se deshabilitan TODOS los
        // campos del formulario, no solo prima_neta/prima_total como
        // antes (dejaba el resto editable por error).
        $('#form-polizas input').prop('disabled', true);
        $('#form-polizas select').prop('disabled', true);
        $('#form-polizas textarea').prop('disabled', true);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function editPoliza(poliza_id) {
    const data = await resetForm();
    $('#modal-poliza').modal('show');
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        if (!resp.data || !resp.data[0]) return;
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#Poliza').val(resp.data[0].poliza);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#prima_neta').prop('disabled', false);
        $('#prima_total').prop('disabled', false);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        setCurrencyFieldValue(
          '#prima_neta',
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(/,/g, '')),
        );
        setCurrencyFieldValue(
          '#prima_total',
          parseFloat(
            resp.data[0].prima_total.replace('$', '').replace(/,/g, ''),
          ),
        );
        $('#old_prima_neta').val(
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(/,/g, '')),
        );
        $('#old_prima_total').val(
          parseFloat(
            resp.data[0].prima_total.replace('$', '').replace(/,/g, ''),
          ),
        );
        $('#old_tipo_pago').val(resp.data[0].tipo_pago_id);
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
            `<option value="New">Nueva Aseguradora</option>`,
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

  async function renewPoliza(poliza_id) {
    // Verificación temprana: antes de abrir el formulario, checamos si
    // esta póliza ya fue renovada — así el usuario no pierde tiempo
    // llenando todo para enterarse hasta el final.
    try {
      const check = await $.ajax({
        ...ajaxConfig,
        url: '/polizas/check_renovada',
        data: { poliza_id },
      });
      if (check.error) {
        alert(check.msg, 'error');
        return;
      }
      if (check.yaRenovada) {
        alert(
          `Esta póliza ya fue renovada con el número de póliza ${check.renovacion}`,
          'error',
        );
        return;
      }
    } catch (err) {
      console.error('Error al verificar si la póliza ya fue renovada', err);
      // Si la verificación temprana falla por algún motivo de red, no
      // bloqueamos al usuario — la validación real y definitiva sigue
      // ocurriendo en el servidor al guardar.
    }

    pdfMode = 'renew';
    const data = await resetForm();
    $('#modal-poliza').modal('show');
    $('#btnGuardar').html('Renovar póliza');
    $('#div_poliza_anterior').show();
    $('#title_poliza').text('Renovacion');
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        const year =
          new Date(`${resp.data[0].fecha_termino}`).getFullYear() + 1;
        const month = new Date(`${resp.data[0].fecha_termino}`).getMonth() + 1;
        const dia = new Date(
          `${resp.data[0].fecha_termino} 23:00:00`,
        ).getDate();
        $('#poliza_id').val(poliza_id);
        $('#id_poliza').val(resp.data[0].poliza);
        $('#polizaAnterior').val(resp.data[0].poliza);
        $('#poliza-anterior').val(resp.data[0].poliza).prop('disabled', true);
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#serie').val(resp.data[0].serie);
        $('#VigenciaI').val(resp.data[0].fecha_termino);
        $('#VigenciaF').val(
          `${year}-${month < 10 ? '0' + String(month) : month}-${
            dia < 10 ? '0' + String(dia) : dia
          }`,
        );
        $('#prima_neta').val('');
        $('#prima_total').val('');
        $('#Moneda').val(resp.data[0].moneda);
        $('#notas').val(resp.data[0].notas);
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
            `<option value="New">Nueva Aseguradora</option>`,
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

  async function cancelPoliza(poliza_id) {
    const { isConfirmed, value } = await alertInput(
      '¿Esta seguro de cancelar esta poliza?',
    );
    if (!isConfirmed) return;
    if (!value.razon)
      return alert('Debe agregar una razón para cancelar', 'error');
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/delete',
      data: $.param({ poliza_id, razon: value.razon }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, undefined, resp.title);
          getPolizas();
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error',
        );
      },
    });
  }

  function changeReciboPagado(recibo_id, accion, poliza_id) {
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data: $.param({ recibo_id, accion }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, 'success');
          getRecibos(poliza_id);
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error',
        );
      },
    });
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
            'error',
          );
        },
      });
    });
  }

  // Observa el ancho real disponible para la tabla y decide si caben
  // todos los íconos de "Acciones" en fila o si hay que colapsarlos al
  // menú "3 puntos". Importante: se mide el contenedor con scroll
  // (.table-polizas__scroll) contra el ancho NATURAL de toda la tabla
  // (tabla expandida, sin recortar) — no el ancho de una celda suelta,
  // porque con overflow-x:auto las celdas nunca se angostan de verdad
  // (el navegador prefiere generar scroll horizontal antes que encoger
  // columnas), así que medir una celda nunca detectaba el colapso.
  let accionesResizeObserver = null;

  // Calcula la altura exacta que le corresponde a la tarjeta de la
  // tabla, midiendo su posición real (getBoundingClientRect) contra el
  // alto real de la ventana, en vez de adivinar con un número fijo tipo
  // calc(100vh - 160px) — ese número fijo no considera el alto real del
  // navbar ni de márgenes, y podía dejar espacio sin usar entre la
  // tabla y el borde inferior de la pantalla.
  function ajustarAlturaTablaPolizas() {
    const $card = $('.card-tabla-polizas');
    if (!$card.length) return;
    const top = $card[0].getBoundingClientRect().top;
    const margenInferior = 8;
    const alturaDisponible = window.innerHeight - top - margenInferior;
    $card.css('height', `${Math.max(300, alturaDisponible)}px`);
  }

  function setupAccionesResponsive() {
    const $tablePolizas = $('#table-polizas');
    const $scrollWrap = $tablePolizas.find('.table-polizas__scroll');
    const $table = $scrollWrap.find('> table');
    if (!$scrollWrap.length || !$table.length) return;

    if (accionesResizeObserver) {
      accionesResizeObserver.disconnect();
    }

    // Se mide en estado expandido: si la tabla ya venía marcada como
    // colapsada de un render anterior, se quita momentáneamente la clase
    // para poder tomar el ancho natural real de la tabla completa.
    const wasCollapsed = $tablePolizas.hasClass('table-polizas--collapsed');
    $tablePolizas.removeClass('table-polizas--collapsed');
    const naturalTableWidth = $table[0].scrollWidth;
    if (wasCollapsed) {
      $tablePolizas.addClass('table-polizas--collapsed');
    }

    accionesResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const available = entry.contentRect.width;
        const collapsed = available < naturalTableWidth - 4; // pequeño margen
        $tablePolizas.toggleClass('table-polizas--collapsed', collapsed);
      }
    });
    accionesResizeObserver.observe($scrollWrap[0]);
  }

  function fillTablePolizas(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    totalPolizas = recordsTotal;
    $('#polizasTotalLabel').text(
      `${recordsTotal} póliza${recordsTotal === 1 ? '' : 's'} encontrada${recordsTotal === 1 ? '' : 's'}`,
    );
    const table = $('#polizas-table');
    // Si la tabla se vuelve a pintar (cambio de página, búsqueda) mientras
    // un menú de acciones seguía abierto y "flotando" sobre <body>, se
    // elimina para no dejarlo huérfano.
    $('body')
      .children('.acciones-menu')
      .remove();
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption" style="background-color: ${getBackColor(
          poliza.status,
        )}">
          <td>
            <p class="td-clickable" id="td-clickable_${
              poliza.id
            }" style="color: ${getTextColor(poliza.status)}">
                ${poliza.poliza}
            </p>
          </td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.cliente
          }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.fecha_inicio
          }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.fecha_termino
          }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.subramo
          }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.aseguradora
          }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
            poliza.tipoPago
          }</td>
          <td>
            <ul class="btn_table_options acciones-full">
              <li>
                <a title="Ver detalle de poliza" class="btn__icon_show pointer" id="btnShowFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
              <li>
                <a title="Editar poliza" class="btn__icon_edit pointer" id="btnEditFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a title="Renovar poliza" class="btn__icon_renew pointer" id="btnRenewFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v240h-80v-80H200v400h280v80H200ZM760 0q-73 0-127.5-45.5T564-160h62q13 44 49.5 72T760-60q58 0 99-41t41-99q0-58-41-99t-99-41q-29 0-54 10.5T662-300h58v60H560v-160h60v57q27-26 63-41.5t77-15.5q83 0 141.5 58.5T960-200q0 83-58.5 141.5T760 0ZM200-640h560v-80H200v80Zm0 0v-80 80Z"/></svg>
                </a>
              </li>
              <li>
                <a title="Crear endoso" class="btn__icon_delete pointer" id="btnAddEndosoFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Zm520 480v-160H480v-80h160v-160h80v160h160v80H720v160h-80Z"/></svg>
                </a>
              </li>
              <li>
                <a title="Ver endosos" class="btn__icon_show pointer" id="btnViewEndososFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/></svg>
                </a>
              </li>
              ${
                poliza.pdf_path
                  ? `
              <li>
                <a title="Ver pdf" class="btn__icon_show pointer" id="btnViewPdfFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(poliza.status)}><path d="M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>
                </a>
              </li>
              `
                  : ''
              }
              <li>
                <a title="Cargar PDF de póliza" class="btn__icon_show pointer" id="btnUploadPolicyPdfFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(poliza.status)}><path d="M440-320h80v-160h120L480-640 320-480h120v160ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>
                </a>
              </li>
              <li>
                <a title="Cancelar poliza" class="btn__icon_delete pointer" id="btnDeleteFull_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status,
                  )}><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                </a>
              </li>
            </ul>
            <div class="dropdown acciones-menu-wrapper">
              <button type="button" class="acciones-toggle pointer" id="dropdownAcciones_${poliza.id}"
                data-toggle="dropdown" data-display="static" aria-haspopup="true" aria-expanded="false" title="Acciones">
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill=${getTextColor(
                  poliza.status,
                )}><path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/></svg>
              </button>
              <div class="dropdown-menu dropdown-menu-right acciones-menu" aria-labelledby="dropdownAcciones_${poliza.id}">
                <a title="Ver detalle de poliza" class="dropdown-item pointer" id="btnShow_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                  Ver detalle
                </a>
                <a title="Editar poliza" class="dropdown-item pointer" id="btnEdit_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                  Editar
                </a>
                <a title="Renovar poliza" class="dropdown-item pointer" id="btnRenew_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v240h-80v-80H200v400h280v80H200ZM760 0q-73 0-127.5-45.5T564-160h62q13 44 49.5 72T760-60q58 0 99-41t41-99q0-58-41-99t-99-41q-29 0-54 10.5T662-300h58v60H560v-160h60v57q27-26 63-41.5t77-15.5q83 0 141.5 58.5T960-200q0 83-58.5 141.5T760 0ZM200-640h560v-80H200v80Zm0 0v-80 80Z"/></svg>
                  Renovar
                </a>
                <a title="Crear endoso" class="dropdown-item pointer" id="btnAddEndoso_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Zm520 480v-160H480v-80h160v-160h80v160h160v80H720v160h-80Z"/></svg>
                  Crear endoso
                </a>
                <a title="Ver endosos" class="dropdown-item pointer" id="btnViewEndosos_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/></svg>
                  Ver endosos
                </a>
                <div class="dropdown-divider"></div>
                ${
                  poliza.pdf_path
                    ? `<a title="Ver pdf" class="dropdown-item pointer" id="btnViewPdf_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>
                  Ver PDF
                </a>`
                    : ''
                }
                <a title="Cargar PDF de póliza" class="dropdown-item pointer" id="btnUploadPolicyPdf_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M440-320h80v-160h120L480-640 320-480h120v160ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>
                  Cargar PDF
                </a>
                <div class="dropdown-divider"></div>
                <a title="Cancelar poliza" class="dropdown-item pointer text-danger" id="btnDelete_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                  Cancelar póliza
                </a>
              </div>
            </div>
          </td>
        </tr>`,
      );
      $(`#td-clickable_${poliza.id}`).on('click', (e) => {
        $('#recib').modal();
        getRecibos(poliza.id);
      });
      $(`#btnAddEndoso_${poliza.id}`).on('click', (e) => {
        $('#poliza_id').val(poliza.id);
        $('#endoso-type').modal();
      });
      $(`#btnEdit_${poliza.id}`).on('click', (e) => {
        editPoliza(poliza.id);
        $('#btnGuardar').html('Actualizar póliza');
        $('#title_poliza').text('Editar póliza');
      });
      $(`#btnDelete_${poliza.id}`).on('click', (e) => cancelPoliza(poliza.id));
      $(`#btnRenew_${poliza.id}`).on('click', (e) => renewPoliza(poliza.id));
      $(`#btnViewEndosos_${poliza.id}`).on('click', (e) => {
        getEndosos(poliza.id);
        $('#endoso-list').modal();
      });
      $(`#btnShow_${poliza.id}`).on('click', (e) => showPoliza(poliza.id));
      $(`#btnViewPdf_${poliza.id}`).on('click', (e) => {
        e.preventDefault();
        if (poliza.pdf_path) {
          window.open(`/polizas/download_pdf/${poliza.id}`, '_blank');
        }
      });
      $(`#btnUploadPolicyPdf_${poliza.id}`).on('click', (e) => {
        e.preventDefault();
        uploadExistingPolicyPdf(poliza.id);
      });
      // Misma lógica que arriba, pero para la fila de íconos completos
      // (.acciones-full), que se muestra en vez del menú "3 puntos"
      // cuando sí caben todas las acciones en pantalla.
      $(`#btnAddEndosoFull_${poliza.id}`).on('click', (e) => {
        $('#poliza_id').val(poliza.id);
        $('#endoso-type').modal();
      });
      $(`#btnEditFull_${poliza.id}`).on('click', (e) => {
        editPoliza(poliza.id);
        $('#btnGuardar').html('Actualizar póliza');
        $('#title_poliza').text('Editar póliza');
      });
      $(`#btnDeleteFull_${poliza.id}`).on('click', (e) => cancelPoliza(poliza.id));
      $(`#btnRenewFull_${poliza.id}`).on('click', (e) => renewPoliza(poliza.id));
      $(`#btnViewEndososFull_${poliza.id}`).on('click', (e) => {
        getEndosos(poliza.id);
        $('#endoso-list').modal();
      });
      $(`#btnShowFull_${poliza.id}`).on('click', (e) => showPoliza(poliza.id));
      $(`#btnViewPdfFull_${poliza.id}`).on('click', (e) => {
        e.preventDefault();
        if (poliza.pdf_path) {
          window.open(`/polizas/download_pdf/${poliza.id}`, '_blank');
        }
      });
      $(`#btnUploadPolicyPdfFull_${poliza.id}`).on('click', (e) => {
        e.preventDefault();
        uploadExistingPolicyPdf(poliza.id);
      });
    });
    // Decide si caben todos los íconos de acción en fila o si hay que
    // colapsarlos al menú "3 puntos": se mide el ancho real que ocupa la
    // fila completa de íconos (.acciones-full) contra el ancho
    // disponible en la celda, en vez de adivinar con un breakpoint fijo.
    setupAccionesResponsive();
    // Ajusta cuántas filas se piden por página según el espacio
    // realmente disponible, para que la tabla se llene por completo
    // (sin espacio en blanco) mientras mantiene la misma altura que el
    // formulario.
    adjustPolizasItemsOnPageAndReload();
    if (!data.length) return;
    $('#pagination').pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getPolizas(pageNumber, start);
      },
    });
  }

  function fillTableRecibos(resp, currentPage, itemsOnPage, poliza_id) {
    const { data, recordsTotal } = resp;

    const table = $('#receiptsTable');
    table.html('');
    $.each(data, function (idx, recibo) {
      const fechaPago = displayCellValue(recibo.fecha_pago);
      table.append(
        `<tr class="tableOption-recibos">
            <td>${displayCellValue(recibo.numero)}</td>
            <td>${displayCellValue(recibo.fecha_recibo)}</td>
            <td>${displayCellValue(recibo.vencimiento)}</td>
            <td>${formatReceiptAmount(recibo.prima_neta)}</td>
            <td>${formatReceiptAmount(recibo.prima_total)}</td>
            <td>${displayCellValue(recibo.moneda)}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${fechaPago} ${
              fechaPago
                ? `<a class="btn__icon_edit pointer" id="btnEdit_${recibo.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>`
                : ''
            } </td>
            <td>${recibo.cancelado ? 'Cancelado' : ''}</td>
            <td>
              <button type="button" class="btn px-2 py-1" id="btnUploadComprobante_${recibo.id}">
                Cargar
              </button>
              <button type="button" class="btn px-2 py-1" id="btnViewComprobante_${recibo.id}">
                Ver/Descargar
              </button>
            </td>
         </tr>`,
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop('checked', true);
      $(`#check_pagado${recibo.id}`).on('click', function () {
        if ($(`#check_pagado${recibo.id}`).is(':checked') == true) {
          changeReciboPagado(recibo.id, 'Pagar', poliza_id);
        } else {
          changeReciboPagado(recibo.id, 'Cancelar Pago', poliza_id);
        }
      });
      $(`#btnEdit_${recibo.id}`).on('click', (e) => {
        $('#recibo_id').val(recibo.id);
        $('#poliza_id').val(poliza_id);
        $('#edit_recib_date').modal();
      });
      $(`#btnUploadComprobante_${recibo.id}`).on('click', (e) => {
        e.preventDefault();
        uploadReceiptComprobante(recibo.id, () => getRecibos(poliza_id));
      });
      $(`#btnViewComprobante_${recibo.id}`).on('click', (e) => {
        e.preventDefault();
        viewReceiptComprobante(recibo);
      });
    });
    if (!data.length) return $('#pagination-recibos').html('');
    $('#pagination-recibos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(poliza_id, null, pageNumber, start);
      },
    });
  }

  function fillTableEndosos(resp, currentPage, itemsOnPage, poliza_id) {
    const { data, recordsTotal } = resp;
    const table = $('#endosos-table');
    table.html('');
    $.each(data, function (idx, endoso) {
      table.append(
        `<tr class="tableOption-endoso" style="background-color: ${getBackColor(
          endoso.status,
        )}">
          <td>
            <p class="td-clickable" id="td-clickable-endoso_${
              endoso.id
            }" style="color: ${getTextColor(endoso.status)}">
                ${endoso.endoso}
            </p>
          </td>
          <td style="color: ${getTextColor(endoso.status)}">${
            endoso.tipo_endoso
          }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
            endoso.cliente
          }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
            endoso.subramo
          }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
            endoso.aseguradora
          }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
            endoso.tipoPago
          }</td>
          <td style="color: ${getTextColor(endoso.status)}">
            <ul class="btn_table_options">
            </ul>
          </td>
        </tr>`,
      );
      $(`#td-clickable-endoso_${endoso.id}`).on('click', (e) => {
        getRecibos(null, endoso.id);
      });
    });
    $('#pagination-endosos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getEndosos(poliza_id, pageNumber, start);
      },
    });
  }

  function fillTableRecibosEndosos(resp, currentPage, itemsOnPage, endoso_id) {
    const { data, recordsTotal } = resp;

    const table = $('#receiptsEndosoTable');
    table.html('');
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption-recibos-endosos">
            <td>${displayCellValue(recibo.numero)}</td>
            <td>${displayCellValue(recibo.fecha_recibo)}</td>
            <td>${displayCellValue(recibo.vencimiento)}</td>
            <td>${formatReceiptAmount(recibo.prima_neta)}</td>
            <td>${formatReceiptAmount(recibo.prima_total)}</td>
            <td>${displayCellValue(recibo.moneda)}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${displayCellValue(recibo.fecha_pago)}</td>
            <td>${recibo.cancelado ? 'Cancelado' : ''}</td>
            <td>
              <button type="button" class="btn px-2 py-1" id="btnUploadComprobanteEndoso_${recibo.id}">
                Cargar
              </button>
              <button type="button" class="btn px-2 py-1" id="btnViewComprobanteEndoso_${recibo.id}">
                Ver/Descargar
              </button>
            </td>
         </tr>`,
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop('checked', true);
      $(`#check_pagado${recibo.id}`).on('click', function () {
        if ($(`#check_pagado${recibo.id}`).is(':checked') == true) {
          changeReciboPagado(recibo.id, 'Pagar', endoso_id);
        } else {
          changeReciboPagado(recibo.id, 'Cancelar Pago', endoso_id);
        }
      });
      $(`#btnUploadComprobanteEndoso_${recibo.id}`).on('click', (e) => {
        e.preventDefault();
        uploadReceiptComprobante(recibo.id, () => getRecibos(null, endoso_id));
      });
      $(`#btnViewComprobanteEndoso_${recibo.id}`).on('click', (e) => {
        e.preventDefault();
        viewReceiptComprobante(recibo);
      });
    });
    if (!data.length) return $('#pagination-recibos-endosos').html('');
    $('#pagination-recibos-endosos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(null, endoso_id, pageNumber, start);
      },
    });
  }

  // Junta los filtros del panel "Filtros" (aseguradora, estado, grupo,
  // cliente, rango de fechas) en un objeto plano, incluyendo solo los que
  // tengan valor. Se usa tanto para pintar la tabla como para exportar a
  // Excel/PDF e imprimir, así que siempre reflejan exactamente lo mismo
  // que se ve en pantalla.
  // Bootstrap 4 no soporta bien tener dos modales abiertos al mismo
  // tiempo (backdrop y stacking se pisan) — por eso, al guardar una
  // póliza y necesitar abrir el modal de recibos justo después, primero
  // se espera a que el modal de la póliza termine de cerrarse (evento
  // 'hidden.bs.modal', que dispara cuando la transición ya acabó) y solo
  // entonces se abre el siguiente, en vez de tenerlos ambos a la vez.
  function hideModalPolizaThenShow(nextModalSelector) {
    $('#modal-poliza').one('hidden.bs.modal', function () {
      $(nextModalSelector).modal('show');
    });
    $('#modal-poliza').modal('hide');
  }

  function getFiltrosPolizas() {
    const filtros = {};
    const aseguradora = $('#filtroAseguradora').val();
    const status = $('#filtroStatus').val();
    const grupo = $('#filtroGrupo').val();
    const clienteId = $('#filtroClienteId').val();
    const cliente = $('#filtroCliente').val();
    const desde = $('#filtroFechaDesde').val();
    const hasta = $('#filtroFechaHasta').val();
    if (aseguradora) filtros.filtro_aseguradora_id = aseguradora;
    if (status) filtros.filtro_status = status;
    if (grupo) filtros.filtro_grupo_id = grupo;
    // Si se eligió un cliente del autocomplete se manda su ID (exacto);
    // si solo escribió texto sin elegir nada de la lista, se manda como
    // texto libre y el backend hace match por nombre/apellido.
    if (clienteId) {
      filtros.filtro_cliente_id = clienteId;
    } else if (cliente) {
      filtros.filtro_cliente = cliente;
    }
    if (desde) filtros.filtro_fecha_desde = desde;
    if (hasta) filtros.filtro_fecha_hasta = hasta;
    return filtros;
  }

  // Petición en curso de la tabla de pólizas. Se cancela antes de lanzar
  // una nueva: sin esto, escribir rápido en el buscador disparaba varias
  // peticiones que podían responder desordenadas (la más vieja llegando
  // después de la más nueva), pisando el resultado correcto — eso era
  // la inestabilidad de la búsqueda.
  let currentPolizasRequest = null;

  function getPolizas(pageNumber = 1, start = 0, isAutoAdjust = false) {
    if (!isAutoAdjust) polizasAutoAdjustAttempts = 0;
    const length = polizasItemsOnPage;
    const searchValue = $('#searchPoliza').val();
    const params = { start, length, order: true, ...getFiltrosPolizas() };
    if (searchValue) params.searchValue = searchValue;
    if (currentPolizasRequest) {
      currentPolizasRequest.abort();
    }
    currentPolizasRequest = $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param(params),
      success: (resp) => fillTablePolizas(resp, pageNumber, length),
      error: (xhr, status, error) => {
        if (status === 'abort') return; // esperado: se canceló a propósito
        console.error(error);
      },
    });
  }

  // Calcula cuántas filas caben de verdad en el espacio disponible
  // (altura de .table-polizas__scroll menos el encabezado, entre la
  // altura real de una fila ya renderizada) y, si es distinto de lo que
  // se pidió, vuelve a pedir la página 1 con la cantidad correcta. Se
  // reintenta (con tope) mientras no converja, en vez de rendirse tras
  // un solo intento.
  function adjustPolizasItemsOnPageAndReload() {
    if (polizasAutoAdjustAttempts >= POLIZAS_MAX_AUTO_ADJUST_ATTEMPTS) return;

    // Primero se fija la altura real de la tarjeta contra el viewport;
    // solo después tiene sentido medir cuánto espacio libre queda dentro
    // de ella para calcular cuántas filas caben.
    ajustarAlturaTablaPolizas();

    const $scrollWrap = $('#table-polizas .table-polizas__scroll');
    const $thead = $scrollWrap.find('thead');
    const $firstRow = $('#polizas-table tr').first();
    if (!$scrollWrap.length || !$firstRow.length) return;

    const availableHeight = $scrollWrap[0].clientHeight;
    const headerHeight = $thead.length ? $thead[0].getBoundingClientRect().height : 0;
    const rowHeight = $firstRow[0].getBoundingClientRect().height;
    if (!availableHeight || !rowHeight) return;

    const idealCount = Math.max(5, Math.floor((availableHeight - headerHeight) / rowHeight));
    if (idealCount === polizasItemsOnPage) return; // ya converge, no cuenta como intento

    polizasAutoAdjustAttempts += 1;
    polizasItemsOnPage = idealCount;
    getPolizas(1, 0, true);
  }

  // Recalcula al cambiar el tamaño de la ventana (debounced), porque la
  // altura disponible cambia con ella.
  let polizasResizeDebounce = null;
  $(window).on('resize', () => {
    clearTimeout(polizasResizeDebounce);
    polizasResizeDebounce = setTimeout(() => {
      ajustarAlturaTablaPolizas();
      polizasAutoAdjustAttempts = 0;
      adjustPolizasItemsOnPageAndReload();
    }, 200);
  });

  // El evento 'load' de la ventana NO espera a que las fuentes web
  // (@font-face, como Lato/Poppins que carga esta página) terminen de
  // descargarse — eso pasa de forma asíncrona por separado. Si la
  // primera medición de altura de fila se hizo con la fuente de
  // respaldo del sistema (más angosta/baja que la fuente real), el
  // cálculo de cuántas filas caben salía corto y nunca se corregía. La
  // API document.fonts.ready es la forma correcta de esperar a que las
  // fuentes ya estén listas antes de medir.
  if (window.document && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      ajustarAlturaTablaPolizas();
      polizasAutoAdjustAttempts = 0;
      adjustPolizasItemsOnPageAndReload();
    });
  }

  // Reintenta una vez más cuando la página termina de cargar del todo
  // (imágenes, etc.), como red de seguridad adicional.
  $(window).on('load', () => {
    ajustarAlturaTablaPolizas();
    polizasAutoAdjustAttempts = 0;
    adjustPolizasItemsOnPageAndReload();
  });

  // Primer cálculo, apenas el DOM está listo (antes de la primera carga
  // de datos), para que la tabla ya tenga su altura real correcta desde
  // el primer render.
  ajustarAlturaTablaPolizas();

  function getEndosos(poliza_id, pageNumber = 1, start = 0) {
    const length = 10;
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_endosos',
      data: $.param({ start, length, order: true, poliza_id }),
      success: (resp) => fillTableEndosos(resp, pageNumber, length, poliza_id),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function uploadReceiptComprobante(reciboId, onSuccess) {
    const fileInput = $('<input type="file" accept=".pdf" style="display:none;" />');
    $('body').append(fileInput);

    fileInput.on('change', function () {
      const file = this.files[0];
      fileInput.remove();
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('El comprobante debe ser un archivo PDF', 'warning', 'Archivo inválido');
        return;
      }

      const formData = new FormData();
      formData.append('recibo_id', reciboId);
      formData.append('comprobante_pdf', file);

      Swal.fire({
        title: 'Cargando comprobante...',
        text: 'Guardando documento PDF',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      $.ajax({
        type: 'POST',
        url: '/polizas/upload_receipt_comprobante',
        data: formData,
        processData: false,
        contentType: false,
        success: function (resp) {
          Swal.close();
          if (resp.error) {
            alert(resp.msg, 'error', 'Error');
          } else {
            alert(resp.msg, 'success', 'Comprobante cargado');
            if (onSuccess) onSuccess();
          }
        },
        error: function () {
          Swal.close();
          alert('Error al cargar el comprobante', 'error', 'Error');
        },
      });
    });

    fileInput.trigger('click');
  }

  function uploadExistingPolicyPdf(polizaId) {
    const fileInput = $('<input type="file" accept=".pdf" style="display:none;" />');
    $('body').append(fileInput);

    fileInput.on('change', function () {
      const file = this.files[0];
      fileInput.remove();
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('El archivo debe ser PDF', 'warning', 'Archivo inválido');
        return;
      }

      const formData = new FormData();
      formData.append('poliza_id', polizaId);
      formData.append('pdf_file', file);

      Swal.fire({
        title: 'Cargando PDF...',
        text: 'Asociando documento a la póliza',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      $.ajax({
        type: 'POST',
        url: '/polizas/upload_existing_policy_pdf',
        data: formData,
        processData: false,
        contentType: false,
        success: function (resp) {
          Swal.close();
          if (resp.error) {
            alert(resp.msg, 'error', 'Error');
          } else {
            alert(resp.msg, 'success', 'PDF cargado');
            getPolizas();
          }
        },
        error: function () {
          Swal.close();
          alert('Error al cargar el PDF de la póliza', 'error', 'Error');
        },
      });
    });

    fileInput.trigger('click');
  }

  function viewReceiptComprobante(recibo) {
    if (!recibo.comprobante) {
      alert('No se ha cargado el documento aun', 'warning', 'Sin comprobante');
      return;
    }
    window.open(`/polizas/download_receipt_comprobante/${recibo.id}`, '_blank');
  }

  function getRecibos(poliza_id, endoso_id, pageNumber = 1, start = 0) {
    const length = 10;
    let sendObj;
    if (poliza_id && !endoso_id) {
      sendObj = { start, length, order: true, poliza_id };
    }
    if (endoso_id && !poliza_id) {
      sendObj = { start, length, order: true, endoso_id };
    }
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_receipts',
      data: $.param(sendObj),
      success: (resp) =>
        endoso_id
          ? fillTableRecibosEndosos(resp, pageNumber, length, endoso_id)
          : fillTableRecibos(resp, pageNumber, length, poliza_id),
      error: (xhr, status, error) => console.error(error),
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
            '<p class="dropdown-item no-results">No hay coincidencias</p>',
          );
        } else {
          $.each(options, function (i, option) {
            dropdownMenu.append(
              `<a class="dropdown-item" id="client__${option.id}">
                ${option.name}
              </a>`,
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
          'error',
        );
      },
    });
  }

  // Arma los mismos campos que ya usa createReceipts(), para poder
  // mandarlos JUNTO con la creación de la póliza/endoso en una sola
  // petición (en vez de 2 peticiones separadas sin relación entre sí)
  function datosRecibosDelModal() {
    return {
      netPremium: $('#prima-neta').val(),
      totalPremium: $('#prima-total').val(),
      iva: $('#iva').val(),
      insurance: $('#derecho_poliza').val(),
      commission: $('#comision').val(),
      receipts: $('#nopagos').val(),
      rec_pago: $('#rec_pago').val(),
    };
  }

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
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/save_receipts',
      data: $.param(sendObj),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
          console.log('Error crear recibos', resp.error, resp.msg);
        } else {
          console.log('Recibos creados exitosamente');
        }
      },
      error: function (xhr, status, error) {
        console.error('Error crear recibos', error);
        alert(
          `Ocurrio un error al crear los recibos ${error}`,
          'error',
          'Error al crear recibos',
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
    const old_tipo_pago = $('#old_tipo_pago').val();
    let params = $.param({
      prima_neta,
      prima_total,
      fecha_inicio,
      fecha_termino,
      tipo_pago_id,
    });
    console.log($('#title_poliza')?.text());
    if ($('#title_poliza')?.text()?.includes('Editar')) {
      const poliza_id = $('#poliza_id').val();
      if (
        prima_neta !== old_prima_neta ||
        prima_total !== old_prima_total ||
        tipo_pago_id !== old_tipo_pago
      ) {
        const resp = await alertConfirm(
          '¿vamos a eliminar los recibos para generarlos nuevamente, estás seguro de continuar?',
        );
        if (!resp.isConfirmed) return;
        $.ajax({
          url: 'polizas/check_delete_receipts',
          method: 'POST',
          dataType: 'json',
          data: `poliza_id=${poliza_id}`,
          success: function (resp) {
            console.log(resp);
            if (resp.error) {
              alert(resp.msg, 'error', resp.title);
            } else {
              const new_params = `${params}&poliza_id=${poliza_id}`;
              $.ajax({
                url: 'polizas/get_policy_values',
                method: 'POST',
                dataType: 'json',
                data: new_params,
                success: function (resp) {
                  if (resp.error) {
                    alert(resp.msg, 'error', resp.title);
                    $('#create-recib').modal('hide');
                  } else {
                    if (resp.msg && resp.msg.includes('no coincidiran')) {
                      $('#alert_Modal').show();
                      $('#alert_Modal').text(resp.msg);
                    }
                    $('#prima-neta').val(resp.netPremium);
                    $('#prima-total').val(resp.totalPremium);
                    $('#nopagos').val(resp.numReceipts);
                    $('#iva').val(16);
                    $('#create-recib').modal({
                      backdrop: 'static',
                      keyboard: false,
                    });
                    $('#receipts_created').val('no');
                  }
                },
                error: function (xhr, textStatus, error) {
                  console.error(error);
                },
              });
            }
          },
          error: function (xhr, textStatus, error) {
            console.error(error);
          },
        });
      } else {
        let newParams = serializePolizaFormWithRawCurrencyValues();
        newParams = `${newParams}&poliza_id=${poliza_id}`;
        $.ajax({
          url: 'polizas/edit',
          method: 'POST',
          dataType: 'json',
          data: newParams,
          success: function (resp) {
            console.log(resp);
            if (resp.error) {
              alert(resp.msg, 'error', resp.title);
            } else {
              alert(resp.msg);
            }
          },
          error: function (xhr, textStatus, error) {
            console.error(error);
          },
        });
      }
    } else {
      const isCreatingEndoso = $('#title_poliza')?.text()?.includes('Endoso');
      if (isCreatingEndoso && $('#tipo').val() === 'B') {
        $.ajax({
          type: 'POST',
          url: '/polizas/create_endoso',
          dataType: 'json',
          data: serializePolizaFormWithRawCurrencyValues(),
          success: function (resp) {
            if (resp.error) {
              alert(resp.msg, 'error', resp.title);
              return;
            }
            alert(resp.msg, 'success');
            getPolizas();
            resetForm();
            $('#modal-poliza').modal('hide');
          },
          error: function (xhr, status, error) {
            console.error('Error al crear endoso tipo B', error);
            alert(
              xhr.responseJSON?.msg || 'No se pudo crear el endoso tipo B',
              'error',
            );
          },
        });
        return;
      }

      if (isCreatingEndoso) {
        const poliza_id = $('#poliza_id').val();
        params = `${params}&poliza_id=${poliza_id}&is_endoso=true`;
      }
      $.ajax({
        url: 'polizas/get_policy_values',
        method: 'POST',
        dataType: 'json',
        data: params,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
            $('#create-recib').modal('hide');
          } else {
            if (resp.msg && resp.msg.includes('no coincidiran')) {
              $('#alert_Modal').show();
              $('#alert_Modal').text(resp.msg);
            }
            $('#prima-neta').val(resp.netPremium);
            $('#prima-total').val(resp.totalPremium);
            $('#nopagos').val(resp.numReceipts);
            $('#iva').val(16);
            $('#create-recib').modal({ backdrop: 'static', keyboard: false });
            $('#receipts_created').val('no');
          }
        },
        error: function (xhr, textStatus, error) {
          console.error(error);
        },
      });
    }
  });

  $('#form_date_recib').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const formDataRecib = $('#form_date_recib').serialize();
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data:
        formDataRecib +
        '&accion=Modificar Fecha de Pago' +
        '&recibo_id=' +
        $('#recibo_id').val(),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          $('#edit_recib_date').modal('toggle');
          alert(resp.msg, 'success');
          getRecibos($('#poliza_id').val());
          $('#recibo_id').val('');
          $('#poliza_id').val('');
        }
      },
      error: function (xhr, status, error) {
        console.error('Error en process_receipt', error);
      },
    });
  });

  $('#form-recibo').submit(function (e) {
    e.preventDefault();
    if (!receiptSaveRequested) {
      console.warn('Submit de recibos cancelado: falta clic explícito en Guardar');
      return;
    }
    receiptSaveRequested = false;

    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const formDataPoliza = serializePolizaFormWithRawCurrencyValues();
    if ($('#tipo').val()) {
      const paramsEndoso = `${formDataPoliza}&${$.param(datosRecibosDelModal())}`;
      $.ajax({
        type: 'POST',
        url: '/polizas/create_endoso',
        data: paramsEndoso,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#receipts_created').val('si');
            alert(resp.msg, 'success');
            getPolizas();
            resetForm();
            hideModalPolizaThenShow('#create-recib');
          }
        },
        error: function (xhr, status, error) {
          console.error('Error en create_endoso', error);
          alert(
            xhr.responseJSON?.msg || 'Ocurrió un error al crear el endoso y sus recibos',
            'error',
          );
        },
      });
    } else if ($('#title_poliza')?.text()?.includes('Editar')) {
      let newParams = serializePolizaFormWithRawCurrencyValues();
      newParams = `${newParams}&poliza_id=${poliza_id}&${$.param(datosRecibosDelModal())}`;
      $.ajax({
        url: 'polizas/edit',
        method: 'POST',
        dataType: 'json',
        data: newParams,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#receipts_created').val('si');
            alert(resp.msg, 'success');
            getPolizas();
            resetForm();
            hideModalPolizaThenShow('#create-recib');
          }
        },
        error: function (xhr, textStatus, error) {
          console.error('Error al editar poliza /edit', error);
          alert(
            xhr.responseJSON?.msg || 'Ocurrió un error al actualizar la póliza y sus recibos',
            'error',
          );
        },
      });
    } else {
      // OJO: NO resetear #poliza_id a 'New' aquí — si es una renovación,
      // renewPoliza() ya lo dejó con el ID real de la póliza vieja desde
      // antes; resetearlo aquí borraba ese vínculo justo antes de mandar
      // la petición, y el backend nunca se enteraba de que era una
      // renovación (por eso dejaba renovar la misma póliza varias veces).
      const newParams = `${serializePolizaFormWithRawCurrencyValues()}&${$.param(datosRecibosDelModal())}`;
      $.ajax({
        type: 'POST',
        url: '/polizas/create',
        data: newParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        dataType: 'json',
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#receipts_created').val('si');
            alert(resp.title, 'success');
            getPolizas();
            resetForm();
            hideModalPolizaThenShow('#create-recib');
          }
        },
        error: function (xhr, status, error) {
          console.error('Error al crear poliza /create', error);
          alert(
            xhr.responseJSON?.msg || 'Ocurrió un error al crear la póliza y sus recibos',
            'error',
          );
        },
      });
    }
  });

  $('#reset-btn').click(async (e) => {
    e.preventDefault();
    await resetForm();
    $('#modal-poliza').modal('hide');
  });

  $('#btnGuardar-recibos').click(() => {
    receiptSaveRequested = true;
  });

  $('#closeModalCreateRecibos, #reset-btn-recibos').click(async (e) => {
    e.preventDefault();
    try {
      const resp = await alertConfirm(
        '¿Esta seguro de que desea salir?, no se crearan la poliza y/o recibos',
      );
      if (!resp.isConfirmed) return;
      $('#create-recib').modal('hide');
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
        'warning',
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

  // Buscador de la tabla de pólizas: antes disparaba una petición por
  // cada tecla (sin debounce) con datos hardcodeados (length:10, sin
  // filtros), y esas peticiones podían llegar desordenadas y pisar el
  // resultado correcto — de ahí la inestabilidad. Ahora usa 'input' (más
  // confiable que 'keyup' para pegar/borrar), espera 300ms de pausa antes
  // de buscar, y pasa siempre por getPolizas(), que ya cancela la
  // petición anterior y respeta filtros + itemsOnPage dinámico.
  let searchPolizaDebounce = null;
  $('#searchPoliza').on('input', function () {
    clearTimeout(searchPolizaDebounce);
    searchPolizaDebounce = setTimeout(() => getPolizas(1, 0), 300);
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

  function updateSerieRequired() {
    const ramoText = $('#ramo option:selected').text().trim().toUpperCase();
    const isAuto = ramoText.includes('AUTO');
    const isCasa = ramoText.includes('CASA') || ramoText.includes('HOGAR');
    $('#serie').prop('required', isAuto);
    $('#div_serie').toggle(!isCasa);
    $('#div_notas').toggle(!isCasa);
    if (isCasa) {
      $('#serie').val('');
      $('#notas').val('');
    }
  }

  $('#ramo').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_ramo_subramo_div').show();
    }
    updateSerieRequired();
  });

  $('#subramo').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_ramo_subramo_div').show();
    }
  });

  $('#aseguradora').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_aseguradora_div').show();
    }
  });

  $('#vendedor').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_vendedor_div').show();
    }
  });

  $('#agente').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_agente_div').show();
    }
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({
      start: 0,
      length: totalPolizas,
      export_csv: true,
      searchValue: $('#searchPoliza').val(),
      ...getFiltrosPolizas(),
    });
    $.ajax({
      type: 'POST',
      url: '/polizas/get',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `polizas_${new Date().toLocaleDateString()}.csv`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  $('#btnPdf').click((e) => {
    e.preventDefault();
    let params = $.param({
      export_pdf: true,
      searchValue: $('#searchPoliza').val(),
      start: 0,
      length: totalPolizas,
      ...getFiltrosPolizas(),
    });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    $.ajax({
      type: 'POST',
      url: '/polizas/get',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `reporte_cobranza_${new Date().toLocaleDateString()}.pdf`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  // Panel de filtros: mostrar/ocultar, aplicar (reinicia a la página 1
  // con los filtros actuales) y limpiar (borra todo y vuelve a cargar
  // sin filtros).
  $('#btnToggleFiltros').click((e) => {
    e.preventDefault();
    $('#panelFiltrosPolizas').slideToggle(150);
  });

  $('#btnCrearPoliza').click(async (e) => {
    e.preventDefault();
    await resetForm();
    $('#title_poliza').text('Crear póliza');
    $('#modal-poliza').modal('show');
  });

  $('#btnAplicarFiltros').click((e) => {
    e.preventDefault();
    getPolizas(1, 0);
  });

  $('#btnLimpiarFiltros').click((e) => {
    e.preventDefault();
    $('#filtroAseguradora').val('');
    $('#filtroStatus').val('');
    $('#filtroGrupo').val('');
    $('#filtroCliente').val('');
    $('#filtroClienteId').val('');
    $('#filtroClienteOptions').hide().empty();
    $('#filtroFechaDesde').val('');
    $('#filtroFechaHasta').val('');
    $('#filtroMesRapido').val('');
    $('#filtroMesRapidoAnio').val('');
    getPolizas(1, 0);
  });

  // Autocomplete del campo "Cliente" en el panel de filtros: reutiliza el
  // mismo endpoint que ya usa el formulario (/polizas/search_clients),
  // pero con sus propios elementos para no interferir con el buscador de
  // cliente del formulario de creación/edición.
  let filtroClienteDebounce = null;
  $('#filtroCliente').on('input', function () {
    // Si el usuario vuelve a escribir después de haber elegido un
    // cliente de la lista, se invalida esa selección exacta (vuelve a
    // ser texto libre hasta que elija de nuevo o aplique tal cual).
    $('#filtroClienteId').val('');
    const inputValue = this.value;
    clearTimeout(filtroClienteDebounce);
    if (inputValue.length < 3) {
      $('#filtroClienteOptions').hide().empty();
      return;
    }
    filtroClienteDebounce = setTimeout(() => {
      $.ajax({
        url: 'polizas/search_clients',
        method: 'POST',
        dataType: 'json',
        data: { query: inputValue },
        success: function (response) {
          const options = response.options;
          const dropdownMenu = $('#filtroClienteOptions');
          dropdownMenu.empty();
          if (!options.length) {
            dropdownMenu.append(
              '<p class="dropdown-item no-results">No hay coincidencias</p>',
            );
          } else {
            $.each(options, function (i, option) {
              dropdownMenu.append(
                `<a class="dropdown-item" id="filtro-client__${option.id}">${option.name}</a>`,
              );
              $(`#filtro-client__${option.id}`).on('click', () => {
                $('#filtroCliente').val(option.name);
                $('#filtroClienteId').val(option.id);
                dropdownMenu.hide();
              });
            });
          }
          dropdownMenu.show();
        },
        error: (xhr, status, error) => console.error(error),
      });
    }, 250);
  });
  // Cierra la lista de coincidencias al hacer click fuera del campo.
  $(document).on('click', (e) => {
    if (!$(e.target).closest('.polizas-filtros__campo').length) {
      $('#filtroClienteOptions').hide();
    }
  });

  // Atajo "Mes rápido": al elegir un mes (y opcionalmente un año, si no
  // se indica usa el año actual) se llenan automáticamente "Vigencia
  // desde/hasta" con el primer y último día de ese mes. El usuario puede
  // seguir editando esas fechas a mano después para armar un rango
  // personalizado (ej. 23 de abril al 3 de agosto).
  function aplicarMesRapido() {
    const mes = parseInt($('#filtroMesRapido').val(), 10);
    if (!mes) return;
    const anioInput = parseInt($('#filtroMesRapidoAnio').val(), 10);
    const anio = anioInput || new Date().getFullYear();
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const toISODate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    $('#filtroFechaDesde').val(toISODate(primerDia));
    $('#filtroFechaHasta').val(toISODate(ultimoDia));
  }
  $('#filtroMesRapido').on('change', aplicarMesRapido);
  $('#filtroMesRapidoAnio').on('change', aplicarMesRapido);

  // Imprimir directamente: genera el mismo PDF que "Exportar PDF" (con
  // los filtros actuales aplicados) pero en vez de descargarlo, lo abre
  // en un iframe oculto y dispara el diálogo de impresión del navegador
  // sobre ese PDF automáticamente.
  $('#btnImprimir').click((e) => {
    e.preventDefault();
    let params = $.param({
      export_pdf: true,
      searchValue: $('#searchPoliza').val(),
      start: 0,
      length: totalPolizas,
      ...getFiltrosPolizas(),
    });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    $.ajax({
      type: 'POST',
      url: '/polizas/get',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob) {
        const url = window.URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (err) {
            // Si el navegador bloquea el auto-print (poco común), al
            // menos se abre el PDF en una pestaña para imprimir manual.
            window.open(url, '_blank');
          }
        };
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  $('#endoso_tipo_a').click((e) => {
    e.preventDefault();
    createEndozo($('#poliza_id').val(), 'A');
  });
  $('#endoso_tipo_b').click((e) => {
    e.preventDefault();
    createEndozo($('#poliza_id').val(), 'B');
  });
  $('#endoso_tipo_d').click((e) => {
    e.preventDefault();
    createEndozo($('#poliza_id').val(), 'D');
  });

  $('#div_poliza_id').hide();
  $('#only_show_poliza').hide();
  $('#div_poliza_anterior').hide();
  $('#nuevo_ramo_subramo_div').hide();
  $('#nuevo_aseguradora_div').hide();
  $('#nuevo_vendedor_div').hide();
  $('#nuevo_agente_div').hide();
  bindCurrencyFormatting('#prima_neta');
  bindCurrencyFormatting('#prima_total');

  getPolizas();
});
