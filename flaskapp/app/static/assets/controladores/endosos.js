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
    } catch (error) {
      console.log(error);
      return null;
    }
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
          getPolizas();
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
            </ul>
          </td>
        </tr>`
      );
      $(`#td-clickable_${endoso.id}`).on('click', (e) => {
        $('#recib').modal();
        getRecibos(endoso.id, endoso.poliza_id);
      });
      $(`#btnShow_${endoso.id}`).on('click', (e) => showEndoso(endoso.id));
      $(`#btnDelete_${endoso.id}`).on('click', (e) => cancelEndoso(endoso.id));
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

  function getEndosos(pageNumber = 1, start = 0) {
    const length = 9;
    $.ajax({
      ...ajaxConfig,
      url: '/endosos/get',
      data: $.param({ start, length, order: true }),
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

  getEndosos();
});
