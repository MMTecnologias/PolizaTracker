$(function () {
  let razonInput = '';

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

  async function resetForm() {
    try {
      $('#form-polizas')[0].reset();
      $('#btnGuardar').show();
      $('#reset-btn').show();
      $('#form-polizas').removeClass('was-validated');
      $('#form-polizas select').prop('disabled', false);
      $('#poliza_id').val('New');
      $('#pdf_path').val('');
      $('#pdf_file').val('');
      $('.upload-loading').hide();
      $('.upload-content').show();
      $('#tipo').val('');
      $('#div_poliza_id').hide();
      $('#div_search_client').show();
      $('#title_poliza').text('Endoso');
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
      const data = await getFormData();
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
      return data;
    } catch (error) {
      console.log(error);
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
    $('#poliza_id').val(endoso_id);
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start: 0, length: 0, endoso_id }),
      success: function (resp) {
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#Poliza').val(resp.data[0].endoso);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#prima_neta').prop('disabled', false);
        $('#prima_total').prop('disabled', false);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        $('#prima_neta').val(resp.data[0].prima_neta);
        $('#prima_total').val(resp.data[0].prima_total);
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
        $('#conducto_pago').html(`<option value='${resp.data[0].rec_pago}'>
            ${resp.data[0].rec_pago}
            </option>
        `);
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

  function fillTableEndosos(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#polizas-table');
    console.log('Endosos =>', data);
    table.html('');
    $.each(data, function (idx, endoso) {
      table.append(
        `<tr class="tableOption" style="background-color: ${getBackColor(
          endoso.status
        )}">
          <td>
            <p class="td-clickable" id="td-clickable_${
              endoso.id
            }" style="color: ${getTextColor(endoso.status)}">
                ${endoso.endoso}
            </p>
          </td>
          <td style="color: ${getTextColor(endoso.status)}">
            <a href="javascript:void(0)" class="poliza-link" id="btnPolizaInfo_${
          endoso.poliza_id
        }" data-poliza-id="${endoso.poliza_id}" style="color: ${
          getTextColor(endoso.status)
        }; text-decoration: underline;">
              ${endoso.poliza}
            </a>
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
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${endoso.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    endoso.status
                  )}><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnShow_${endoso.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    endoso.status
                  )}><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
              ${
                endoso.pdf_path
                  ? `
              <li>
                <a title="Ver pdf" class="btn__icon_show pointer" id="btnViewPdf_${endoso.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(endoso.status)}><path d="M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>
                </a>
              </li>
              `
                  : ''
              }
              <li>
                <a title="Cargar PDF" class="btn__icon_show pointer" id="btnUploadPdf_${endoso.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(endoso.status)}><path d="M440-320h80v-160h120L480-640 320-480h120v160ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${endoso.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    endoso.status
                  )}><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      $(`#td-clickable_${endoso.id}`).on('click', (e) => {
        $('#recib').modal();
        getRecibos(endoso.id, endoso.poliza_id);
      });
      $(`#btnEdit_${endoso.id}`).on('click', (e) =>
        editEndoso(endoso.id, endoso.poliza_id)
      );
      $(`#btnShow_${endoso.id}`).on('click', (e) => showEndoso(endoso.id));
      $(`#btnDelete_${endoso.id}`).on('click', (e) => cancelEndoso(endoso.id));
      $(`#btnViewPdf_${endoso.id}`).on('click', (e) => {
        if (endoso.pdf_path) {
          window.open(`/static/${endoso.pdf_path}`, '_blank');
        }
      });
      $(`#btnUploadPdf_${endoso.id}`).on('click', (e) => {
        e.preventDefault();
        uploadEndosoPdf(endoso.id);
      });
      $(`#btnPolizaInfo_${endoso.poliza_id}`).on('click', (e) => {
        e.preventDefault();
        showPolizaInfo(endoso.poliza_id);
      });
    });
    if (!data.length) return;
    $('#pagination').pagination({
      items: recordsTotal,
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
    $('#endoso_id').val(endoso_id);
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start: 0, length: 0, endoso_id }),
      success: function (resp) {
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
        $('#prima_neta').val(resp.data[0].prima_neta);
        $('#prima_total').val(resp.data[0].prima_total);
        $('#old_prima_neta').val(resp.data[0].prima_neta);
        $('#old_prima_total').val(resp.data[0].prima_total);
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

  function fillTableRecibos(
    resp,
    currentPage,
    itemsOnPage,
    endoso_id,
    poliza_id
  ) {
    const { data, recordsTotal } = resp;
    console.log('Recibos de endosos =>', data);
    const table = $('#receiptsTable');
    table.html('');
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption-recibos">
            <td>${recibo.numero}</td>
            <td>${recibo.fecha_recibo}</td>
            <td>${recibo.vencimiento}</td>
            <td>${recibo.prima_neta}</td>
            <td>${recibo.prima_total}</td>
            <td>${recibo.moneda}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${recibo.fecha_pago}</td>
            <td>${recibo.cancelado ? 'Cancelado' : ''}</td>
         </tr>`
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop('checked', true);
      $(`#check_pagado${recibo.id}`).on('click', function () {
        if ($(`#check_pagado${recibo.id}`).is(':checked') == true) {
          changeReciboPagado(recibo.id, 'Pagar', poliza_id, endoso_id);
        } else {
          changeReciboPagado(recibo.id, 'Cancelar Pago', poliza_id, endoso_id);
        }
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
        getRecibos(endoso_id, poliza_id, pageNumber, start);
      },
    });
  }

  function changeReciboPagado(recibo_id, accion, poliza_id, endoso_id) {
    $.ajax({
      type: 'POST',
      url: '/endosos/process_receipt',
      data: $.param({ recibo_id, accion }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error');
        } else {
          alert(resp.msg, 'success');
          getRecibos(endoso_id, poliza_id);
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  function showPolizaInfo(poliza_id) {
    if (!poliza_id) {
      alert('No se encontró el ID de la póliza', 'error', 'Error');
      return;
    }
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

  function getEndosos(pageNumber = 1, start = 0) {
    const length = 10;
    const searchValue = $('#searchEndoso').val();
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start, length, order: true, searchValue }),
      success: (resp) => fillTableEndosos(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getRecibos(endoso_id, poliza_id, pageNumber = 1, start = 0) {
    const length = 10;
    let sendObj;
    sendObj = { start, length, order: true, poliza_id, endoso_id };
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get_receipts',
      data: $.param(sendObj),
      success: (resp) =>
        fillTableRecibos(resp, pageNumber, length, endoso_id, poliza_id),
      error: (xhr, status, error) => console.error(error),
    });
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
          // alert(resp.msg, "error", resp.title);
          console.log('Error crear recibos', resp.error, resp.msg);
        } else {
          // alert(resp.msg, "success", resp.title);
          console.log('Recibos creados exitosamente');
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error'
        );
      },
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
    const prima_neta = $('#prima_neta').val();
    const old_prima_neta = $('#old_prima_neta').val();
    const prima_total = $('#prima_total').val();
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
    const poliza_id = $('#poliza_id').val();
    if (prima_neta !== old_prima_neta || prima_total !== old_prima_total) {
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
            const new_params = `${params}&poliza_id=${poliza_id}&is_endoso=true`;
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
                alert(
                  'Lamentamos el inconveniente, por favor vuelve a intentarlo',
                  'error'
                );
              },
            });
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
      let newParams = $('#form-polizas').serialize();
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
          alert(
            'Lamentamos el inconveniente, por favor vuelve a intentarlo',
            'error'
          );
        },
      });
    }
  });

  $('#form-recibo').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const endoso_id = $('#endoso_id').val();
    let newParams = $('#form-polizas').serialize();
    newParams = `${newParams}&endoso_id=${endoso_id}`;
    $.ajax({
      url: 'polizas/edit_endoso',
      method: 'POST',
      dataType: 'json',
      data: newParams,
      success: function (resp) {
        console.log(resp);
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          $('#create-recib').modal('toggle');
          $('#receipts_created').val('si');
          createReceipts(null, endoso_id);
          alert(resp.msg, 'success');
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

  $('#searchEndoso').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == '') return getEndosos();
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start: 0, length: 10, searchValue }),
      success: (resp) => fillTableEndosos(resp, 1, 10),
      error: (xhr, status, error) => console.error(error),
    });
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

  getEndosos();
});
